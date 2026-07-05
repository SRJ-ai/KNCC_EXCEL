import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from .database import get_db
from .core.security import SECRET_KEY, ALGORITHM
from .models.user import User
from .models.organization import Organization

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = None
    # 1. Try decoding as Supabase JWT
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        except JWTError:
            pass
            
    # 2. Fallback to Local JWT
    if not payload:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            raise credentials_exception

    # Handle Supabase Payload (Supabase sets aud to "authenticated" or similar, but always provides email)
    if payload.get("email"):
        email = payload.get("email")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Auto-provision user from Supabase metadata
            meta = payload.get("user_metadata", {})
            org_name = meta.get("organization_name", "KNCC Organization")
            org = db.query(Organization).filter(Organization.name == org_name).first()
            if not org:
                org = Organization(name=org_name)
                db.add(org)
                db.commit()
                db.refresh(org)
            
            user = User(
                email=email,
                name=meta.get("name", "Engineer"),
                role=meta.get("role", "member"),
                organization_id=org.id,
                hashed_password="supabase_managed_auth" 
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
        
    # Handle Local Payload (relies on sub being an integer ID)
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    try:
        uid = int(user_id)
        user = db.query(User).filter(User.id == uid).first()
    except ValueError:
        raise credentials_exception

    if user is None or not user.is_active:
        raise credentials_exception
    return user

def get_current_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from .models.project import Project
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

