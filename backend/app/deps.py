from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from .db import get_db
from .security import decode_token
from . import models


def get_token_payload(authorization: str = Header(default=""), token: str = ""):
    # <img>/<a> tags can't send an Authorization header, so file endpoints
    # (and the WebSocket handshake) also accept ?token=... as a query param.
    raw = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else token
    if not raw:
        raise HTTPException(401, "Не авторизован")
    payload = decode_token(raw)
    if not payload:
        raise HTTPException(401, "Сессия недействительна, войдите заново")
    return payload


def get_current_user(payload: dict = Depends(get_token_payload), db: Session = Depends(get_db)) -> models.User:
    user = db.get(models.User, payload["uid"])
    if not user:
        raise HTTPException(401, "Пользователь не найден")
    return user


def get_current_membership(payload: dict = Depends(get_token_payload), db: Session = Depends(get_db)) -> models.Membership:
    mid = payload.get("mid")
    if not mid:
        raise HTTPException(409, "Сначала создайте или присоединитесь к семье")
    m = db.get(models.Membership, mid)
    if not m:
        raise HTTPException(401, "Членство в семье не найдено")
    return m


def require_admin(m: models.Membership = Depends(get_current_membership)) -> models.Membership:
    if m.role != "admin":
        raise HTTPException(403, "Доступно только администратору семьи")
    return m
