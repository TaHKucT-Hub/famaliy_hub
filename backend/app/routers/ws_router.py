from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..db import SessionLocal
from .. import models
from ..security import decode_token
from ..ws import manager

router = APIRouter()


@router.websocket("/api/ws")
async def ws_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token", "")
    payload = decode_token(token)
    if not payload or not payload.get("mid"):
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        m = db.get(models.Membership, payload["mid"])
    finally:
        db.close()
    if not m:
        await websocket.close(code=4401)
        return

    family_id = m.family_id
    await manager.connect(family_id, websocket)
    try:
        while True:
            # Clients don't send anything meaningful; this just keeps the
            # connection open and lets us detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(family_id, websocket)
