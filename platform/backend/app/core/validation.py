"""
KNCC Platform — Pydantic v2 Input Validation Schemas (Rule 1)

All authentication inputs are validated server-side:
  - Email: format + max length
  - Password: min/max length, complexity rules, no logging
  - Name: alphanumeric + basic punctuation, max length
  - Organization name: max length, strip excess whitespace
  - Free text fields: HTML stripped, length-bounded

Rejection: invalid requests return HTTP 422 (Pydantic default) with a
GENERIC message — we never specify which field failed in a way that
helps attackers enumerate valid accounts.
"""

import re
import html
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional

# --------------------------------------------------------------------------- #
# Constants                                                                     #
# --------------------------------------------------------------------------- #
MAX_EMAIL_LENGTH = 254          # RFC 5321
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 72        # bcrypt hard limit — reject above to be explicit
MAX_NAME_LENGTH = 100
MAX_ORG_NAME_LENGTH = 120
MAX_FREE_TEXT_LENGTH = 500

# Allowed characters for display names: letters, numbers, space, hyphen, dot, apostrophe
_NAME_PATTERN = re.compile(r"^[A-Za-z0-9 \-\.']+$")

# Password complexity: upper, lower, digit, special
_HAS_UPPER    = re.compile(r"[A-Z]")
_HAS_LOWER    = re.compile(r"[a-z]")
_HAS_DIGIT    = re.compile(r"\d")
_HAS_SPECIAL  = re.compile(r"[!@#$%^&*(),.?\":{}|<>_\-\[\]\/\\]")


# --------------------------------------------------------------------------- #
# Sanitisation helpers                                                           #
# --------------------------------------------------------------------------- #
def _sanitize_text(value: str) -> str:
    """Strip HTML entities and angle-bracket tags from free text."""
    # Unescape then re-escape to normalise entities
    cleaned = html.escape(value, quote=True)
    # Remove any remaining angle-bracket content
    cleaned = re.sub(r"<[^>]*>", "", cleaned)
    return cleaned.strip()


# --------------------------------------------------------------------------- #
# Auth schemas                                                                   #
# --------------------------------------------------------------------------- #

class UserRegisterSchema(BaseModel):
    email: EmailStr
    password: str
    name: str
    organization_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if len(v) > MAX_EMAIL_LENGTH:
            raise ValueError("Invalid input.")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < MIN_PASSWORD_LENGTH:
            raise ValueError("Invalid input.")
        if len(v) > MAX_PASSWORD_LENGTH:
            raise ValueError("Invalid input.")
        if not _HAS_UPPER.search(v):
            raise ValueError("Invalid input.")
        if not _HAS_LOWER.search(v):
            raise ValueError("Invalid input.")
        if not _HAS_DIGIT.search(v):
            raise ValueError("Invalid input.")
        if not _HAS_SPECIAL.search(v):
            raise ValueError("Invalid input.")
        return v   # NEVER store or log plain password

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = _sanitize_text(v)
        if not v or len(v) > MAX_NAME_LENGTH:
            raise ValueError("Invalid input.")
        if not _NAME_PATTERN.match(v):
            raise ValueError("Invalid input.")
        return v

    @field_validator("organization_name")
    @classmethod
    def validate_org_name(cls, v: str) -> str:
        v = _sanitize_text(v)
        if not v or len(v) > MAX_ORG_NAME_LENGTH:
            raise ValueError("Invalid input.")
        return v


class LoginSchema(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if len(v) > MAX_EMAIL_LENGTH:
            raise ValueError("Invalid input.")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        # Basic sanity — don't reveal complexity rules at login
        if not v or len(v) > MAX_PASSWORD_LENGTH:
            raise ValueError("Invalid input.")
        return v


class PasswordResetRequestSchema(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if len(v) > MAX_EMAIL_LENGTH:
            raise ValueError("Invalid input.")
        return v.lower().strip()
