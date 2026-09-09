# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un Composition JSON versionato che separa timeline, preview, rendering e AI.

## Point 1 — motore editor
- timeline visual/audio multi-track
- clip start/end + source in/out, trim, split, move e delete
- undo/redo e progetto `.randstudio.json`
- compiler `Composition JSON -> FFmpeg argv`
- adapter `@ffmpeg/ffmpeg` sostituibile
- CI GitHub Actions

## Point 2 — AI Lab completato

L'AI non è un editor separato: usa la clip selezionata (o quella sotto il playhead), genera tramite ComfyUI/Wan e reinserisce l'output nella Media Library e nella timeline.

```text
Timeline / Composition JSON
        │
        ├── FFmpeg renderer
        │
        └── RandStudioBridge
              │
              v
          AI Lab UI
              │
       AIJobQueue + bindings
              │
              v
        ComfyUIAdapter
              │
              v
       Wan2.2 Fun Camera
              │
              v
        output media
              │
              └──> timeline
```

### Funzioni AI implementate
- pannello visuale **AI Lab**
- endpoint ComfyUI configurabile, default `http://127.0.0.1:8188`
- test connessione `/system_stats`
- interrupt ComfyUI
- import workflow Wan in **API format**
- discovery automatica dei binding `prompt`, `motion`, `width`, `height`, `length`, `speed`, opzionale `seed` e `LoadImage`
- override tramite file JSON di binding personalizzati
- contratto `randstudio.wan-camera/v1`
- preset Drone View / Reveal, Drone Rise, Drone Approach, Pan Left/Right/Down e Static
- input foto: file originale
- input video: frame PNG estratto al playhead rispettando il source in-point
- upload input `/upload/image`
- enqueue `/prompt`
- polling `/history/{prompt_id}` fino a completamento
- ricerca output video/gif/immagine nella history
- download `/view`
- job queue con stato, progress, errore e prompt id
- output importato automaticamente come nuovo media
- output inserito subito dopo la clip sorgente
- clip AI evidenziate in timeline e marcate `ai-generated` con provider/preset/motion/promptId
- test automatici su lifecycle job, binding, discovery nodi, output ComfyUI e round-trip timeline

### Binding Wan: robusto ma non magico
I node-id ComfyUI non sono hard-coded. RandStudio cerca semanticamente `WanCameraEmbedding`, `CLIPTextEncode` e `LoadImage` per creare un mapping iniziale; il mapping può essere sostituito caricando un JSON di binding. Questo evita di rompere il core se il template Wan cambia nodi o id.

Esempio binding:
```json
{
  "prompt": ["10", "text"],
  "motion": ["20", "camera_motion"],
  "width": ["20", "width"],
  "height": ["20", "height"],
  "length": ["20", "length"],
  "speed": ["20", "speed"],
  "image": ["30", "image"]
}
```

## Wan2.2 Fun Camera
RandStudio espone `Static`, `Pan Up`, `Pan Down`, `Pan Left`, `Pan Right`, `Zoom In` e `Zoom Out`. **Drone View / Reveal** usa `Zoom Out` reale del workflow Wan, non un filtro CSS.

## Preparazione ComfyUI / Wan
1. Installa/aggiorna ComfyUI sul computer che eseguirà l'AI.
2. Installa i modelli richiesti dal workflow Wan2.2 Fun Camera (pesi high/low-noise, VAE, text encoder e gli eventuali componenti indicati dal template).
3. Apri il workflow Wan2.2 Fun Camera in ComfyUI e salvalo/esportalo in **API format**.
4. Durante sviluppo browser abilita CORS solo per l'origine di RandStudio, ad esempio:

```bash
python main.py --enable-cors-header http://localhost:5173
```

5. In RandStudio: **AI Lab → Test connessione → carica workflow API → seleziona clip → scegli camera → Genera e inserisci in timeline**.

I pesi dei modelli non vengono inseriti nel repository Git.

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
│   ├── ai-lab.js
│   ├── job-queue.js
│   ├── wan-camera.js
│   ├── result-import.js
│   └── styles.css
└── adapters/
    ├── ffmpeg-wasm.js
    └── comfyui.js
```

### Perché restano sia `result-import.js` sia `RandStudioBridge`
`result-import.js` è la funzione pura Composition JSON, riutilizzabile da test/backend/futuri provider. `RandStudioBridge` gestisce invece i Blob/File reali del browser. Non sono doppioni.

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
- ComfyUI/Wan sono runtime esterni, non dipendenze npm del client

## Sicurezza
- nessuna API key nel client
- nessun upload automatico: il media viene inviato a ComfyUI solo quando l'utente avvia esplicitamente un job AI
- preferire ComfyUI su localhost/LAN; non esporre direttamente l'istanza a Internet
- CORS ristretto all'origine RandStudio quando possibile
- branch feature + Pull Request obbligatori
- nessun agente scrive o deploya direttamente su `main`

## Cosa è predisposto per il futuro
Lo stesso adapter/coda/bridge può ospitare senza cambiare il core timeline:
- Wan VACE video-to-video
- video outpainting / extension
- image-to-video
- upscale
- background removal
- altri workflow ComfyUI

## Prossimo blocco consigliato
**Persistenza media / relinking**: IndexedDB, autosave progetto, riapertura dei file locali e gestione dei media mancanti. È il pezzo che rende RandStudio davvero utilizzabile come progetto continuativo, non solo nella sessione corrente.

## Limitazioni runtime
- la pipeline reale Wan richiede una tua istanza ComfyUI con workflow e modelli installati; la CI testa i contratti e i mock, non può eseguire una generazione GPU Wan
- il progetto JSON non incorpora ancora i file media
- preview browser e render FFmpeg possono differire leggermente

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Verificare le licenze dei workflow, dei singoli pesi/modelli Wan e delle build FFmpeg prima di una distribuzione commerciale/pubblica.
