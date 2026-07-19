"""
Module 1: User Authentication
Secure registration/login, bcrypt password hashing, JWT issuance.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app.config import settings
from app.database import users_col
from app.rate_limit import limiter
from app.models import AuthResponse, LoginRequest, RegisterRequest, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
@limiter.limit(settings.rate_limit_auth)
async def register(request: Request, payload: RegisterRequest):
    existing = await users_col().find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

    user_doc = {
        "id": f"user-{uuid.uuid4().hex[:12]}",
        "email": payload.email.lower(),
        "name": payload.name,
        # Public self-registration can NEVER create an admin account.
        # Admins are created only via the protected /api/admin/users endpoint.
        "role": "user",
        "password_hash": hash_password(payload.password),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await users_col().insert_one(user_doc)

    token = create_access_token({"sub": user_doc["id"], "email": user_doc["email"], "name": user_doc["name"], "role": user_doc["role"]})
    return AuthResponse(token=token, user=UserOut(id=user_doc["id"], email=user_doc["email"], name=user_doc["name"], role=user_doc["role"]))


@router.post("/login", response_model=AuthResponse)
@limiter.limit(settings.rate_limit_auth)
async def login(request: Request, payload: LoginRequest):
    user = await users_col().find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]})
    return AuthResponse(token=token, user=UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"]))
