from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import require_admin, get_current_membership
from ..serializers import member_out, shop_out, invitation_out
from ..ws import manager

router = APIRouter(prefix="/api/admin", tags=["admin"])

ROLES = {"admin", "parent", "teen", "child"}


class MemberPatchIn(BaseModel):
    role: str | None = None
    age_label: str | None = None
    color: str | None = None
    avatar_emoji: str | None = None
    hearts: int | None = None
    xp: int | None = None


@router.patch("/members/{member_id}")
async def patch_member(member_id: int, body: MemberPatchIn, admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(models.Membership, member_id)
    if not target or target.family_id != admin.family_id:
        raise HTTPException(404, "Участник не найден")
    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(400, "Неизвестная роль")
        if target.id == admin.id and body.role != "admin":
            admins_left = db.query(models.Membership).filter(
                models.Membership.family_id == admin.family_id, models.Membership.role == "admin",
                models.Membership.id != admin.id,
            ).count()
            if admins_left == 0:
                raise HTTPException(409, "В семье должен остаться хотя бы один админ")
        target.role = body.role
    if body.age_label is not None:
        target.age_label = body.age_label
    if body.color is not None:
        target.color = body.color
    if body.avatar_emoji is not None:
        target.avatar_emoji = body.avatar_emoji
    if body.hearts is not None:
        target.hearts = max(0, body.hearts)
    if body.xp is not None:
        target.xp = max(0, body.xp)
    db.commit()
    await manager.broadcast(admin.family_id, "members")
    return member_out(target)


@router.delete("/members/{member_id}")
async def remove_member(member_id: int, admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(models.Membership, member_id)
    if not target or target.family_id != admin.family_id:
        raise HTTPException(404, "Участник не найден")
    if target.id == admin.id:
        raise HTTPException(400, "Нельзя удалить самого себя")
    db.delete(target)
    db.commit()
    await manager.broadcast(admin.family_id, "members")
    return {"ok": True}


# ---- Магазин (каталог) ----

class ShopItemIn(BaseModel):
    emo: str = "🎁"
    nm: str
    ds: str = ""
    cost: int = 10
    roles: list[str] = ["adult", "teen", "child"]
    adult18: bool = False
    locked: bool = False


@router.post("/shop")
async def create_shop_item(body: ShopItemIn, admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    item = models.ShopItem(
        family_id=admin.family_id, emo=body.emo, nm=body.nm, ds=body.ds, cost=body.cost,
        roles=",".join(body.roles), adult18=body.adult18, locked=body.locked,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    await manager.broadcast(admin.family_id, "shop")
    return shop_out(item)


@router.patch("/shop/{item_id}")
async def update_shop_item(item_id: int, body: ShopItemIn, admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.get(models.ShopItem, item_id)
    if not item or item.family_id != admin.family_id:
        raise HTTPException(404, "Товар не найден")
    item.emo, item.nm, item.ds, item.cost = body.emo, body.nm, body.ds, body.cost
    item.roles = ",".join(body.roles)
    item.adult18, item.locked = body.adult18, body.locked
    db.commit()
    await manager.broadcast(admin.family_id, "shop")
    return shop_out(item)


@router.delete("/shop/{item_id}")
async def delete_shop_item(item_id: int, admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.get(models.ShopItem, item_id)
    if not item or item.family_id != admin.family_id:
        raise HTTPException(404, "Товар не найден")
    db.delete(item)
    db.commit()
    await manager.broadcast(admin.family_id, "shop")
    return {"ok": True}


# ---- Приглашения (выбор друга VK + назначение роли заранее) ----

class InviteIn(BaseModel):
    vkUserId: str
    name: str = ""
    photoUrl: str = ""
    role: str = "child"
    ageLabel: str = ""


@router.post("/invite")
async def create_invitation(body: InviteIn, admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    if body.role not in ROLES:
        raise HTTPException(400, "Неизвестная роль")
    vk_uid = body.vkUserId.strip()
    if not vk_uid:
        raise HTTPException(400, "Не указан VK ID")

    existing_user = db.query(models.User).filter(models.User.vk_user_id == vk_uid).first()
    if existing_user:
        already = db.query(models.Membership).filter(models.Membership.user_id == existing_user.id).first()
        if already:
            if already.family_id == admin.family_id:
                raise HTTPException(409, "Этот человек уже в вашей семье")
            raise HTTPException(409, "Этот человек уже состоит в другой семье")

    inv = db.query(models.Invitation).filter(
        models.Invitation.family_id == admin.family_id, models.Invitation.vk_user_id == vk_uid,
    ).first()
    if not inv:
        inv = models.Invitation(family_id=admin.family_id, vk_user_id=vk_uid)
        db.add(inv)
    inv.name, inv.photo_url, inv.role, inv.age_label = body.name, body.photoUrl, body.role, body.ageLabel
    inv.invited_by_id = admin.id
    db.commit()
    db.refresh(inv)
    await manager.broadcast(admin.family_id, "invitations")
    return invitation_out(inv)


@router.get("/invitations")
def list_invitations(admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    invs = db.query(models.Invitation).filter(models.Invitation.family_id == admin.family_id).order_by(models.Invitation.created_at.desc()).all()
    return [invitation_out(i) for i in invs]


@router.delete("/invitations/{invitation_id}")
async def cancel_invitation(invitation_id: int, admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    inv = db.get(models.Invitation, invitation_id)
    if not inv or inv.family_id != admin.family_id:
        raise HTTPException(404, "Приглашение не найдено")
    db.delete(inv)
    db.commit()
    await manager.broadcast(admin.family_id, "invitations")
    return {"ok": True}


# ---- Единая семья: удаление остальных ----

def _delete_family_cascade(db: Session, family_id: int):
    post_ids = [pid for (pid,) in db.query(models.Post.id).filter(models.Post.family_id == family_id).all()]
    if post_ids:
        db.query(models.PostLike).filter(models.PostLike.post_id.in_(post_ids)).delete(synchronize_session=False)
        db.query(models.Comment).filter(models.Comment.post_id.in_(post_ids)).delete(synchronize_session=False)
        db.query(models.PostFile).filter(models.PostFile.post_id.in_(post_ids)).delete(synchronize_session=False)
    db.query(models.Post).filter(models.Post.family_id == family_id).delete(synchronize_session=False)
    db.query(models.ChatMessage).filter(models.ChatMessage.family_id == family_id).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.family_id == family_id).delete(synchronize_session=False)
    db.query(models.ShopItem).filter(models.ShopItem.family_id == family_id).delete(synchronize_session=False)
    db.query(models.WishlistItem).filter(models.WishlistItem.family_id == family_id).delete(synchronize_session=False)
    db.query(models.Invitation).filter(models.Invitation.family_id == family_id).delete(synchronize_session=False)
    # Membership/FileAsset ссылаются друг на друга (аватар), поэтому сначала
    # обнуляем avatar_file_id, иначе удаление files упрётся в FK.
    db.query(models.Membership).filter(models.Membership.family_id == family_id).update(
        {models.Membership.avatar_file_id: None}, synchronize_session=False
    )
    db.query(models.Membership).filter(models.Membership.family_id == family_id).delete(synchronize_session=False)
    db.query(models.FileAsset).filter(models.FileAsset.family_id == family_id).delete(synchronize_session=False)
    db.query(models.Family).filter(models.Family.id == family_id).delete(synchronize_session=False)


@router.post("/prune-other-families")
def prune_other_families(admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    """Оставляет только семью вызывающего админа, безвозвратно удаляя все
    остальные семьи и все их данные. Не может задеть свою семью — family_id
    берётся из собственного membership-токена админа, а не из запроса."""
    other_ids = [fid for (fid,) in db.query(models.Family.id).filter(models.Family.id != admin.family_id).all()]
    for fid in other_ids:
        _delete_family_cascade(db, fid)
    db.commit()
    return {"ok": True, "deletedFamilies": len(other_ids)}


# ---- Статистика ----

@router.get("/stats")
def family_stats(admin: models.Membership = Depends(require_admin), db: Session = Depends(get_db)):
    members = db.query(models.Membership).filter(models.Membership.family_id == admin.family_id).all()
    tasks = db.query(models.Task).filter(models.Task.family_id == admin.family_id).all()
    posts_count = db.query(models.Post).filter(models.Post.family_id == admin.family_id).count()
    messages_count = db.query(models.ChatMessage).filter(models.ChatMessage.family_id == admin.family_id).count()

    per_member = []
    for mem in members:
        done = sum(1 for t in tasks if t.who_id == mem.id and t.done)
        pending = sum(1 for t in tasks if t.who_id == mem.id and not t.done)
        per_member.append({
            "id": mem.id, "name": mem.user.name if mem.user else "Гость",
            "hearts": mem.hearts, "xp": mem.xp, "tasksDone": done, "tasksPending": pending,
        })
    per_member.sort(key=lambda x: x["hearts"], reverse=True)

    return {
        "membersCount": len(members),
        "tasksDone": sum(1 for t in tasks if t.done),
        "tasksPending": sum(1 for t in tasks if not t.done),
        "heartsTotal": sum(mem.hearts for mem in members),
        "postsCount": posts_count,
        "messagesCount": messages_count,
        "perMember": per_member,
    }
