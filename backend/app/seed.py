from sqlalchemy.orm import Session
from . import models

DEFAULT_SHOP = [
    {"emo": "📺", "nm": "Час планшета", "ds": "+1 час экранного времени", "cost": 40, "roles": "teen,child"},
    {"emo": "🎬", "nm": "Выбор фильма", "ds": "Ты решаешь, что смотрим вечером", "cost": 60, "roles": "teen,child"},
    {"emo": "🍦", "nm": "Мороженое", "ds": "Любое на твой выбор", "cost": 30, "roles": "teen,child"},
    {"emo": "🤫", "nm": "Час тишины", "ds": "Никто не беспокоит 60 минут", "cost": 80, "roles": "adult"},
    {"emo": "🍕", "nm": "День без готовки", "ds": "Сегодня готовит кто-то другой", "cost": 120, "roles": "adult"},
    {"emo": "🎣", "nm": "Выходной на рыбалку", "ds": "Законный день для себя", "cost": 200, "roles": "adult"},
    {"emo": "💝", "nm": "Тайное желание", "ds": "Приватная награда для двоих", "cost": 150, "roles": "adult", "adult18": True, "locked": True},
]


def seed_shop(db: Session, family_id: int):
    for it in DEFAULT_SHOP:
        db.add(models.ShopItem(family_id=family_id, **it))
    db.commit()
