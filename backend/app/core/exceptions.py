class SceneraError(Exception):
    code = "SCENERA_ERROR"
    status_code = 500

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.message = message


class InvalidImageError(SceneraError):
    code = "INVALID_IMAGE"
    status_code = 400


class InvalidMaskError(SceneraError):
    code = "INVALID_MASK"
    status_code = 400


class ModelUnavailableError(SceneraError):
    code = "MODEL_UNAVAILABLE"
    status_code = 503


class GPUOutOfMemoryError(SceneraError):
    code = "GPU_OUT_OF_MEMORY"
    status_code = 503


class ReconstructionError(SceneraError):
    code = "RECONSTRUCTION_ERROR"
    status_code = 500


class JobNotFoundError(SceneraError):
    code = "JOB_NOT_FOUND"
    status_code = 404


class FileTooLargeError(SceneraError):
    code = "FILE_TOO_LARGE"
    status_code = 413
