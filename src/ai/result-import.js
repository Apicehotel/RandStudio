import { addClip, addMedia } from '../core/composition.js';

export function importAIResult(composition, { name = 'AI output', url, mime = 'video/mp4', duration = 5, at = 0, trackId } = {}) {
  if (!url) throw new Error('AI output url is required');
  const media = addMedia(composition, { name, type: mime.startsWith('image/') ? 'image' : 'video', url, duration });
  const targetTrack = trackId ?? composition.tracks.find((track) => track.kind === 'visual')?.id;
  if (!targetTrack) throw new Error('No visual track available for AI output');
  const clip = addClip(composition, targetTrack, media.id, { start: at, in: 0, out: duration });
  return { media, clip };
}
