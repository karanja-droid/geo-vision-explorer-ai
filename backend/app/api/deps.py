"""API Dependencies

Common dependencies for API endpoints including database sessions,
authentication, and authorization.
"""

from typing import Dict, Optional, Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt
from jwt import PyJWTError

from app.database import SessionLocal
from app.core.config import settings

# Security scheme
security = HTTPBearer()


def get_db() -> Generator[Session, None, None]:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # For now, return a mock user
        # In production, this would decode and validate the JWT token
        token = credentials.credentials
        
        # Mock user data
        user_data = {
            "user_id": "test-user-123",
            "email": "test@example.com",
            "org_id": "test-org-456",
            "role": "analyst",
            "permissions": ["read", "write", "ai_inference"]
        }
        
        return user_data
        
    except PyJWTError:
        raise credentials_exception


def get_current_active_user(
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """Get current active user (not disabled)"""
    if current_user.get("disabled"):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_permission(permission: str):
    """Dependency factory for requiring specific permissions"""
    def permission_checker(
        current_user: Dict = Depends(get_current_active_user)
    ) -> Dict:
        user_permissions = current_user.get("permissions", [])
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        return current_user
    
    return permission_checker


def require_role(required_role: str):
    """Dependency factory for requiring specific roles"""
    def role_checker(
        current_user: Dict = Depends(get_current_active_user)
    ) -> Dict:
        user_role = current_user.get("role")
        
        # Define role hierarchy
        role_hierarchy = {
            "viewer": 0,
            "analyst": 1,
            "admin": 2,
            "super_admin": 3
        }
        
        user_level = role_hierarchy.get(user_role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' or higher required"
            )
        return current_user
    
    return role_checker