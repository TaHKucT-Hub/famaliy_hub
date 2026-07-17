import datetime
import secrets

from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, DateTime, Text, LargeBinary, UniqueConstraint
)
from sqlalchemy.orm import relationship

from .db import Base


def gen_invite_code():
    return secrets.token_hex(4).upper()  # e.g. "3F9A21B0"


class Family(Base):
    __tablename__ = "families"
    id = Column(Integer, primary_key=True)
    name = Column(String, default="Наша семья")
    invite_code = Column(String, unique=True, index=True, default=gen_invite_code)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    memberships = relationship("Membership", back_populates="family", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    vk_user_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, default="Гость")
    photo_url = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    memberships = relationship("Membership", back_populates="user")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "family_id", name="uq_user_family"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)

    role = Column(String, default="child")  # admin | parent | teen | child
    age_label = Column(String, default="")
    color = Column(String, default="#4DD0E1")
    avatar_emoji = Column(String, default="🙂")
    avatar_file_id = Column(Integer, ForeignKey("files.id"), nullable=True)

    hearts = Column(Integer, default=0)
    xp = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="memberships")
    family = relationship("Family", back_populates="memberships")

    @property
    def role_code(self):
        return "adult" if self.role in ("admin", "parent") else self.role

    @property
    def role_label(self):
        return {"admin": "Админ", "parent": "Родитель", "teen": "Подросток", "child": "Ребёнок"}.get(self.role, self.role)


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    who_id = Column(Integer, ForeignKey("memberships.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("memberships.id"), nullable=True)

    ic = Column(String, default="📌")
    txt = Column(String, nullable=False)
    meta = Column(String, default="")
    reward = Column(Integer, default=10)
    done = Column(Boolean, default=False)
    streak = Column(Integer, default=0)

    due_date = Column(DateTime, nullable=True)
    recurrence = Column(String, nullable=True)  # null | "daily" | "weekly"
    proof_file_id = Column(Integer, ForeignKey("files.id"), nullable=True)

    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ShopItem(Base):
    __tablename__ = "shop_items"
    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    emo = Column(String, default="🎁")
    nm = Column(String, nullable=False)
    ds = Column(String, default="")
    cost = Column(Integer, default=10)
    roles = Column(String, default="adult,teen,child")  # CSV
    adult18 = Column(Boolean, default=False)
    locked = Column(Boolean, default=False)


class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("memberships.id"), nullable=False)
    text = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "membership_id", name="uq_post_like"),)
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("memberships.id"), nullable=False)


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("memberships.id"), nullable=False)
    text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PostFile(Base):
    __tablename__ = "post_files"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("memberships.id"), nullable=False)
    text = Column(String, default="")
    file_id = Column(Integer, ForeignKey("files.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FileAsset(Base):
    __tablename__ = "files"
    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("memberships.id"), nullable=True)
    filename = Column(String, default="file")
    content_type = Column(String, default="application/octet-stream")
    size = Column(Integer, default=0)
    kind = Column(String, default="document")  # avatar | task_proof | post_photo | document
    title = Column(String, default="")
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class WishlistItem(Base):
    """Желание участника семьи. Бронь/статус подарка видны всем, КРОМЕ
    владельца желания — иначе подарок перестаёт быть сюрпризом."""
    __tablename__ = "wishlist_items"

    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    membership_id = Column(Integer, ForeignKey("memberships.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(String, default="")
    url = Column(String, default="")
    price = Column(Integer, nullable=True)
    image_file_id = Column(Integer, ForeignKey("files.id"), nullable=True)

    status = Column(String, default="open")  # open | reserved | given
    reserved_by_id = Column(Integer, ForeignKey("memberships.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Invitation(Base):
    """Админ приглашает конкретного VK-пользователя (из друзей) с заранее
    назначенной ролью. Когда этот vk_user_id первый раз авторизуется через
    /api/auth, приглашение автоматически превращается в Membership —
    человеку не нужно вводить код приглашения."""
    __tablename__ = "invitations"
    __table_args__ = (UniqueConstraint("family_id", "vk_user_id", name="uq_invite_family_vkuser"),)

    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    vk_user_id = Column(String, nullable=False, index=True)
    name = Column(String, default="")
    photo_url = Column(String, default="")
    role = Column(String, default="child")
    age_label = Column(String, default="")
    color = Column(String, default="#4DD0E1")
    avatar_emoji = Column(String, default="🙂")
    invited_by_id = Column(Integer, ForeignKey("memberships.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
