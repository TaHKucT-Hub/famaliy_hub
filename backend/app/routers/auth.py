from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..security import verify_vk_signature, issue_token
from ..deps import get_current_user
from ..ws import manager

router = APIRouter(prefix="/api/auth", tags=["auth"])


class VkAuthIn(BaseModel):
    params: dict = {}
    name: str | None = None
    photo_url: str | None = None


@router.post("")
async def vk_auth(body: VkAuthIn, db: Session = Depends(get_db)):
    params = body.params or {}
    if not verify_vk_signature(params):
        raise HTTPException(401, "Подпись VK не прошла проверку")

    vk_user_id = str(params.get("vk_user_id") or params.get("dev_user_id") or "guest")

    user = db.query(models.User).filter(models.User.vk_user_id == vk_user_id).first()
    if not user:
        user = models.User(vk_user_id=vk_user_id, name=body.name or "Гость", photo_url=body.photo_url or "")
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        changed = False
        if body.name and user.name != body.name:
            user.name = body.name
            changed = True
        if body.photo_url and user.photo_url != body.photo_url:
            user.photo_url = body.photo_url
            changed = True
        if changed:
            db.commit()

    membership = db.query(models.Membership).filter(models.Membership.user_id == user.id).first()

    # Админ заранее пригласил этого VK-пользователя — принимаем приглашение
    # автоматически, минуя экран "создать/присоединиться".
    if not membership:
        invite = db.query(models.Invitation).filter(models.Invitation.vk_user_id == vk_user_id).first()
        if invite:
            membership = models.Membership(
                user_id=user.id, family_id=invite.family_id, role=invite.role,
                age_label=invite.age_label, color=invite.color, avatar_emoji=invite.avatar_emoji,
                hearts=0, xp=0,
            )
            db.add(membership)
            db.delete(invite)
            db.commit()
            db.refresh(membership)
            await manager.broadcast(membership.family_id, "members")
            await manager.broadcast(membership.family_id, "invitations")

    token = issue_token(user.id, membership.id if membership else None, membership.family_id if membership else None)
    return {
        "token": token,
        "needs_family": membership is None,
        "user": {"id": user.id, "name": user.name, "photo_url": user.photo_url},
    }


@router.get("/me")
def whoami(user: models.User = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "photo_url": user.photo_url}
