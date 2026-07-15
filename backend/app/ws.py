import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[int, set[WebSocket]] = {}

    async def connect(self, family_id: int, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(family_id, set()).add(ws)

    def disconnect(self, family_id: int, ws: WebSocket):
        room = self.rooms.get(family_id)
        if room and ws in room:
            room.discard(ws)
            if not room:
                self.rooms.pop(family_id, None)

    async def broadcast(self, family_id: int, scope: str, exclude: WebSocket | None = None):
        room = self.rooms.get(family_id)
        if not room:
            return
        payload = json.dumps({"type": "changed", "scope": scope})
        dead = []
        for ws in room:
            if ws is exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            room.discard(ws)


manager = ConnectionManager()
