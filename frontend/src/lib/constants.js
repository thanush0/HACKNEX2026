export const MODES = [
  { id: 'FAST', icon: 'zap', title: 'FAST', model: 'Stable Diffusion', note: 'Speed priority', full: 'Stable Diffusion Inpainting' },
  { id: 'MEDIUM', icon: 'hex', title: 'MEDIUM', model: 'SDXL Inpainting', note: 'Quality / speed balance', full: 'SDXL Inpainting' },
  { id: 'MAX', icon: 'gem', title: 'MAX', model: 'SD → SDXL', note: 'Maximum reconstruction', full: 'Stable Diffusion → SDXL Refinement' },
]
export const STAGES = [
  ['analysis', 'IMAGE ANALYSIS'], ['mask', 'MASK ANALYSIS'], ['understanding', 'SCENE UNDERSTANDING'], ['generation', 'GENERATION'],
  ['refinement', 'REFINEMENT'], ['preservation', 'PRESERVATION'], ['verification', 'VERIFICATION'], ['complete', 'COMPLETE'],
]
export const BUTTON_PHASE = {
  analysis: 'INITIALIZING ENGINE', mask: 'INITIALIZING ENGINE', understanding: 'INITIALIZING ENGINE',
  generation: 'GENERATING', refinement: 'REFINING', preservation: 'REFINING', verification: 'VERIFYING', complete: 'COMPLETE',
}
export const SCHEDULERS = ['DPM++ 2M', 'Euler a', 'DDIM', 'UniPC']
export const RESOLUTIONS = [512, 768, 1024]
