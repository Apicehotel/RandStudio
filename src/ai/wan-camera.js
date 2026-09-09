export const CAMERA_MOTIONS = Object.freeze([
  'Static', 'Pan Up', 'Pan Down', 'Pan Left', 'Pan Right', 'Zoom In', 'Zoom Out',
]);

export const DRONE_PRESETS = Object.freeze({
  reveal: { label: 'Drone View / Reveal', motion: 'Zoom Out', speed: 1.0 },
  rise: { label: 'Drone Rise', motion: 'Pan Up', speed: 1.0 },
  approach: { label: 'Drone Approach', motion: 'Zoom In', speed: 0.8 },
  panLeft: { label: 'Pan Left', motion: 'Pan Left', speed: 1.0 },
  panRight: { label: 'Pan Right', motion: 'Pan Right', speed: 1.0 },
  panDown: { label: 'Pan Down', motion: 'Pan Down', speed: 1.0 },
  static: { label: 'Static', motion: 'Static', speed: 1.0 },
});

export function createWanCameraRequest({ prompt, motion = 'Zoom Out', width = 640, height = 640, length = 81, speed = 1, seed = -1, inputImageName = null } = {}) {
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (!CAMERA_MOTIONS.includes(motion)) throw new Error(`Unsupported camera motion: ${motion}`);
  if (![width, height].every((v) => Number.isInteger(v) && v >= 256 && v % 16 === 0)) throw new Error('width/height must be integers >= 256 and multiples of 16');
  if (!Number.isInteger(length) || length < 9) throw new Error('length must be >= 9 frames');
  if (!(speed > 0)) throw new Error('speed must be > 0');
  return { schema: 'randstudio.wan-camera/v1', prompt: prompt.trim(), motion, width, height, length, speed, seed, inputImageName };
}

export function bindWanCameraWorkflow(apiWorkflow, request, bindings) {
  const workflow = structuredClone(apiWorkflow);
  const set = (binding, value, { optional = false } = {}) => {
    if (value == null && optional) return;
    const [nodeId, input] = binding ?? [];
    if (!nodeId || !workflow[nodeId]?.inputs || !(input in workflow[nodeId].inputs)) {
      if (optional) return;
      throw new Error(`Invalid Wan binding: ${nodeId ?? 'missing'}.${input ?? 'missing'}`);
    }
    workflow[nodeId].inputs[input] = value;
  };
  set(bindings.prompt, request.prompt);
  set(bindings.motion, request.motion);
  set(bindings.width, request.width);
  set(bindings.height, request.height);
  set(bindings.length, request.length);
  set(bindings.speed, request.speed);
  if (bindings.seed) set(bindings.seed, request.seed, { optional: true });
  if (bindings.image) set(bindings.image, request.inputImageName, { optional: true });
  return workflow;
}

export function discoverWanCameraBindings(apiWorkflow) {
  const nodes = Object.entries(apiWorkflow || {});
  const camera = nodes.find(([, node]) => node?.class_type === 'WanCameraEmbedding');
  if (!camera) throw new Error('WanCameraEmbedding node not found');
  const [cameraId, cameraNode] = camera;
  const promptNode = nodes.find(([, node]) => node?.class_type === 'CLIPTextEncode' && /positive|prompt/i.test(node?._meta?.title || '')) || nodes.find(([, node]) => node?.class_type === 'CLIPTextEncode');
  if (!promptNode) throw new Error('CLIPTextEncode prompt node not found');
  const imageNode = nodes.find(([, node]) => node?.class_type === 'LoadImage');
  const key = (obj, candidates) => candidates.find((candidate) => candidate in (obj?.inputs || {}));
  const bindings = {
    prompt: [promptNode[0], key(promptNode[1], ['text']) || 'text'],
    motion: [cameraId, key(cameraNode, ['camera_motion', 'motion', 'cameraMotion']) || 'camera_motion'],
    width: [cameraId, key(cameraNode, ['width']) || 'width'],
    height: [cameraId, key(cameraNode, ['height']) || 'height'],
    length: [cameraId, key(cameraNode, ['length', 'frames']) || 'length'],
    speed: [cameraId, key(cameraNode, ['speed']) || 'speed'],
  };
  const seedKey = key(cameraNode, ['seed', 'noise_seed']);
  if (seedKey) bindings.seed = [cameraId, seedKey];
  if (imageNode) bindings.image = [imageNode[0], key(imageNode[1], ['image']) || 'image'];
  return bindings;
}
