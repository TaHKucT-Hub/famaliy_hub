from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..serializers import post_out
from ..ws import manager

router = APIRouter(prefix="/api/feed", tags=["feed"])


def _post_full(db: Session, p: models.Post):
    likes = [l.membership_id for l in db.query(models.PostLike).filter(models.PostLike.post_id == p.id).all()]
    comments = db.query(models.Comment).filter(models.Comment.post_id == p.id).order_by(models.Comment.created_at).all()
    file_ids = [pf.file_id for pf in db.query(models.PostFile).filter(models.PostFile.post_id == p.id).all()]
    files = [db.get(models.FileAsset, fid) for fid in file_ids]
    files = [f for f in files if f]
    return post_out(p, likes, comments, files)


@router.get("")
def list_posts(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    posts = db.query(models.Post).filter(models.Post.family_id == m.family_id).order_by(models.Post.created_at.desc()).limit(50).all()
    return [_post_full(db, p) for p in posts]


class CreatePostIn(BaseModel):
    text: str
    fileIds: list[int] = []


@router.post("")
async def create_post(body: CreatePostIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    text = body.text.strip()
    if not text and not body.fileIds:
        raise HTTPException(400, "Пустой пост")
    p = models.Post(family_id=m.family_id, membership_id=m.id, text=text)
    db.add(p)
    db.commit()
    db.refresh(p)
    for fid in body.fileIds:
        asset = db.get(models.FileAsset, fid)
        if asset and asset.family_id == m.family_id:
            db.add(models.PostFile(post_id=p.id, file_id=fid))
    db.commit()
    await manager.broadcast(m.family_id, "feed")
    return _post_full(db, p)


@router.delete("/{post_id}")
async def delete_post(post_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    p = db.get(models.Post, post_id)
    if not p or p.family_id != m.family_id:
        raise HTTPException(404, "Пост не найден")
    if p.membership_id != m.id and m.role != "admin":
        raise HTTPException(403, "Нет доступа")
    db.query(models.PostLike).filter(models.PostLike.post_id == post_id).delete()
    db.query(models.Comment).filter(models.Comment.post_id == post_id).delete()
    db.query(models.PostFile).filter(models.PostFile.post_id == post_id).delete()
    db.delete(p)
    db.commit()
    await manager.broadcast(m.family_id, "feed")
    return {"ok": True}


@router.post("/{post_id}/like")
async def toggle_like(post_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    p = db.get(models.Post, post_id)
    if not p or p.family_id != m.family_id:
        raise HTTPException(404, "Пост не найден")
    existing = db.query(models.PostLike).filter(models.PostLike.post_id == post_id, models.PostLike.membership_id == m.id).first()
    if existing:
        db.delete(existing)
    else:
        db.add(models.PostLike(post_id=post_id, membership_id=m.id))
    db.commit()
    await manager.broadcast(m.family_id, "feed")
    return _post_full(db, p)


class CommentIn(BaseModel):
    text: str


@router.post("/{post_id}/comments")
async def add_comment(post_id: int, body: CommentIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    p = db.get(models.Post, post_id)
    if not p or p.family_id != m.family_id:
        raise HTTPException(404, "Пост не найден")
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Пустой комментарий")
    db.add(models.Comment(post_id=post_id, membership_id=m.id, text=text))
    db.commit()
    await manager.broadcast(m.family_id, "feed")
    return _post_full(db, p)


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    c = db.get(models.Comment, comment_id)
    if not c:
        raise HTTPException(404, "Комментарий не найден")
    p = db.get(models.Post, c.post_id)
    if not p or p.family_id != m.family_id:
        raise HTTPException(404, "Комментарий не найден")
    if c.membership_id != m.id and m.role != "admin":
        raise HTTPException(403, "Нет доступа")
    db.delete(c)
    db.commit()
    await manager.broadcast(m.family_id, "feed")
    return {"ok": True}
