"""
KNCC Platform Security Core
Rule 3: Password hashing with bcrypt (strong cost factor)
         - Constant-time comparison (bcrypt.checkpw is already constant-time)
         - Passwords never logged or stored in plain text
"""
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
import logging
import os
import jwt

from ..config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

logger = logging.getLogger(__name__)

# Cost factor: tuned for ~250ms on modern hardware.
# DO NOT lower below 12.
BCRYPT_ROUNDS = 12


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt with a strong cost factor.
    Never logs the password. Uses built-in per-password salting."""
    # Reject oversized passwords — bcrypt silently truncates at 72 bytes,
    # which is a DoS vector and confuses users.
    if len(password) > 72:
        raise ValueError("Password must not exceed 72 characters.")
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time password comparison using bcrypt.checkpw.
    Returns False (never raises) so callers cannot leak timing info."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        # Never log plain_password
        logger.warning("Password verification error (malformed hash stored?)")
        return False


def dummy_verify() -> None:
    """Run a fake bcrypt check to equalise response time when a user
    email is not found, preventing timing-based enumeration (Rule 4)."""
    _DUMMY_HASH = "$2b$12$Kix96/u6v5P2GqVHxNX9IOKq4GYiGbxsZ07hmXxXx0J2YT8JxUvLS"
    bcrypt.checkpw(b"dummy_equalise_timing", _DUMMY_HASH.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
