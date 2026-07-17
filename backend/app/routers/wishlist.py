from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..serializers import wishlist_out
from ..ws import manager

router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])


@router.get("")
def list_wishlist(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    items = (
        db.query(models.WishlistItem)
        .filter(models.WishlistItem.family_id == m.family_id)
        .order_by(models.WishlistItem.created_at.desc())
        .all()
    )
    return [wishlist_out(w, m.id) for w in items]


class CreateWishIn(BaseModel):
    title: str
    desc: str = ""
    url: str = ""
    price: int | None = None
    imageFileId: int | None = None


def _check_image(db: Session, family_id: int, file_id: int | None):
    if not file_id:
        return None
    asset = db.get(models.FileAsset, file_id)
    if not asset or asset.family_id != family_id:
        raise HTTPException(404, "Файл не найден")
    return asset.id


@router.post("")
async def create_wish(body: CreateWishIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "Нужно название подарка")
    w = models.WishlistItem(
        family_id=m.family_id, membership_id=m.id,
        title=title, description=body.desc.strip(), url=body.url.strip(),
        price=body.price, image_file_id=_check_image(db, m.family_id, body.imageFileId),
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    await manager.broadcast(m.family_id, "wishlist")
    return wishlist_out(w, m.id)


class EditWishIn(BaseModel):
    title: str | None = None
    desc: str | None = None
    url: str | None = None
    price: int | None = None
    imageFileId: int | None = None


@router.patch("/{wish_id}")
async def edit_wish(wish_id: int, body: EditWishIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    w = db.get(models.WishlistItem, wish_id)
    if not w or w.family_id != m.family_id:
        raise HTTPException(404, "Желание не найдено")
    if w.membership_id != m.id and m.role != "admin":
        raise HTTPException(403, "Можно редактировать только своё желание")

    if body.title is not None:
        title = body.title.strip()
        if not title:
            raise HTTPException(400, "Нужно название подарка")
        w.title = title
    if body.desc is not None:
        w.description = body.desc.strip()
    if body.url is not None:
        w.url = body.url.strip()
    if body.price is not None:
        w.price = body.price
    if body.imageFileId is not None:
        w.image_file_id = _check_image(db, m.family_id, body.imageFileId)

    db.commit()
    await manager.broadcast(m.family_id, "wishlist")
    return wishlist_out(w, m.id)


@router.delete("/{wish_id}")
async def delete_wish(wish_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    w = db.get(models.WishlistItem, wish_id)
    if not w or w.family_id != m.family_id:
        raise HTTPException(404, "Желание не найдено")
    if w.membership_id != m.id and m.role != "admin":
        raise HTTPException(403, "Можно удалить только своё желание")
    db.delete(w)
    db.commit()
    await manager.broadcast(m.family_id, "wishlist")
    return {"ok": True}


@router.post("/{wish_id}/reserve")
async def reserve_wish(wish_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    w = db.get(models.WishlistItem, wish_id)
    if not w or w.family_id != m.family_id:
        raise HTTPException(404, "Желание не найдено")
    if w.membership_id == m.id:
        raise HTTPException(403, "Нельзя бронировать своё же желание")
    if w.status != "open":
        raise HTTPException(409, "Уже забронировано другим членом семьи")
    w.status = "reserved"
    w.reserved_by_id = m.id
    db.commit()
    await manager.broadcast(m.family_id, "wishlist")
    return wishlist_out(w, m.id)


@router.post("/{wish_id}/unreserve")
async def unreserve_wish(wish_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    w = db.get(models.WishlistItem, wish_id)
    if not w or w.family_id != m.family_id:
        raise HTTPException(404, "Желание не найдено")
    if w.reserved_by_id != m.id and m.role != "admin":
        raise HTTPException(403, "Снять бронь может только тот, кто её поставил")
    w.status = "open"
    w.reserved_by_id = None
    db.commit()
    await manager.broadcast(m.family_id, "wishlist")
    return wishlist_out(w, m.id)


@router.post("/{wish_id}/given")
async def mark_given(wish_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    w = db.get(models.WishlistItem, wish_id)
    if not w or w.family_id != m.family_id:
        raise HTTPException(404, "Желание не найдено")
    if w.reserved_by_id != m.id and m.role != "admin":
        raise HTTPException(403, "Отметить подарок врученным может только тот, кто его забронировал")
    w.status = "given"
    db.commit()
    await manager.broadcast(m.family_id, "wishlist")
    return wishlist_out(w, m.id)
