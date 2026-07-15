from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..serializers import shop_out
from ..ws import manager

router = APIRouter(prefix="/api/shop", tags=["shop"])


@router.get("")
def list_shop(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    items = db.query(models.ShopItem).filter(models.ShopItem.family_id == m.family_id).all()
    return [shop_out(s) for s in items]


@router.post("/{item_id}/buy")
async def buy_item(item_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    item = db.get(models.ShopItem, item_id)
    if not item or item.family_id != m.family_id:
        raise HTTPException(404, "Товар не найден")
    if item.locked:
        raise HTTPException(403, "Этот товар заблокирован")
    if m.role_code not in (item.roles or "").split(","):
        raise HTTPException(403, "Недоступно для твоей роли")
    if m.hearts < item.cost:
        raise HTTPException(402, "Не хватает сердечек")

    m.hearts -= item.cost
    db.commit()
    await manager.broadcast(m.family_id, "members")
    return {"hearts": m.hearts}
