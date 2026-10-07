from fastapi import APIRouter, Depends

from app.core.dependencies import get_system_service
from app.services.system_service import SystemService

router = APIRouter(tags=["system"])


@router.get("/system", summary="System and GPU status")
async def system(service: SystemService = Depends(get_system_service)):
    return service.status()
