import { addClip } from '../core/composition.js';

export function importAIResult(project, { name = 'AI output', url, mime = 'video/mp4', duration = 5, at = 0, trackId } = {}) {
  if (!url) throw new Error('AI output url is required');
  const targetTrack = trackId ?? project.tracks.find((track) => track.kind === 'visual')?.id;
  if (!targetTrack) throw new Error('No visual track available for AI output');
  const type = mime.startsWith('image/') ? 'image' : 'video';
  const next = addClip(project, targetTrack, {
    type,
    name,
    sourceId: url,
    sourceName: name,
    start: at,
    in: 0,
    out: duration,
    duration,
    effects: [{ type: 'ai-generated', provider: 'comfyui' }],
  });
  const clip = next.tracks.find((track) => track.id === targetTrack).clips.find((item) => item.sourceId === url);
  return { project: next, clip };
}
