# Rand Design System v1

## Principles
1. Editor-first: canvas/timeline remain the visual focus.
2. One component language across desktop and mobile.
3. Dense where needed, never cramped.
4. Safe-area aware on iOS.
5. Large Mode is a first-class accessibility mode.
6. Motion is functional, not decorative.
7. Effects and AI are engines, not UI-specific hacks.

## Tokens
- `--bg`, `--surface`, `--surface-2`, `--surface-3`
- `--line`, `--line-soft`
- `--text`, `--muted`
- `--accent`, `--accent-2`
- semantic `--success`, `--danger`
- `--radius`, `--radius-sm`, `--control`

## Page templates
- Editor: rail + library + preview + inspector + timeline
- Library: filters + media list/grid + preview
- AI Lab: input + job queue + preview/output
- Settings: navigation + grouped form sections
- Projects: list + detail + recent activity
- Export: queue + format settings + completed exports

## Effects contract
Effects live on `clip.effects`. UI reads definitions; preview and export use separate renderer functions. This keeps future WebGPU/Rust/WASM integrations possible without changing project documents.
