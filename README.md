# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering, effetti, grafica, persistenza e AI.

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

Implementato: `ComfyUIAdapter`, `AIJobQueue`, `AIProviderRegistry`, `GatewayProvider`, contratto `randstudio.wan-camera/v1`, preset Drone Reveal/Rise/Approach, binding semantico workflow Wan e reinserimento output AI come clip.

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
Gli effetti sono dati strutturati sulla clip. Preview WebGPU/fallback browser, export autorevole FFmpeg, LUT3D e keyframe.

Preset inclusi: Clean, Cinema, **Cinema Pro**, Dreamy Glow, Vivid, B/N, VHS, NTSC.

Effetti disponibili nel blocco cinema/overlay: luminosità, contrasto, saturazione, grayscale, blur, glow, vignetta, film grain, VHS, NTSC e scanlines.

AiyaEffectsIOS, VideoBeautify e `ntsc-rs` sono usati come riferimenti architetturali. Non vengono copiati SDK iOS, asset proprietari o codice con licenza incerta.

## Point 4 — Advanced Runtime

### WebGPU
`src/effects/webgpu-renderer.js` implementa preview real-time di luminosità, contrasto, saturazione e grayscale. Fallback browser automatico.

### LUT `.cube`
Import, parser/validazione, preview canvas, persistenza e export FFmpeg `lut3d`.

### Keyframe
Keyframe numerici, interpolazione preview e expression compiler FFmpeg per i controlli colore supportati.

### IndexedDB / relink
`src/persistence/indexeddb.js` salva progetto, blob media, LUT e metadati di relink; ripristino automatico all'avvio.

### Provider AI
`src/ai/provider-registry.js` separa UI e provider con ComfyUI locale e gateway remoto/self-hosted.

## Point 5 — Text / Sticker / Overlay Engine

`src/graphics/overlay-engine.js` introduce elementi grafici come clip vere della Composition, non come decorazioni fuori timeline.

### Elementi inclusi
- Titolo statico
- Lower third con titolo + sottotitolo
- Callout
- Freccia
- sticker rapidi emoji
- sticker PNG/SVG importabili come normali media

Ogni elemento grafico conserva un payload `randstudio.graphic/v1` con testo, font size, colore, background, accent e padding. Le clip grafiche hanno start/end/transform/effects come le altre clip, quindi possono essere spostate, scalate, ruotate, splittate e ricevere effetti.

### Rendering grafica
Per evitare dipendenze da font FFmpeg o SVG decoder variabili, RandStudio rasterizza gli overlay nel browser su PNG trasparente prima dell'export. Il PNG generato viene poi trattato dal compiler come un normale input visuale FFmpeg. Questo rende l'export più prevedibile su FFmpeg WASM.

```text
Graphic Clip
   |
   +--> Canvas renderer -> PNG trasparente
   |                         |
   |                         v
   +--> preview          FFmpeg input
                              |
                              v
                         export finale
```

Gli asset grafici generati non vengono salvati come duplicati permanenti: vengono rigenerati dal payload `graphic` dopo restore o modifica del testo.

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
│   └── overlay-engine.js
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
- WebGPU opzionale
- IndexedDB nativo browser
- Canvas 2D nativo per text/sticker/callout rasterization

## Sicurezza e workflow
- nessuna API key nel client
- nessun upload automatico
- non esporre ComfyUI locale direttamente a Internet
- ogni modifica agente: branch dedicata + Pull Request
- nessun agente scrive o deploya direttamente su `main`

## Prossimi blocchi prodotto
Il blocco base **Effetti + Testi + Sticker** è ora operativo. Le prossime evoluzioni sono:
- testi animati / kinetic text
- sticker animati e overlay video
- easing/spring e più keyframe
- speed ramp / freeze frame / split screen
- sottotitoli smart e karaoke
- tracking testo/sticker su oggetti
- maschere, object/background removal, upscale
- workflow AI reali preconfigurati quando viene scelto il runtime/provider definitivo

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Prima di distribuire pubblicamente verificare separatamente licenze di FFmpeg, modelli AI, LUT, font, asset e ogni eventuale codice esterno incorporato.
