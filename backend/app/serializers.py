from . import models


def ts(dt):
    return dt.timestamp() * 1000 if dt else None


def member_out(m: models.Membership):
    return {
        "id": m.id,
        "name": m.user.name if m.user else "Гость",
        "role": m.role,
        "roleLabel": m.role_label,
        "roleCode": m.role_code,
        "age": m.age_label,
        "av": m.avatar_emoji,
        "photo": f"/api/files/{m.avatar_file_id}" if m.avatar_file_id else (m.user.photo_url if m.user else ""),
        "color": m.color,
        "hearts": m.hearts,
        "xp": m.xp,
        "adult": m.role_code == "adult",
    }


def task_out(t: models.Task):
    return {
        "id": t.id,
        "who": t.who_id,
        "ic": t.ic,
        "txt": t.txt,
        "meta": t.meta,
        "reward": t.reward,
        "done": t.done,
        "streak": t.streak,
        "dueDate": ts(t.due_date),
        "recurrence": t.recurrence,
        "proofFile": f"/api/files/{t.proof_file_id}" if t.proof_file_id else None,
        "createdBy": t.created_by_id,
    }


def shop_out(s: models.ShopItem):
    return {
        "id": s.id, "emo": s.emo, "nm": s.nm, "ds": s.ds, "cost": s.cost,
        "roles": [r for r in (s.roles or "").split(",") if r],
        "adult18": s.adult18, "locked": s.locked,
    }


def post_out(p: models.Post, likes, comments, files):
    return {
        "id": p.id,
        "who": p.membership_id,
        "text": p.text,
        "ts": ts(p.created_at),
        "likes": likes,
        "comments": [
            {"id": c.id, "who": c.membership_id, "text": c.text, "ts": ts(c.created_at)} for c in comments
        ],
        "files": [{"id": f.id, "url": f"/api/files/{f.id}", "contentType": f.content_type} for f in files],
    }


def message_out(msg: models.ChatMessage):
    return {
        "id": msg.id,
        "who": msg.membership_id,
        "text": msg.text,
        "ts": ts(msg.created_at),
        "file": {"id": msg.file_id, "url": f"/api/files/{msg.file_id}"} if msg.file_id else None,
    }
