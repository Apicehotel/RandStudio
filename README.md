# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering, effetti, persistenza e AI.

## Point 1 — motore editor
- timeline visual/audio multi-track
- clip start/end + source in/out, trim, split, move e delete
- undo/redo e progetto `.randstudio.json`
- compiler `Composition JSON -> FFmpeg argv`
- adapter `@ffmpeg/ffmpeg` sostituibile
- CI GitHub Actions

## Point 2 — AI Lab
L'AI passa attraverso adapter, registry provider e job; non viene hard-coded nell'editor.

```text
UI -> AI Provider Registry
      |              |
      v              v
  ComfyUI locale   AI Gateway remoto
      |              |
      +------ job ----+
             |
             v
      Composition JSON -> Timeline
```

### Implementato
- `ComfyUIAdapter`: system stats, object info, queue, history, enqueue, interrupt e URL output
- `AIJobQueue`: queued/running/completed/failed/cancelled
- `AIProviderRegistry`: provider intercambiabili
- `GatewayProvider`: endpoint remoto senza API key nel client
- contratto `randstudio.wan-camera/v1`
- preset Drone Reveal / Rise / Approach
- binding semantico dei workflow Wan, nessun node-id fragile nel core
- output AI reinseribile come clip `ai-generated`

Per generare realmente serve almeno un runtime esterno raggiungibile: ComfyUI/Wan locale oppure un gateway AI remoto. Il repository non incorpora pesi multi-GB né credenziali.

## Point 3 — Rand Design System + Effects Engine

### Rand Design System v1
- app shell editor con rail, media library, preview, inspector e timeline
- palette dark ad alto contrasto con accent viola/blu
- token CSS centralizzati
- safe-area iOS
- responsive desktop / tablet / smartphone
- modalità **Grande** persistente

### Effects Engine
Gli effetti sono dati strutturati sulla clip.

```text
Clip.effects
   |
   +--> preview -> WebGPU quando disponibile
   |             -> browser fallback
   |             -> LUT CPU preview
   |
   +--> export  -> FFmpeg
   |             -> LUT3D
   |             -> keyframe expressions
   |
   +--> futuro  -> Rust/WASM opzionale
```

Preset inclusi: Clean, Cinema, Vivid, B/N, VHS, NTSC.

AiyaEffectsIOS, VideoBeautify e `ntsc-rs` sono usati come riferimenti architetturali. Non vengono copiati SDK iOS, asset proprietari o codice con licenza incerta.

## Point 4 — Advanced Runtime completato

### WebGPU
`src/effects/webgpu-renderer.js` implementa una pipeline WebGPU per preview real-time di luminosità, contrasto, saturazione e grayscale. Quando WebGPU non è disponibile RandStudio usa il renderer browser esistente.

### LUT `.cube`
- import `.cube` dalla Media Library
- parser `LUT_3D_SIZE`, `DOMAIN_MIN/MAX`, samples
- validazione dimensione e campioni
- preview LUT su canvas
- export FFmpeg con `lut3d`
- LUT salvata come asset persistente e collegabile alla clip

### Keyframe
- keyframe numerici versionabili nei singoli effetti
- interpolazione lineare nella preview
- luminosità animabile direttamente dall'Inspector
- compiler FFmpeg con espressioni `eval=frame` per brightness / contrast / saturation e supporto grayscale
- struttura generica pronta per estendere altri parametri

### IndexedDB / relink
`src/persistence/indexeddb.js` salva:
- progetto più recente
- blob originali media
- LUT
- metadati di relink

All'avvio RandStudio ripristina sessione e asset locali. Il relink dispone di scoring su nome, size, lastModified e MIME.

### Provider AI
`src/ai/provider-registry.js` separa UI e provider. Sono disponibili:
- `ComfyUIProvider` per runtime locale
- `GatewayProvider` per runtime remoto/self-hosted

Il gateway viene configurato dalla UI e salvato in `localStorage`. Nessuna chiave privata viene salvata nel client.

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

## Dipendenze runtime browser
- `@ffmpeg/ffmpeg` 0.12.15
- `@ffmpeg/util` 0.12.2
- WebGPU opzionale, rilevato a runtime
- IndexedDB nativo browser

## Sicurezza e workflow
- nessuna API key nel client
- nessun upload automatico
- non esporre ComfyUI locale direttamente a Internet
- ogni modifica agente: branch dedicata + Pull Request
- nessun agente scrive o deploya direttamente su `main`

## Cosa resta davvero
Non restano più i 5 blocchi strutturali precedenti. Le prossime evoluzioni sono miglioramenti di qualità/prodotto, non debiti architetturali obbligatori:
- maschere e object tracking
- stabilizzazione
- object/background removal
- upscale
- più parametri keyframabili
- renderer analogico Rust/WASM opzionale
- workflow AI reali preconfigurati quando viene scelto il runtime/provider definitivo

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Prima di distribuire pubblicamente verificare separatamente licenze di FFmpeg, modelli AI, LUT, font, asset e ogni eventuale codice esterno incorporato.
