from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_user, get_current_membership
from ..security import issue_token
from ..seed import seed_shop

router = APIRouter(prefix="/api/family", tags=["family"])


class CreateFamilyIn(BaseModel):
    name: str = "Наша семья"


@router.post("/create")
def create_family(body: CreateFamilyIn, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(models.Membership).filter(models.Membership.user_id == user.id).first()
    if existing:
        raise HTTPException(409, "Вы уже состоите в семье")

    # Приложение работает как одна семья на всё пространство — как только она
    # создана, повторное создание запрещено (даже для других VK-пользователей).
    if db.query(models.Family).count() > 0:
        raise HTTPException(403, "Создание новых семей отключено. Обратитесь к администратору семьи, чтобы вас пригласили")

    family = models.Family(name=body.name or "Наша семья")
    db.add(family)
    db.commit()
    db.refresh(family)

    membership = models.Membership(
        user_id=user.id, family_id=family.id, role="admin",
        age_label="18+", color="#4DD0E1", avatar_emoji="👑", hearts=0, xp=0,
    )
    db.add(membership)
    seed_shop(db, family.id)
    db.commit()
    db.refresh(membership)

    token = issue_token(user.id, membership.id, family.id)
    return {"token": token, "family": {"id": family.id, "name": family.name, "invite_code": family.invite_code}}


@router.post("/join")
def join_family():
    # Самостоятельное присоединение по коду отключено — добавлять людей может
    # только админ семьи (раздел Админ → Участники → приглашение по VK ID).
    raise HTTPException(403, "Присоединение по коду отключено. Попросите администратора семьи пригласить вас")


@router.get("/mine")
def my_family(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    family = db.get(models.Family, m.family_id)
    return {"id": family.id, "name": family.name, "invite_code": family.invite_code}
