# Contributing to RandStudio

## Freeze agenti
- Nessun agente o automazione scrive direttamente su `main`.
- Ogni modifica passa da branch dedicato e Pull Request.
- Il merge richiede revisione umana.

## Regole tecniche
- Il Composition JSON è il contratto centrale: UI, export e AI devono parlare con lui.
- Gli adapter esterni (FFmpeg, ComfyUI, Wan) restano separati dal core.
- Evitare chiavi/API secret nel browser.
- Aggiungere test alle operazioni del core prima di estendere la UI.
