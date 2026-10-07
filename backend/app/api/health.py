from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check")
async def health() -> dict:
    return {"status": "ok", "service": "scenera-backend", "version": "1.0.0"}
