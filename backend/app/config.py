import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SQLite by default for local dev; Render sets DATABASE_URL to Postgres.
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'backend' / 'familyhub.db'}")
if DATABASE_URL.startswith("postgres://"):
    # Render gives postgres://, SQLAlchemy 2.x + psycopg3 wants postgresql+psycopg://
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# JWT signing secret — set JWT_SECRET on Render; falls back to a random dev-only value.
JWT_SECRET = os.environ.get("JWT_SECRET") or secrets.token_hex(32)
JWT_ALG = "HS256"
JWT_TTL_DAYS = 30

# VK Mini App "secure key" (Settings -> App -> Secure key). If unset, the server
# runs in DEV MODE: it trusts the vk_user_id sent by the client without checking
# the signature. This is required for local testing outside VK, but must be set
# in production so requests can't be forged.
VK_APP_SECRET = os.environ.get("VK_APP_SECRET", "")
DEV_MODE = VK_APP_SECRET == ""

MAX_FILE_SIZE = 8 * 1024 * 1024  # 8 MB per uploaded file
FRONTEND_DIR = BASE_DIR
