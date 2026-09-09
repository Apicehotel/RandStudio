export function normalizeKeyframes(list = []) {
  return [...list]
    .map((item) => ({ time: Math.max(0, Number(item.time) || 0), value: Number(item.value) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => a.time - b.time);
}

export function interpolateKeyframes(list, time, fallback = 0) {
  const frames = normalizeKeyframes(list);
  if (!frames.length) return fallback;
  if (time <= frames[0].time) return frames[0].value;
  if (time >= frames.at(-1).time) return frames.at(-1).value;
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / Math.max(1e-9, b.time - a.time);
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

export function setKeyframe(effect, param, time, value) {
  const next = structuredClone(effect);
  next.keyframes ??= {};
  const frames = normalizeKeyframes(next.keyframes[param] ?? []).filter((frame) => Math.abs(frame.time - time) > 1e-6);
  frames.push({ time: Math.max(0, Number(time) || 0), value: Number(value) });
  next.keyframes[param] = normalizeKeyframes(frames);
  return next;
}

export function evaluateEffect(effect, localTime = 0) {
  const next = structuredClone(effect);
  for (const [param, frames] of Object.entries(effect.keyframes ?? {})) {
    next.params[param] = interpolateKeyframes(frames, localTime, next.params[param]);
  }
  return next;
}
