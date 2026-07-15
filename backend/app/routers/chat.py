from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..serializers import message_out
from ..ws import manager

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("")
def list_messages(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    msgs = (
        db.query(models.ChatMessage).filter(models.ChatMessage.family_id == m.family_id)
        .order_by(models.ChatMessage.created_at.desc()).limit(150).all()
    )
    return [message_out(x) for x in reversed(msgs)]


class SendMessageIn(BaseModel):
    text: str = ""
    fileId: int | None = None


@router.post("")
async def send_message(body: SendMessageIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    text = body.text.strip()
    if not text and not body.fileId:
        raise HTTPException(400, "Пустое сообщение")
    if body.fileId:
        asset = db.get(models.FileAsset, body.fileId)
        if not asset or asset.family_id != m.family_id:
            raise HTTPException(404, "Файл не найден")
    msg = models.ChatMessage(family_id=m.family_id, membership_id=m.id, text=text, file_id=body.fileId)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    await manager.broadcast(m.family_id, "chat")
    return message_out(msg)


@router.delete("/{message_id}")
async def delete_message(message_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    msg = db.get(models.ChatMessage, message_id)
    if not msg or msg.family_id != m.family_id:
        raise HTTPException(404, "Сообщение не найдено")
    if msg.membership_id != m.id and m.role != "admin":
        raise HTTPException(403, "Нет доступа")
    db.delete(msg)
    db.commit()
    await manager.broadcast(m.family_id, "chat")
    return {"ok": True}
