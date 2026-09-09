# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering e AI.

## Point 1 — motore editor
- timeline visual/audio multi-track
- clip start/end + source in/out, trim, split, move e delete
- undo/redo e progetto `.randstudio.json`
- compiler `Composition JSON -> FFmpeg argv`
- adapter `@ffmpeg/ffmpeg` sostituibile
- CI GitHub Actions

## Point 2 — AI Lab

L'AI non è incorporata nell'editor: passa attraverso adapter e job. Questo evita di legare RandStudio a un singolo modello o provider.

```text
UI / futuro AI Lab
       |
       v
AIJobQueue ---- ComfyUIAdapter ---- ComfyUI locale
       |                                |
       |                         Wan2.2 Fun Camera
       |                                |
       +--------- risultato ------------+
                    |
                    v
              Composition JSON
                    |
                    v
                 Timeline
```

### Implementato
- `ComfyUIAdapter`: health/system stats, object info, queue, history, prompt enqueue, interrupt e URL output
- `AIJobQueue`: queued/running/completed/failed/cancelled, progress e output
- contratto `randstudio.wan-camera/v1`
- preset Drone: Reveal (Zoom Out), Rise (Pan Up), Approach (Zoom In)
- validazione motion, dimensioni, frame length e speed
- binding semantico dei parametri Wan a workflow API JSON: nessun node-id Wan hard-coded nel core
- reinserimento degli output AI come clip `ai-generated` nella timeline visuale
- test automatici del lifecycle job, binding Wan e round-trip output -> timeline

### Perché i node-id Wan NON sono hard-coded
I workflow ComfyUI possono cambiare tra template/versioni. RandStudio conserva un mapping di binding separato (`prompt`, `motion`, `width`, `height`, `length`, `speed`, opzionale `seed`) e applica i valori a un workflow API JSON fornito/configurato. Così un aggiornamento del template non richiede di riscrivere il core.

## Wan2.2 Fun Camera
Il workflow ufficiale ComfyUI supporta `Static`, `Pan Up`, `Pan Down`, `Pan Left`, `Pan Right`, `Zoom In` e `Zoom Out`; RandStudio espone lo stesso contratto. Il preset **Drone View / Reveal** usa `Zoom Out` reale del modello, non un filtro CSS.

### Requisiti runtime per generare davvero
RandStudio non scarica automaticamente modelli multi-GB. Sul computer/GPU che esegue AI Lab servono:
1. ComfyUI aggiornato e raggiungibile (default adapter `http://127.0.0.1:8188`)
2. workflow API JSON Wan2.2 Fun Camera
3. modelli Wan Fun Camera high-noise/low-noise, VAE e text encoder richiesti dal workflow
4. eventuali LoRA Lightning se si vuole la modalità accelerata

I modelli restano fuori dal repository Git.

## Architettura
```text
src/
├── app.js
├── styles.css
├── core/
│   ├── composition.js
│   ├── history.js
│   └── ffmpeg-compiler.js
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

## Dipendenze
- `@ffmpeg/ffmpeg` 0.12.15
- `@ffmpeg/util` 0.12.2

ComfyUI/Wan sono servizi/modelli locali esterni e non vengono inclusi come dipendenze npm.

## Sicurezza
- nessuna API key nel client
- nessun upload automatico
- endpoint ComfyUI configurabile; non esporre una istanza locale direttamente a Internet
- branch feature + Pull Request obbligatori
- nessun agente scrive o deploya direttamente su `main`

## Limitazioni / prossimo blocco
- manca ancora il pannello visuale AI Lab che usa questi moduli
- il workflow API JSON e i binding Wan devono essere importati/configurati dall'utente finché non aggiungiamo un registry versionato
- persistenza IndexedDB/relink media ancora da completare
- outpainting, extension, upscale e background removal saranno provider/workflow aggiuntivi sopra la stessa queue

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Wan2.2 Fun Camera è documentato da ComfyUI come Apache-2.0; verificare comunque le licenze di ogni modello/workflow e delle build FFmpeg prima della distribuzione commerciale/pubblica.
