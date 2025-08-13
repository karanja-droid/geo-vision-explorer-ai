"""API v1 Router

Main router for API version 1 endpoints.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import features, ai_inference, active_learning, drill_data

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(
    features.router, 
    prefix="/features", 
    tags=["features"]
)

api_router.include_router(
    ai_inference.router, 
    prefix="/ai", 
    tags=["ai-inference"]
)

api_router.include_router(
    active_learning.router, 
    prefix="/active-learning", 
    tags=["active-learning"]
)

api_router.include_router(
    drill_data.router, 
    prefix="/drill-data", 
    tags=["drill-data"]
)