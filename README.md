# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering, effetti e AI.

## Point 1 — motore editor
- timeline visual/audio multi-track
- clip start/end + source in/out, trim, split, move e delete
- undo/redo e progetto `.randstudio.json`
- compiler `Composition JSON -> FFmpeg argv`
- adapter `@ffmpeg/ffmpeg` sostituibile
- CI GitHub Actions

## Point 2 — AI Lab
L'AI passa attraverso adapter e job, non viene hard-coded nell'editor.

```text
UI -> AIJobQueue -> ComfyUIAdapter -> Wan2.2 Fun Camera
                         |
                         v
                  Composition JSON -> Timeline
```

### Implementato
- `ComfyUIAdapter`: system stats, object info, queue, history, enqueue, interrupt e URL output
- `AIJobQueue`: queued/running/completed/failed/cancelled
- contratto `randstudio.wan-camera/v1`
- preset Drone Reveal / Rise / Approach
- binding semantico dei workflow Wan, nessun node-id fragile nel core
- output AI reinseribile come clip `ai-generated`

## Point 3 — Rand Design System + Effects Engine

### Rand Design System v1
L'interfaccia usa un set unico di token e pattern per evitare pagine disegnate ogni volta da zero.

- app shell editor con rail, media library, preview, inspector e timeline
- palette dark ad alto contrasto con accent viola/blu
- spacing, radius, surface, border, semantic color e control-size centralizzati in CSS custom properties
- safe-area iOS
- responsive desktop / tablet / smartphone
- modalità **Grande** persistente via `localStorage`
- controlli e gerarchia visiva coerenti
- nessuna modifica al contratto Composition JSON per ragioni puramente grafiche

### Effects Engine v1
Gli effetti sono dati strutturati sulla clip, non CSS sparso nell'interfaccia.

```text
Clip.effects
   |
   +--> previewRenderer -> browser/CSS oggi, WebGPU domani
   |
   +--> exportRenderer  -> FFmpeg oggi, Rust/WASM opzionale domani
```

Ogni effect definition contiene:
- `id`
- nome/categoria
- schema parametri con min/max/default
- renderer preview
- renderer FFmpeg

Preset inclusi:
- Clean
- Cinema
- Vivid
- B/N
- VHS
- NTSC

Gli effetti analogici sono ispirati ai pattern di `ntsc-rs`; VideoBeautify e AiyaEffectsIOS sono stati usati solo come riferimenti architetturali per temi/pipeline. Non vengono copiate dipendenze iOS, SDK proprietari o asset con licenza incerta.

### Perché non integriamo direttamente Aiya / VideoBeautify
Sono repository iOS/Objective-C vecchi o legati a SDK/asset specifici. RandStudio prende i concetti utili — pipeline effetti, temi, overlay, beauty — e li implementa in un contratto web-first indipendente.

### Perché `ntsc-rs` è interessante
`ntsc-rs` dimostra che gli effetti analogici complessi possono vivere in un motore separato ad alte prestazioni. RandStudio parte con equivalenti preview/FFmpeg e mantiene aperta una futura integrazione Rust/WASM senza legare il progetto a una sola implementazione.

## Wan2.2 Fun Camera
Supportati dal contratto: `Static`, `Pan Up`, `Pan Down`, `Pan Left`, `Pan Right`, `Zoom In`, `Zoom Out`.

Per generazione reale servono ComfyUI + workflow/modelli Wan sul runtime AI; i pesi restano fuori dal repository.

## Architettura
```text
src/
├── app.js
├── styles.css
├── core/
│   ├── composition.js
│   ├── history.js
│   └── ffmpeg-compiler.js
├── effects/
│   └── effects-engine.js
├── ai/
│   ├── job-queue.js
│   ├── wan-camera.js
│   └── result-import.js
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

ComfyUI/Wan sono runtime esterni opzionali.

## Sicurezza e workflow
- nessuna API key nel client
- nessun upload automatico
- non esporre ComfyUI locale direttamente a Internet
- ogni modifica agente: branch dedicata + Pull Request
- nessun agente scrive o deploya direttamente su `main`

## Limitazioni note / prossimo blocco
- media relinking e persistenza IndexedDB
- preview effetti analogici complessi oggi è intenzionalmente approssimata; FFmpeg è l'output autorevole
- WebGPU/shader renderer per preview avanzata
- LUT importabili
- maschere, keyframe e automation parametri
- stabilizzazione, object removal, background removal e upscale come provider/workflow
- registry versionato dei workflow AI

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Prima di distribuire pubblicamente verificare separatamente licenze di FFmpeg, modelli AI, LUT, font, asset e ogni eventuale codice esterno incorporato.
