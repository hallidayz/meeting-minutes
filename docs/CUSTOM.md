# AI Guardian — Fork Divergence from Meetily

## Base

Forked from [hallidayz/meeting-minutes](https://github.com/hallidayz/meeting-minutes) (Meetily / Tauri desktop).

## Kept from upstream

- Live transcription (Whisper.cpp + Parakeet, GPU builds)
- Native audio capture (mic + system mix)
- Ollama and multi-provider summarization
- BlockNote summary editor
- SQLite storage and meeting folder structure
- System tray, notifications, model download management

## Added in AI Guardian

| Feature | Location |
|---------|----------|
| AI GUARDIAN branding | `frontend/src/config/branding.ts`, CSS tokens |
| PIN + AES-GCM encryption | `frontend/src-tauri/src/crypto/` |
| Tasks module | `frontend/src-tauri/src/tasks/`, `/tasks` UI |
| Industry-aware summaries | `frontend/src-tauri/src/summary/industry.rs` |
| Speaker label editing | `VirtualizedTranscriptView`, `api_save_transcript_speaker` |
| Meeting details tabs | Transcript / Summary / Tasks |
| ai-notes import | `import_ai_notes_bundle` command |
| Migration export (legacy web) | ai-notes `/api/export/bundle` |
| Native calendar read (OS APIs) | `frontend/src-tauri/src/calendar/`, Settings → Calendar Integration |

## Explicitly excluded

- Calendar OAuth / cloud API connectors (Google Calendar API, Microsoft Graph, etc.)
- Express-centric web runtime from ai-notes

## Build

```bash
cd frontend
pnpm install
pnpm tauri:dev:metal   # macOS Apple Silicon GPU
./build-gpu.sh         # release GPU build
```
