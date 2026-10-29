# EchoSync — OpenCode Agent Operating Rules (`AGENTS.md`)

## 1. Core Architecture & Stack
- **Frontend:** React + Vite, modular CSS (`src/styles/`), persistent `<AudioRoot>` playback engine.
- **Music Brain:** Pure YouTube Music InnerTube (`WEB_REMIX`) engine (`server/ytmusicHandler.js` & `/api/ytmusic` / `/api/saavn`). Never re-introduce bloated multi-provider/custom taste-math files.
- **Realtime & Auth:** Supabase (`public.rooms`, `public.profiles`, Realtime channels).

## 2. Strict UI/UX & Mobile-First CSS Guardrails (`DESIGN.md` Binding)
- **Pure Dark Theme Only:** `#030303` base canvas with dynamic `--song-accent` / `--song-glow` radial ambient bleed. Zero light-mode rules.
- **Zero Box-Inside-Box:** Song rows in Quick Picks, Search, Queue, and Playlists must remain flat and borderless (`border: none`).
- **Zero Text Bleed Rule:** Every flex or grid child containing text MUST have `min-width: 0`, and single-line titles/subtitles MUST use `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- **Inline Button Alignment:** All buttons, chips, and pills MUST use `display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; flex-shrink: 0`.
- **Canonical Modals & Toasts:**
  - Desktop modals (`>768px`): dead-center inside `.modal-backdrop` (`display: flex; align-items: center; justify-content: center`).
  - Mobile modals (`<=768px`): flush bottom sheets (`align-items: flex-end; width: 100vw; max-height: 88dvh; border-radius: 22px 22px 0 0`).
  - Notifications: render strictly inside the single `.es-toast-viewport` portal. Never add technical error/restore popups.
- **Zero AI Slop Copy:** Never write robotic filler subtitles, debug badges (`LRCLIB`, `01` counters), or fake settings switches.

## 3. Token-Saving & Code Hygiene Workflow
- Read only the specific modular CSS/JSX file needed for the task instead of dumping entire directories.
- Run `npm run audit:clean` (`knip` + `biome`) and `npm run build` (`< 500 KB` main chunk) before committing.
- Always delete temporary verification scripts and screenshots before finishing a turn.
