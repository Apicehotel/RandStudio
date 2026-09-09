# RandStudio

RandStudio è uno studio locale-first per foto e video. Il progetto usa un documento Composition JSON versionato che separa timeline, preview, rendering, effetti, grafica, motion, sottotitoli, velocità, persistenza e AI.

## Modalità 0 crediti
RandStudio è progettato per funzionare senza provider a consumo obbligatori.

- FFmpeg/WASM: montaggio, effetti, transizioni, speed ramp e rendering
- Whisper.cpp locale: trascrizione/sottotitoli
- MODNet via Transformers.js: rimozione sfondo foto direttamente nel browser
- ComfyUI locale/LAN: runtime AI pesante opzionale
- Wan/LTX locali: generazione video/camera AI quando l'hardware lo consente
- nessuna API key necessaria per il percorso locale
- in modalità `ZERO_CREDIT_MODE` i provider remoti a consumo vengono rifiutati dal registry Vision

La rimozione sfondo locale usa `Xenova/modnet` con WebGPU quando disponibile e fallback locale supportato dal runtime Transformers.js. Per modelli video pesanti resta necessario un PC/GPU adeguato, ma non crediti cloud.

## Point 1 — motore editor
- timeline visual/audio multi-track
- clip start/end + source in/out, trim, split, move e delete
- undo/redo e progetto `.randstudio.json`
- compiler `Composition JSON -> FFmpeg argv`
- adapter `@ffmpeg/ffmpeg` sostituibile
- CI GitHub Actions

## Point 2 — AI Lab
AI tramite registry/provider, con ComfyUI locale come percorso principale. Contratto Wan Camera con Drone Reveal/Rise/Approach e output reinseribile in timeline. Il repository non incorpora pesi multi-GB: i modelli pesanti restano nel runtime locale.

## Point 3 — Rand Design System + Effects Engine
- responsive + safe-area iOS + modalità Grande
- WebGPU/fallback browser
- FFmpeg autorevole
- LUT3D e keyframe
- Clean, Cinema, Cinema Pro, Teal & Orange, Warm Film, Cool Film, Vintage, HDR Look, Soft Film, Dreamy Glow, Vivid, B/N, VHS, NTSC, Glitch, Pixel, Fisheye, Edge e Green Screen
- luminosità, contrasto, saturazione, grayscale, sepia, blur, sharpen, soft focus, warm/cool, glow, vignetta, grain, glitch, VHS, NTSC, scanlines, pixelate, fisheye, edge e chroma key

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
- trascrizione con Whisper.cpp locale configurabile
- transcript persistente e caption FFmpeg tramite Overlay Engine
- mapping trim/playback rate corretto

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
La curva continua viene campionata in micro-segmenti deterministici. Ogni segmento viene renderizzato con la propria velocità e poi ricomposto da FFmpeg.

## Point 9 — Finish Runtime
- Kinetic Text: Word Pop, Typewriter, Word Slide, Headline
- preview multi-layer composita
- keyframe trasformazione X/Y/scala/rotazione/opacità con easing
- transizioni Fade, Flash, Blur, Zoom, Glitch
- Audio Pro con normalize, fade e ducking voce/musica
- tracking manuale e contratto AI tracking
- maschere rettangolari persistenti/renderizzabili
- Vision Jobs per track/background remove/object remove/upscale
- MODNet locale per background removal foto
- template Reel/TikTok, Square, YouTube, Cinema 24p e 4K
- libreria ampliata di effetti, sticker e grafiche social

### Stato UI e persistenza

`app.js` è l'unica fonte dello stato editor. `finish-ui.js` attende il ripristino iniziale e usa l'API dello stato vivo per template, Kinetic Text, transizioni, keyframe, audio, tracking, maschere e job Vision. Le azioni non rileggono più una seconda copia da IndexedDB e non ricaricano più la pagina dopo ogni click.

- la clip selezionata è risolta tramite `trackId` + `clipId`, non tramite nome/start
- ogni progetto viene validato prima del salvataggio IndexedDB
- la preview composita usa gli stessi media dell'editor e ha `pointer-events: none`
- tab Media e navigazione laterale sono controlli funzionanti
- ricerca e filtro tipo Media restano combinati dopo ogni aggiornamento della libreria
- i controlli restano inattivi soltanto durante il ripristino iniziale, evitando click persi
- la rimozione sfondo locale aggiorna media, clip e preview senza riletture IndexedDB o reload
- gli errori di inizializzazione della UI avanzata sono mostrati anche nell'interfaccia

## Architettura
```text
src/
├── app.js
├── finish-ui.js
├── core/
│   ├── composition.js
│   ├── ffmpeg-compiler.js
│   ├── speed-ramp.js
│   ├── easing.js
│   ├── transform-keyframes.js
│   ├── transition-engine.js
│   └── project-templates.js
├── effects/
├── graphics/
├── captions/
├── audio/
├── preview/
├── vision/
│   ├── vision-engine.js
│   ├── local-background-removal.js
│   └── local-vision-ui.js
├── persistence/
├── ai/
└── adapters/
```

## Avvio e test
```bash
npm install
npm run dev
npm test
npm run check
npm run build
```

Smoke test browser consigliato: applicare i cinque template, aggiungere Titolo e Kinetic Text, quindi provare transizione, keyframe, tracking e maschera verificando che timeline e stato cambino senza reload o errori console.

## Sicurezza e workflow
- nessuna API key nel client per il percorso locale
- nessun upload automatico
- `ZERO_CREDIT_MODE=true` blocca provider Vision remoti a consumo
- endpoint locali ammessi: localhost e reti LAN private
- non esporre ComfyUI/Whisper direttamente a Internet
- ogni modifica agente: branch dedicata + Pull Request
- nessun agente scrive o deploya direttamente su `main`

## Cosa richiede comunque hardware locale
Le funzioni classiche di editing, effetti, testo, sticker, sottotitoli e background removal foto possono funzionare senza crediti cloud. Drone AI, generazione video, object removal video e upscale AI pesante richiedono un runtime locale con modelli e GPU sufficienti. Se l'hardware non basta, RandStudio non passa automaticamente a un servizio a pagamento.

## Licenze
RandStudio resta senza licenza open-source finché non ne viene scelta una. Prima di distribuire pubblicamente verificare separatamente licenze di FFmpeg, Whisper.cpp/modelli Whisper, MODNet/Transformers.js, modelli AI, LUT, font, asset e ogni eventuale codice esterno incorporato.
