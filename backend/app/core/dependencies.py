from fastapi import Request

from app.services.reconstruction_service import ReconstructionService
from app.services.system_service import SystemService
from app.services.video_service import VideoService


def get_reconstruction_service(request: Request) -> ReconstructionService:
    return request.app.state.reconstruction_service


def get_system_service(request: Request) -> SystemService:
    return request.app.state.system_service


def get_video_service(request: Request) -> VideoService:
    return request.app.state.video_service
