export const ERRORS = {
  NO_IMAGE: ['No image selected', 'Import an image to start reconstructing.'],
  NO_MASK: ['No mask detected', 'Paint over the area you want rebuilt with the brush, then reconstruct again.'],
  MASK_TOO_SMALL: ['Mask is too small', 'The painted area covers under 0.1% of the image. Paint a larger region.'],
  BACKEND_UNAVAILABLE: ['Backend unavailable', 'SCENERA could not reach the reconstruction server. Check that it is running, then try again.'],
  GPU_UNAVAILABLE: ['GPU unavailable', 'The server has no free GPU right now. Wait a moment and retry.'],
  GENERATION_FAILED: ['Generation failed', 'The reconstruction did not finish. Adjust the mask or settings and try again.'],
  UNSUPPORTED_FILE: ['Unsupported file', 'Use a PNG, JPG, JPEG or WEBP image.'],
  IMAGE_TOO_LARGE: ['Image too large', 'Use an image under 25 MB and 8192 px on its longest side.'],
  DOWNLOAD_FAILED: ['Download failed', 'The file could not be saved. Try again.'],
}
export class ApiError extends Error { constructor(code) { super(code); this.code = code } }
/** Raw errors go to the console only; users always get a plain message. */
export function toUserError(e) {
  if (e && !(e instanceof ApiError)) console.error('[scenera]', e)
  const code = ERRORS[e?.code] ? e.code : 'GENERATION_FAILED'
  return { code, title: ERRORS[code][0], message: ERRORS[code][1] }
}
