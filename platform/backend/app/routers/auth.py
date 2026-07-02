"""
KNCC Platform — Hardened Auth Router
Applies all 5 security rules from the KNCC Security Guide:

  Rule 1: Server-side validation via core.validation schemas (Pydantic)
  Rule 2: Rate limiting + account lockout via core.rate_limit
  Rule 3: bcrypt password hashing via core.security
  Rule 4: Generic error messages — same response for "email not found"
          vs. "wrong password"; timing equalised via dummy_verify()
  Rule 5: Supabase Auth is the primary auth provider for the frontend;
          this backend only handles service-to-service / API auth flows.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.organization import Organization
from ..core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    dummy_verify,
)
from ..core.rate_limit import (
    check_ip_rate_limit,
    check_account_lockout,
    record_failed_attempt,
    clear_failed_attempts,
    apply_progressive_delay,
    RateLimitError,
    AccountLockedError,
)
from ..core.validation import UserRegisterSchema, LoginSchema
from ..dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# --------------------------------------------------------------------------- #
# Generic error messages (Rule 4)                                               #
# These strings are intentionally identical for both failure branches.          #
# --------------------------------------------------------------------------- #
_GENERIC_AUTH_ERROR = "Incorrect email or password."
_GENERIC_RESET_MSG = "If that email is registered, you'll receive a password reset link."
_GENERIC_REGISTER_MSG = "Check your inbox to complete signup."


# --------------------------------------------------------------------------- #
# POST /register                                                                 #
# --------------------------------------------------------------------------- #
class Token:
    pass


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: Request, user_in: UserRegisterSchema, db: Session = Depends(get_db)):
    """
    Rule 1: Input validated and sanitised by UserRegisterSchema.
    Rule 3: Password is hashed with bcrypt; never stored or logged in plain text.
    Rule 4: Does NOT reveal whether the email is already registered
            (returns the same generic message and triggers a verification
            email flow in production).
    """
    client_ip = request.client.host if request.client else "unknown"

    # Rule 2: IP-level rate limiting at registration too (prevents bulk account creation)
    try:
        check_ip_rate_limit(client_ip)
    except RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    # Check if user exists — but return the SAME response either way (Rule 4)
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        # Don't reveal the account exists — just pretend we sent a verification email.
        logger.info("Register attempt for already-registered email (not disclosed to caller).")
        return {"message": _GENERIC_REGISTER_MSG}

    # Find or create organisation
    org = db.query(Organization).filter(Organization.name == user_in.organization_name).first()
    if not org:
        org = Organization(name=user_in.organization_name)
        db.add(org)
        db.commit()
        db.refresh(org)
        role = "admin"
    else:
        role = "member"

    # Rule 3: Hash password with bcrypt (never log plain password)
    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),  # user_in.password NOT logged
        name=user_in.name,
        organization_id=org.id,
        role=role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info("New user registered: id=%s email=%s role=%s", new_user.id, new_user.email, role)

    return {"message": _GENERIC_REGISTER_MSG}


# --------------------------------------------------------------------------- #
# POST /login                                                                   #
# --------------------------------------------------------------------------- #
@router.post("/login")
async def login(
    request: Request,
    login_in: LoginSchema,
    db: Session = Depends(get_db),
):
    """
    Rule 1: Input validated by LoginSchema.
    Rule 2: IP rate-limit + account lockout + progressive delay.
    Rule 3: bcrypt constant-time comparison.
    Rule 4: Identical response and timing for missing-email vs wrong-password.
    """
    client_ip = request.client.host if request.client else "unknown"

    # ---- Rule 2: IP rate limit -------------------------------------------- #
    try:
        check_ip_rate_limit(client_ip)
    except RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    # ---- Rule 2: Account lockout ------------------------------------------ #
    try:
        check_account_lockout(login_in.email)
    except AccountLockedError:
        # Rule 4: Do NOT tell caller the account is locked specifically
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_GENERIC_AUTH_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ---- Rule 4: Look up user --------------------------------------------- #
    user = db.query(User).filter(User.email == login_in.email).first()

    if not user:
        # Rule 4: Equalise timing — run a dummy bcrypt check so response time
        # is indistinguishable from a valid-email/wrong-password case.
        dummy_verify()
        fail_count = record_failed_attempt(login_in.email)
        await apply_progressive_delay(fail_count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_GENERIC_AUTH_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ---- Rule 3: Constant-time password comparison ----------------------- #
    password_ok = verify_password(login_in.password, user.hashed_password)

    if not password_ok or not user.is_active:
        fail_count = record_failed_attempt(login_in.email)
        await apply_progressive_delay(fail_count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_GENERIC_AUTH_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ---- Success ---------------------------------------------------------- #
    clear_failed_attempts(login_in.email)

    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    access_token = create_access_token(data={"sub": str(user.id), "org_id": str(org.id)})

    logger.info("Successful login: user_id=%s ip=%s", user.id, client_ip)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role},
        "organization": {"id": org.id, "name": org.name},
    }


# --------------------------------------------------------------------------- #
# POST /forgot-password                                                         #
# --------------------------------------------------------------------------- #
@router.post("/forgot-password")
async def forgot_password(request: Request, db: Session = Depends(get_db)):
    """
    Rule 4: Always returns the same generic response regardless of
            whether the email exists in the database.
    """
    from ..core.validation import PasswordResetRequestSchema
    from fastapi import Body

    # We accept a JSON body; validation is done inline for this endpoint
    body = await request.json()
    try:
        schema = PasswordResetRequestSchema(**body)
    except Exception:
        # Even on validation failure — return generic message (Rule 4)
        return {"message": _GENERIC_RESET_MSG}

    client_ip = request.client.host if request.client else "unknown"
    try:
        check_ip_rate_limit(client_ip)
    except RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    user = db.query(User).filter(User.email == schema.email).first()
    if user:
        # TODO: Send a real password-reset email here via SendGrid / Resend / SMTP
        logger.info("Password reset requested for: user_id=%s", user.id)
    else:
        logger.info("Password reset requested for non-existent email (not disclosed).")

    # Rule 4: Same response regardless of outcome
    return {"message": _GENERIC_RESET_MSG}


# --------------------------------------------------------------------------- #
# GET /me                                                                       #
# --------------------------------------------------------------------------- #
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
        },
        "organization": {"id": org.id, "name": org.name},
    }
