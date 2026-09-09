# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering, effetti, grafica, motion, sottotitoli, persistenza e AI.

## Point 1 — motore editor
- timeline visual/audio multi-track
- clip start/end + source in/out, trim, split, move e delete
- undo/redo e progetto `.randstudio.json`
- compiler `Composition JSON -> FFmpeg argv`
- adapter `@ffmpeg/ffmpeg` sostituibile
- CI GitHub Actions

## Point 2 — AI Lab
L'AI passa attraverso adapter, registry provider e job; non viene hard-coded nell'editor. Sono predisposti ComfyUI locale, AI Gateway remoto, contratto `randstudio.wan-camera/v1`, Drone Reveal/Rise/Approach e reinserimento output AI come clip.

Per generare realmente serve almeno un runtime esterno raggiungibile. Il repository non incorpora pesi multi-GB né credenziali.

## Point 3 — Rand Design System + Effects Engine
- app shell responsive con safe-area iOS e modalità Grande
- WebGPU/fallback browser
- export FFmpeg autorevole
- LUT3D e keyframe
- preset Clean, Cinema, Cinema Pro, Dreamy Glow, Vivid, B/N, VHS, NTSC, Glitch
- effetti luminosità, contrasto, saturazione, grayscale, blur, glow, vignetta, film grain, glitch, VHS, NTSC, scanlines

AiyaEffectsIOS, VideoBeautify e `ntsc-rs` restano riferimenti architetturali, non dipendenze copiate.

## Point 4 — Advanced Runtime
- WebGPU preview
- LUT `.cube`
- keyframe numerici
- IndexedDB/relink
- AI Provider Registry

## Point 5 — Text / Sticker / Overlay Engine
`src/graphics/overlay-engine.js` introduce elementi grafici come clip vere della Composition.

Inclusi:
- Titolo statico
- Lower third titolo + sottotitolo
- Callout
- Freccia
- sticker rapidi emoji
- sticker PNG/SVG importabili
- payload `randstudio.graphic/v1`
- rasterizzazione Canvas -> PNG trasparente per export FFmpeg stabile

Gli asset grafici generati vengono rigenerati dal payload e non duplicati permanentemente.

## Point 6 — Motion FX
`src/graphics/motion-engine.js` aggiunge un contratto `randstudio.motion/v1` applicabile a clip video, immagini e grafiche.

Preset: Fade, Slide Up, Slide Left, Pop, Bounce. Sono inoltre presenti Light Leak generato localmente, Glitch, Freeze Frame, Split Screen e playback 0.5×/2× con durata/compiler coerenti.

## Point 7 — Caption Engine / sottotitoli smart

`src/captions/caption-engine.js` introduce il contratto `randstudio.caption/v1`. La trascrizione non viene bruciata subito nel video: resta un dato strutturato e genera clip `caption` vere nella timeline.

### Funzioni
- import SRT
- import WebVTT
- export SRT
- export WebVTT
- normalizzazione segmenti e word timestamps
- track dedicata `Sottotitoli`
- preset Clean, Social Pop, Karaoke e Minimal
- chunk automatici per frasi brevi da Reel/TikTok
- safe placement verticale
- caption rasterizzate via Overlay Engine e incluse nell'export FFmpeg
- karaoke esportabile come successione di clip con parola attiva evidenziata
- persistenza del transcript nel progetto

### Trascrizione automatica
`src/captions/transcription-provider.js` aggiunge un registry STT separato dall'editor:

```text
clip audio/video
   |
   v
TranscriptionProviderRegistry
   |                     |
   v                     v
Whisper.cpp locale    AI Gateway STT
   |                     |
   +------ transcript ----+
              |
              v
     randstudio.caption/v1
              |
              v
       Caption track
```

Il provider locale è pensato per `whisper.cpp`: il progetto upstream offre anche un esempio WebAssembly/browser, quindi in futuro RandStudio può aggiungere inferenza totalmente browser senza cambiare il Caption Engine. Oggi il percorso locale supportato è un endpoint whisper.cpp raggiungibile (default `127.0.0.1:8080`) oppure il nostro gateway `/transcribe`.

Il client non contiene API key. Il gateway remoto riceve il file con `multipart/form-data` e restituisce segmenti/word timestamps normalizzati.

## Architettura
```text
src/
├── app.js
├── styles.css
├── advanced.css
├── core/
│   ├── composition.js
│   ├── history.js
│   └── ffmpeg-compiler.js
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
- non esporre ComfyUI/Whisper locale direttamente a Internet
- ogni modifica agente: branch dedicata + Pull Request
- nessun agente scrive o deploya direttamente su `main`

## Stato / prossimi blocchi prodotto
Caption Engine e styling social sono operativi. Restano evoluzioni di livello superiore:
- kinetic text / typewriter avanzato
- speed ramp continuo/curve avanzate
- sticker animati video/GIF
- easing editor e più keyframe
- preview composita multi-layer completa per split-screen
- tracking testo/sticker su oggetti
- maschere, object/background removal, upscale
- adapter whisper.cpp WASM completamente browser opzionale
- workflow AI video reali preconfigurati quando viene scelto il runtime/provider definitivo

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Prima di distribuire pubblicamente verificare separatamente licenze di FFmpeg, whisper.cpp/modelli Whisper, modelli AI, LUT, font, asset e ogni eventuale codice esterno incorporato.
