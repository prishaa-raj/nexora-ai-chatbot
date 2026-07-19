"""Module 1: unit tests for the low-level security helpers (no HTTP, no DB)."""
import time

import pytest
from jose import jwt

from app.config import settings
from app.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_password_produces_a_different_string_than_the_input():
    hashed = hash_password("correct-horse-battery-staple")
    assert hashed != "correct-horse-battery-staple"


def test_verify_password_accepts_the_correct_password():
    hashed = hash_password("correct-horse-battery-staple")
    assert verify_password("correct-horse-battery-staple", hashed) is True


def test_verify_password_rejects_the_wrong_password():
    hashed = hash_password("correct-horse-battery-staple")
    assert verify_password("wrong-password", hashed) is False


def test_same_password_hashes_differently_each_time():
    # bcrypt salts automatically -- two hashes of the same password must
    # never be equal, or a rainbow-table attack becomes trivial.
    assert hash_password("hunter2") != hash_password("hunter2")


def test_access_token_round_trips_its_claims():
    token = create_access_token({"sub": "user-1", "email": "a@b.com", "name": "A", "role": "user"})
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-1"
    assert payload["role"] == "user"


def test_decode_access_token_rejects_a_tampered_token():
    token = create_access_token({"sub": "user-1", "role": "user"})
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
    assert decode_access_token(tampered) is None


def test_decode_access_token_rejects_a_token_signed_with_a_different_secret():
    forged = jwt.encode({"sub": "user-1", "role": "admin"}, "some-other-secret", algorithm=settings.jwt_algorithm)
    assert decode_access_token(forged) is None


def test_decode_access_token_rejects_an_expired_token(monkeypatch):
    # Force a token that expired 1 minute ago and confirm it's rejected.
    from datetime import datetime, timedelta, timezone

    expired_payload = {
        "sub": "user-1",
        "role": "user",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    token = jwt.encode(expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    assert decode_access_token(token) is None
