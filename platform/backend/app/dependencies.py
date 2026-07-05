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
    supabase_secret = SUPABASE_JWT_SECRET.strip() if SUPABASE_JWT_SECRET else None
    supabase_err = "SUPABASE_JWT_SECRET is not set on the backend!" if not supabase_secret else None
    
    if supabase_secret:
        try:
            payload = jwt.decode(token, supabase_secret, algorithms=["HS256"], options={"verify_aud": False})
        except JWTError as e:
            supabase_err = f"JWT decode failed: {str(e)}"
            
    # 2. Fallback to Local JWT
    if not payload:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError as e:
            local_err = str(e)
            credentials_exception.detail = f"Could not validate credentials. Supabase Error: {supabase_err} | Local Error: {local_err}"
            raise credentials_exception

    # Handle Supabase Payload
    if payload.get("aud") == "authenticated" or "iss" in payload and "supabase" in payload["iss"]:
        email = payload.get("email") or payload.get("user_metadata", {}).get("email") or f"{payload.get('sub')}@supabase.user"
        
        # Auto-provision user/org if they don't exist
        user = db.query(User).filter(User.email == email).first()
        if not user:
            org = db.query(Organization).filter(Organization.name == "KNCC").first()
            if not org:
                org = Organization(name="KNCC")
                db.add(org)
                db.commit()
                db.refresh(org)
                
            user = User(
                email=email,
                name=payload.get("user_metadata", {}).get("name", "Supabase User"),
                role="admin",
                organization_id=org.id,
                hashed_password="auto-provisioned"
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

