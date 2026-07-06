import os
import base64
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .database import get_db
from .core.security import SECRET_KEY, ALGORITHM
from .models.user import User
from .models.organization import Organization

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Supabase signs JWTs using the base64-decoded bytes of the secret
_raw_supabase_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
try:
    SUPABASE_JWT_SECRET = base64.b64decode(_raw_supabase_secret) if _raw_supabase_secret else None
except Exception:
    SUPABASE_JWT_SECRET = _raw_supabase_secret.encode() if _raw_supabase_secret else None


def _get_or_create_org(db: Session) -> Organization:
    """Get or create KNCC organization, safely handling race conditions."""
    org = db.query(Organization).filter(Organization.name == "KNCC").first()
    if org:
        return org
    try:
        org = Organization(name="KNCC")
        db.add(org)
        db.commit()
        db.refresh(org)
        return org
    except IntegrityError:
        db.rollback()
        # Another instance created it in parallel — just fetch it
        return db.query(Organization).filter(Organization.name == "KNCC").first()


def _get_or_create_user(db: Session, uid: int, email: str, name: str, org_id: int) -> User:
    """Get or create user, safely handling race conditions."""
    user = db.query(User).filter(User.id == uid).first()
    if user:
        return user
    try:
        user = User(
            id=uid,
            email=email,
            name=name,
            role="admin",
            organization_id=org_id,
            hashed_password="auto-provisioned-local"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        # Another instance created it in parallel — just fetch it
        return db.query(User).filter(User.id == uid).first()


def _get_or_create_supabase_user(db: Session, email: str, name: str, org_id: int) -> User:
    """Get or create Supabase user, safely handling race conditions."""
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    try:
        user = User(
            email=email,
            name=name,
            role="admin",
            organization_id=org_id,
            hashed_password="auto-provisioned"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        return db.query(User).filter(User.email == email).first()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode without verification first to check if it's a Supabase token
        unverified = jwt.decode(token, options={"verify_signature": False, "verify_audience": False})
    except jwt.PyJWTError:
        raise credentials_exception

    is_supabase = unverified.get("aud") == "authenticated" or ("iss" in unverified and "supabase" in unverified.get("iss", ""))
    
    if is_supabase:
        payload = unverified
        user_metadata = payload.get("user_metadata") or {}
        email = payload.get("email") or user_metadata.get("email") or f"{payload.get('sub')}@supabase.user"
        name = user_metadata.get("name", "Supabase User")
        
        org = _get_or_create_org(db)
        user = _get_or_create_supabase_user(db, email, name, org.id)
        
        if user is None:
            raise credentials_exception
        return user

    # Handle Local Payload
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_audience": False})
    except jwt.PyJWTError:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        raise credentials_exception

    user = db.query(User).filter(User.id == uid).first()
    if user is None:
        # Auto-provision missing local user
        if uid == 1:
            email, name = "admin@kncc.com", "Admin User"
        elif uid == 2:
            email, name = "demo@kncc.com", "Demo Engineer"
        else:
            email, name = f"user_{uid}@kncc.com", f"Legacy User {uid}"

        org = _get_or_create_org(db)
        user = _get_or_create_user(db, uid, email, name, org.id)

    if user is None or not user.is_active:
        raise credentials_exception
    
    return user


def get_current_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from .models.project import Project
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
