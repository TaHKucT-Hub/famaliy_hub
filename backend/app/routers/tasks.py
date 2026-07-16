import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..deps import get_current_membership
from ..serializers import task_out
from ..ws import manager

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
def list_tasks(m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    tasks = db.query(models.Task).filter(models.Task.family_id == m.family_id).all()
    return [task_out(t) for t in tasks]


class CreateTaskIn(BaseModel):
    txt: str
    ic: str = "📌"
    meta: str = ""
    reward: int = 10
    dueDate: float | None = None
    recurrence: str | None = None
    who: int | None = None  # only self unless caller is admin (checked below)


@router.post("")
async def create_task(body: CreateTaskIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    who_id = body.who or m.id
    if who_id != m.id and m.role != "admin":
        raise HTTPException(403, "Назначать задачи другим может только админ")
    assignee = db.get(models.Membership, who_id)
    if not assignee or assignee.family_id != m.family_id:
        raise HTTPException(404, "Участник не найден")

    t = models.Task(
        family_id=m.family_id, who_id=who_id, created_by_id=m.id,
        ic=body.ic, txt=body.txt.strip(), meta=body.meta, reward=max(1, body.reward),
        due_date=datetime.datetime.utcfromtimestamp(body.dueDate / 1000) if body.dueDate else None,
        recurrence=body.recurrence,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    await manager.broadcast(m.family_id, "tasks")
    return task_out(t)


@router.delete("/{task_id}")
async def delete_task(task_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    t = db.get(models.Task, task_id)
    if not t or t.family_id != m.family_id:
        raise HTTPException(404, "Задача не найдена")
    if t.who_id != m.id and t.created_by_id != m.id and m.role != "admin":
        raise HTTPException(403, "Нет доступа к этой задаче")
    db.delete(t)
    db.commit()
    await manager.broadcast(m.family_id, "tasks")
    return {"ok": True}


@router.post("/{task_id}/complete")
async def complete_task(task_id: int, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    t = db.get(models.Task, task_id)
    if not t or t.family_id != m.family_id:
        raise HTTPException(404, "Задача не найдена")
    if t.who_id != m.id:
        raise HTTPException(403, "Это не твоя задача")
    if t.done:
        raise HTTPException(409, "Уже выполнено")

    gain = t.reward * 2 if t.streak >= 7 else t.reward
    t.done = True
    t.completed_at = datetime.datetime.utcnow()
    assignee = db.get(models.Membership, t.who_id)
    assignee.hearts += gain
    assignee.xp += gain

    if t.recurrence in ("daily", "weekly"):
        delta = datetime.timedelta(days=1 if t.recurrence == "daily" else 7)
        db.add(models.Task(
            family_id=t.family_id, who_id=t.who_id, created_by_id=t.created_by_id,
            ic=t.ic, txt=t.txt, meta=t.meta, reward=t.reward,
            due_date=(t.due_date + delta) if t.due_date else None,
            recurrence=t.recurrence, streak=t.streak + 1,
        ))

    db.commit()
    await manager.broadcast(m.family_id, "tasks", exclude=None)
    await manager.broadcast(m.family_id, "members", exclude=None)
    return {"gain": gain, "hearts": assignee.hearts, "xp": assignee.xp}


class ProofIn(BaseModel):
    fileId: int


@router.post("/{task_id}/proof")
async def attach_proof(task_id: int, body: ProofIn, m: models.Membership = Depends(get_current_membership), db: Session = Depends(get_db)):
    t = db.get(models.Task, task_id)
    if not t or t.family_id != m.family_id:
        raise HTTPException(404, "Задача не найдена")
    if t.who_id != m.id:
        raise HTTPException(403, "Это не твоя задача")
    asset = db.get(models.FileAsset, body.fileId)
    if not asset or asset.family_id != m.family_id:
        raise HTTPException(404, "Файл не найден")
    t.proof_file_id = asset.id
    db.commit()
    await manager.broadcast(m.family_id, "tasks")
    return task_out(t)
