from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..config import MAX_FILE_SIZE
from ..ws import manager
from ..serializers import ts

router = APIRouter(prefix="/api/files", tags=["files"])

ALLOWED_KINDS = {"avatar", "task_proof", "post_photo", "document", "wishlist"}


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    kind: str = Form("document"),
    title: str = Form(""),
    m: models.Membership = Depends(get_current_membership),
    db: Session = Depends(get_db),
):
    if kind not in ALLOWED_KINDS:
        raise HTTPException(400, "Неизвестный тип файла")
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, f"Файл больше {MAX_FILE_SIZE // (1024*1024)} МБ")
    if not data:
        raise HTTPException(400, "Пустой файл")

    asset = models.FileAsset(
        family_id=m.family_id,
        uploaded_by_id=m.id,
        filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        size=len(data),
        kind=kind,
        title=title,
        data=data,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    if kind == "document":
        await manager.broadcast(m.family_id, "documents")
    return {
        "id": asset.id, "url": f"/api/files/{asset.id}", "filename": asset.filename,
        "content_type": asset.content_type, "size": asset.size, "kind": asset.kind, "title": asset.title,
    }


@router.get("/{file_id}")
def get_file(file_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    asset = db.get(models.FileAsset, file_id)
    if not asset or asset.family_id != m.family_id:
        raise HTTPException(404, "Файл не найден")
    return Response(content=asset.data, media_type=asset.content_type)


@router.get("")
def list_documents(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    assets = (
        db.query(models.FileAsset)
        .filter(models.FileAsset.family_id == m.family_id, models.FileAsset.kind == "document")
        .order_by(models.FileAsset.created_at.desc())
        .all()
    )
    return [
        {
            "id": a.id, "url": f"/api/files/{a.id}", "filename": a.filename, "title": a.title,
            "content_type": a.content_type, "size": a.size,
            "uploaded_by": a.uploaded_by_id, "ts": ts(a.created_at),
        }
        for a in assets
    ]


@router.delete("/{file_id}")
async def delete_document(file_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    asset = db.get(models.FileAsset, file_id)
    if not asset or asset.family_id != m.family_id:
        raise HTTPException(404, "Файл не найден")
    if asset.kind == "document" and asset.uploaded_by_id != m.id and m.role != "admin":
        raise HTTPException(403, "Удалить документ может только автор или админ")
    db.delete(asset)
    db.commit()
    if asset.kind == "document":
        await manager.broadcast(m.family_id, "documents")
    return {"ok": True}
