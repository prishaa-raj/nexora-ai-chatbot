"""
Password hashing (bcrypt) and JWT issuance/verification.
Implements the "secure registration/login, password encryption, JWT
authentication" requirements of Module 1 (User Authentication).

Uses the `bcrypt` library directly rather than passlib. passlib's last
release was in 2020, and its bcrypt-backend version detection crashes on
bcrypt>=4.1 (it looks for a `bcrypt.__about__` submodule that newer bcrypt
versions removed) -- that's the "AttributeError in passlib/handlers/bcrypt.py"
crash you'll find if you search this error. Calling bcrypt directly sidesteps
that fragile indirection entirely and has no such version trap.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.config import settings

_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        # Malformed/unrecognized hash -- fail closed rather than raising.
        return False


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None