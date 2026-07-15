from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..serializers import member_out
from ..ws import manager

router = APIRouter(prefix="/api/me", tags=["profile"])


class AvatarIn(BaseModel):
    fileId: int


@router.patch("/avatar")
async def set_avatar(body: AvatarIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    asset = db.get(models.FileAsset, body.fileId)
    if not asset or asset.family_id != m.family_id:
        raise HTTPException(404, "Файл не найден")
    m.avatar_file_id = asset.id
    db.commit()
    await manager.broadcast(m.family_id, "members")
    return member_out(m)
