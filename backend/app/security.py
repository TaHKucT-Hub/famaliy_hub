import base64
import hashlib
import hmac
import datetime
from urllib.parse import urlencode

import jwt

from .config import VK_APP_SECRET, DEV_MODE, JWT_SECRET, JWT_ALG, JWT_TTL_DAYS


def verify_vk_signature(params: dict) -> bool:
    """Validate VK Mini Apps launch params per VK's documented sign algorithm.
    In DEV_MODE (no VK_APP_SECRET configured) this always passes, so the app
    can be tested outside of a real VK Mini App shell."""
    if DEV_MODE:
        return True
    sign = params.get("sign")
    if not sign:
        return False
    vk_params = sorted((k, v) for k, v in params.items() if k.startswith("vk_"))
    query_string = urlencode(vk_params)
    digest = hmac.new(VK_APP_SECRET.encode(), query_string.encode(), hashlib.sha256).digest()
    computed = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
    return hmac.compare_digest(computed, sign)


def issue_token(user_id: int, membership_id, family_id) -> str:
    payload = {
        "uid": user_id,
        "mid": membership_id,
        "fam": family_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=JWT_TTL_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None
