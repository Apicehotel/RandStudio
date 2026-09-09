# RandStudio

Studio locale-first per elaborare foto e video direttamente dal browser.

## Funzioni MVP
- Import foto e video con drag & drop
- Preview locale: i file non vengono caricati su server
- Luminosità, contrasto, saturazione e scala
- Rotazione e specchio X/Y
- Preset Clean, Cinema, Vivid, Bianco/Nero
- Preset iniziale “Drone View”
- Export foto PNG
- Cattura frame PNG dai video
- Controllo velocità e mute video
- UI responsive desktop/mobile

## Architettura prevista

### Fase 2 — editing video reale
- timeline multi-clip
- trim / split / merge
- testo, overlay, musica e transizioni
- FFmpeg.wasm oppure backend FFmpeg
- export MP4/WebM

### Fase 3 — AI Lab
- ComfyUI API locale
- Wan video / camera control
- image-to-video e video-to-video
- upscale foto/video
- background removal
- generative fill / outpainting
- preset camera “Drone View” AI

### Fase 4 — progetti
- IndexedDB locale
- autosave
- cronologia versioni
- preset personali
- queue export

## Avvio
Non richiede build né dipendenze.

```bash
python -m http.server 8080
```

Poi apri `http://localhost:8080`.

In alternativa puoi aprire `index.html`, ma alcune funzioni browser lavorano meglio tramite server locale.

## Sicurezza
- local-first
- nessuna API key nel codice
- nessun upload automatico
- integrare i motori AI tramite endpoint locali o proxy server sicuro

## Roadmap consigliata
1. Stabilizzare editor foto
2. Integrare FFmpeg per il video
3. Aggiungere timeline
4. Collegare ComfyUI
5. Aggiungere Wan Camera Control / Drone View
6. Salvare progetti in IndexedDB
7. Pacchetto desktop opzionale con Tauri

## Licenza
Da definire prima della pubblicazione pubblica. Se il repository resta privato, puoi mantenerlo proprietario.
