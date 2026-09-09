# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering, effetti, grafica, motion, sottotitoli, velocità, persistenza e AI.

## Point 1 — motore editor
- timeline visual/audio multi-track
- clip start/end + source in/out, trim, split, move e delete
- undo/redo e progetto `.randstudio.json`
- compiler `Composition JSON -> FFmpeg argv`
- adapter `@ffmpeg/ffmpeg` sostituibile
- CI GitHub Actions

## Point 2 — AI Lab
AI tramite registry/provider, ComfyUI locale o gateway remoto. Contratto Wan Camera con Drone Reveal/Rise/Approach e output reinseribile in timeline. Per la generazione reale serve un runtime esterno raggiungibile; il repository non incorpora pesi multi-GB né credenziali.

## Point 3 — Rand Design System + Effects Engine
- responsive + safe-area iOS + modalità Grande
- WebGPU/fallback browser
- FFmpeg autorevole
- LUT3D e keyframe
- Clean, Cinema, Cinema Pro, Dreamy Glow, Vivid, B/N, VHS, NTSC, Glitch
- luminosità, contrasto, saturazione, grayscale, blur, glow, vignetta, grain, glitch, VHS, NTSC, scanlines

AiyaEffectsIOS, VideoBeautify e `ntsc-rs` sono riferimenti architetturali, non dipendenze copiate.

## Point 4 — Advanced Runtime
WebGPU preview, LUT `.cube`, keyframe, IndexedDB/relink e AI Provider Registry.

## Point 5 — Text / Sticker / Overlay Engine
`src/graphics/overlay-engine.js` rende Titoli, Lower Third, Callout, Frecce, sticker emoji/PNG/SVG e Light Leak vere clip della Composition. Il payload resta editabile e viene rasterizzato Canvas -> PNG trasparente prima dell'export FFmpeg.

## Point 6 — Motion FX
`src/graphics/motion-engine.js` usa `randstudio.motion/v1`. Preset Fade, Slide Up, Slide Left, Pop e Bounce. Inclusi Freeze Frame, Split Screen e velocità costante 0.5×/2×.

## Point 7 — Caption Engine / sottotitoli smart
`src/captions/caption-engine.js` usa `randstudio.caption/v1`.

- SRT/WebVTT import/export
- track `Sottotitoli`
- Clean, Social Pop, Karaoke, Minimal
- chunk social automatici
- word timestamps e parola attiva
- trascrizione con Whisper.cpp locale configurabile o AI Gateway `/transcribe`
- transcript persistente e caption FFmpeg tramite Overlay Engine
- mapping trim/playback rate corretto

`whisper.cpp` è usato come riferimento/provider locale; l'architettura resta pronta per un adapter WebAssembly browser futuro senza cambiare il Caption Engine.

## Point 8 — Speed Ramp Engine

`src/core/speed-ramp.js` introduce `randstudio.speed-ramp/v1`: la velocità non è più solo un numero costante ma una curva normalizzata nel tempo sorgente.

### Preset
- Accelera
- Rallenta
- Punch
- Slow-Mo Focus
- Speed Up
- curva personalizzata Start / Centro / Fine

### Rendering
La curva continua viene campionata in micro-segmenti deterministici (12 di default, 16 per la curva personalizzata). Ogni segmento viene renderizzato con la propria velocità e poi ricomposto da FFmpeg.

```text
speed curve
    |
    v
sample curve -> source segments
    |              |
    |              +--> video setpts
    |              +--> audio atempo
    v
concat segments -> effects/LUT/motion -> timeline overlay -> export
```

Questo approccio evita espressioni `setpts` fragili, rende l'output riproducibile e permette di aumentare la precisione fino a 48 segmenti senza cambiare il formato progetto.

### Coerenza timeline
- durata clip ricalcolata dall'integrale segmentato della curva
- trim ricalcola la durata
- split converte correttamente timeline -> source time
- preview converte timeline -> source time
- sottotitoli convertono source time -> timeline, quindi restano sincronizzati anche col ramp
- audio usa catene `atempo` valide anche per velocità 0.25×–4×
- applicare una velocità costante rimuove esplicitamente il ramp precedente

## Architettura
```text
src/
├── app.js
├── styles.css
├── advanced.css
├── core/
│   ├── composition.js
│   ├── history.js
│   ├── ffmpeg-compiler.js
│   └── speed-ramp.js
├── effects/
│   ├── effects-engine.js
│   ├── keyframes.js
│   ├── lut.js
│   └── webgpu-renderer.js
├── graphics/
│   ├── overlay-engine.js
│   └── motion-engine.js
├── captions/
│   ├── caption-engine.js
│   └── transcription-provider.js
├── persistence/
│   └── indexeddb.js
├── ai/
│   ├── job-queue.js
│   ├── wan-camera.js
│   ├── result-import.js
│   └── provider-registry.js
└── adapters/
    ├── ffmpeg-wasm.js
    └── comfyui.js
```

## Avvio e test
```bash
npm install
npm run dev
npm test
npm run check
npm run build
```

## Sicurezza e workflow
- nessuna API key nel client
- nessun upload automatico fuori dalle azioni esplicite di provider
- non esporre runtime locali direttamente a Internet
- ogni modifica agente: branch dedicata + Pull Request
- nessun agente scrive o deploya direttamente su `main`

## Stato / prossimi blocchi prodotto
Completati editor, AI architecture, design/effects, persistence, text/sticker, Motion FX, Caption Engine e Speed Ramp. Restano soprattutto:
- kinetic text / typewriter avanzato
- sticker animati video/GIF
- easing editor e più keyframe
- preview composita multi-layer completa
- tracking testo/sticker su oggetti
- maschere, object/background removal, upscale
- adapter Whisper.cpp WASM browser opzionale
- workflow AI video reali preconfigurati quando viene scelto il runtime/provider definitivo

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Prima di distribuire pubblicamente verificare separatamente licenze di FFmpeg, Whisper.cpp/modelli Whisper, modelli AI, LUT, font, asset e ogni eventuale codice esterno incorporato.
