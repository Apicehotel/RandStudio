# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering, effetti, grafica, motion, persistenza e AI.

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

### Motion preset
- Fade
- Slide Up
- Slide Left
- Pop
- Bounce

La preview valuta il movimento nel browser; il compiler FFmpeg genera fade e coordinate overlay temporali per i preset supportati.

### Sticker animati
Gli sticker usano lo stesso Motion Engine; quelli rapidi partono con preset Pop e possono essere sostituiti con Fade/Slide/Bounce.

### Light Leak
Il Light Leak viene generato localmente via Canvas come PNG trasparente con gradienti e inserito come clip grafica. Nessun asset esterno obbligatorio.

### Glitch
Preset Glitch integrato nell'Effects Engine con chroma shift + noise in export FFmpeg e preview browser approssimata.

### Freeze frame
Il pulsante Freeze Frame cattura il frame corrente del video, lo salva come PNG locale/IndexedDB e lo inserisce in timeline come clip immagine.

### Split screen
Preset Sinistra/Destra impostano scala e posizione della clip. Due clip sovrapposte con i due preset producono uno split-screen nel render finale.

### Velocità
Controlli 0.5× / 2× aggiornano `playbackRate`, durata timeline e compiler FFmpeg. Il trim/split tiene conto del playback rate.

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
- nessun upload automatico
- non esporre ComfyUI locale direttamente a Internet
- ogni modifica agente: branch dedicata + Pull Request
- nessun agente scrive o deploya direttamente su `main`

## Prossimi blocchi prodotto
Restano evoluzioni di livello superiore:
- speed ramp continuo/curve avanzate, oltre ai rate 0.5×/2×
- kinetic text / typewriter / karaoke
- sticker animati video/GIF
- easing editor e più keyframe
- preview composita multi-layer completa per split-screen
- sottotitoli smart
- tracking testo/sticker su oggetti
- maschere, object/background removal, upscale
- workflow AI reali preconfigurati quando viene scelto il runtime/provider definitivo

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Prima di distribuire pubblicamente verificare separatamente licenze di FFmpeg, modelli AI, LUT, font, asset e ogni eventuale codice esterno incorporato.
