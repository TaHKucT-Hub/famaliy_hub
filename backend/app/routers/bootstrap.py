from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..serializers import member_out, task_out, shop_out, post_out, message_out

router = APIRouter(prefix="/api", tags=["bootstrap"])


@router.get("/bootstrap")
def bootstrap(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    family = db.get(models.Family, m.family_id)
    members = db.query(models.Membership).filter(models.Membership.family_id == m.family_id).all()
    tasks = db.query(models.Task).filter(models.Task.family_id == m.family_id).all()
    shop = db.query(models.ShopItem).filter(models.ShopItem.family_id == m.family_id).all()

    posts = (
        db.query(models.Post).filter(models.Post.family_id == m.family_id)
        .order_by(models.Post.created_at.desc()).limit(50).all()
    )
    post_ids = [p.id for p in posts]
    likes_by_post = {}
    if post_ids:
        for like in db.query(models.PostLike).filter(models.PostLike.post_id.in_(post_ids)).all():
            likes_by_post.setdefault(like.post_id, []).append(like.membership_id)
    comments_by_post = {}
    if post_ids:
        for c in db.query(models.Comment).filter(models.Comment.post_id.in_(post_ids)).order_by(models.Comment.created_at).all():
            comments_by_post.setdefault(c.post_id, []).append(c)
    files_by_post = {}
    if post_ids:
        for pf in db.query(models.PostFile).filter(models.PostFile.post_id.in_(post_ids)).all():
            asset = db.get(models.FileAsset, pf.file_id)
            if asset:
                files_by_post.setdefault(pf.post_id, []).append(asset)

    messages = (
        db.query(models.ChatMessage).filter(models.ChatMessage.family_id == m.family_id)
        .order_by(models.ChatMessage.created_at.desc()).limit(100).all()
    )

    return {
        "me": {**member_out(m), "userId": m.user_id},
        "family": {"id": family.id, "name": family.name, "invite_code": family.invite_code},
        "members": [member_out(x) for x in members],
        "tasks": [task_out(t) for t in tasks],
        "shop": [shop_out(s) for s in shop],
        "posts": [
            post_out(p, likes_by_post.get(p.id, []), comments_by_post.get(p.id, []), files_by_post.get(p.id, []))
            for p in posts
        ],
        "messages": [message_out(msg) for msg in reversed(messages)],
    }


@router.get("/members")
def list_members(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    members = db.query(models.Membership).filter(models.Membership.family_id == m.family_id).all()
    return [member_out(x) for x in members]
