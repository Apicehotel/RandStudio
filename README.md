# RandStudio

RandStudio è uno studio locale-first per foto e video. Dalla v0.2 il progetto usa un documento di composizione versionato che separa timeline, preview e rendering.

## Point 1 completato — motore editor

### Timeline / Composition JSON
- Composition JSON `version: 1`
- track visuali e audio multiple
- clip con `start/end` e source `in/out`
- drag orizzontale delle clip
- trim numerico
- split al playhead
- eliminazione clip
- transform per clip: scala/rotazione, schema pronto per x/y/effects
- validazione progetto
- durata calcolata dal documento

### Workflow
- libreria media locale: foto, video e audio
- drag & drop
- preview media/clip
- timeline multi-track
- playhead e inspector clip
- undo / redo
- salvataggio e riapertura `.randstudio.json`
- nessun upload automatico

### Export
- compiler deterministico `Composition JSON -> FFmpeg argv`
- `filter_complex` con trim, offset, overlay, scale e rotation
- audio delay/volume e mix multi-clip
- output H.264/AAC MP4
- adapter separato `@ffmpeg/ffmpeg`
- progress export in UI

La preview browser è veloce e approssimata; il render FFmpeg è l'output autorevole.

## Architettura
```text
src/
├── app.js
├── styles.css
├── core/
│   ├── composition.js
│   ├── history.js
│   └── ffmpeg-compiler.js
└── adapters/
    └── ffmpeg-wasm.js
```

Il Composition JSON è il contratto centrale: il futuro AI Lab potrà modificarlo senza accoppiarsi alla UI.

## Avvio
```bash
npm install
npm run dev
```

Build e test:
```bash
npm run build
npm test
npm run check
```

## Dipendenze
- `@ffmpeg/ffmpeg` 0.12.15
- `@ffmpeg/util` 0.12.2

L'adapter è sostituibile in futuro con FFmpeg nativo/Tauri o backend senza cambiare i progetti.

## Limitazioni note
- il JSON salva la struttura ma non incorpora i file media: serve relinking/IndexedDB nel blocco persistenza
- lo still-image looping in export verrà perfezionato nel renderer
- preview e FFmpeg possono differire leggermente
- il vecchio “Drone View” visivo non viene più presentato come AI: il vero camera control va in AI Lab

## Prossimo blocco — Point 2 AI Lab
- ComfyUI adapter locale
- Wan Camera Control
- Drone View reale
- pan / zoom / orbit / dolly
- video outpainting / extension
- image-to-video / video-to-video
- upscale e background removal
- job queue con output reinseribile in timeline

## Sicurezza
- nessuna API key nel client
- nessun upload automatico
- branch feature + Pull Request obbligatori
- nessun agente scrive o deploya direttamente su `main`

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Verificare separatamente le licenze delle build FFmpeg prima di distribuzione commerciale/pubblica.
