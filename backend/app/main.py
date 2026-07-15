from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from . import models  # noqa: F401 (registers tables on Base.metadata)
from .config import FRONTEND_DIR, DEV_MODE
from .routers import auth, family, bootstrap, tasks, shop, feed, chat, files, admin, profile, ws_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Family Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, family.router, bootstrap.router, tasks.router, shop.router,
          feed.router, chat.router, files.router, admin.router, profile.router, ws_router.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True, "dev_mode": DEV_MODE}


# Serve the existing static frontend (index.html, styles.css, src/*.js) as-is.
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
