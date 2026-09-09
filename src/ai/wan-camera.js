export const CAMERA_MOTIONS = Object.freeze([
  'Static', 'Pan Up', 'Pan Down', 'Pan Left', 'Pan Right', 'Zoom In', 'Zoom Out',
]);

export const DRONE_PRESETS = Object.freeze({
  reveal: { motion: 'Zoom Out', speed: 1.0 },
  rise: { motion: 'Pan Up', speed: 1.0 },
  approach: { motion: 'Zoom In', speed: 0.8 },
});

export function createWanCameraRequest({ prompt, motion = 'Zoom Out', width = 640, height = 640, length = 81, speed = 1, seed = -1 } = {}) {
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (!CAMERA_MOTIONS.includes(motion)) throw new Error(`Unsupported camera motion: ${motion}`);
  if (![width, height].every((v) => Number.isInteger(v) && v >= 256 && v % 16 === 0)) throw new Error('width/height must be integers >= 256 and multiples of 16');
  if (!Number.isInteger(length) || length < 9) throw new Error('length must be >= 9 frames');
  if (!(speed > 0)) throw new Error('speed must be > 0');
  return { schema: 'randstudio.wan-camera/v1', prompt: prompt.trim(), motion, width, height, length, speed, seed };
}

// Workflow templates change over time. RandStudio stores semantic bindings instead of hard-coded node ids.
export function bindWanCameraWorkflow(apiWorkflow, request, bindings) {
  const workflow = structuredClone(apiWorkflow);
  const set = (binding, value) => {
    const [nodeId, input] = binding ?? [];
    if (!nodeId || !workflow[nodeId]?.inputs || !(input in workflow[nodeId].inputs)) throw new Error(`Invalid Wan binding: ${nodeId ?? 'missing'}.${input ?? 'missing'}`);
    workflow[nodeId].inputs[input] = value;
  };
  set(bindings.prompt, request.prompt);
  set(bindings.motion, request.motion);
  set(bindings.width, request.width);
  set(bindings.height, request.height);
  set(bindings.length, request.length);
  set(bindings.speed, request.speed);
  if (bindings.seed) set(bindings.seed, request.seed);
  return workflow;
}
