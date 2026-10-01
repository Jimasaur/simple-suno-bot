# Simple Suno & Chat Bot

An experimental Discord bot combining music playback, text chat, and voice responses. The runnable application lives in [`clean_export/`](clean_export/), rather than the repository root.

## What this demonstrates

- Discord message and voice-channel integration.
- OpenAI-backed chat and text-to-speech.
- Music queue and playback commands for supported sources.
- Configurable voice and persona behavior.

## Start here

Read the [application setup and command reference](clean_export/README.md), then run commands from `clean_export/`:

```bash
cd clean_export
npm install
cp .env.example .env
# Configure your own credentials locally before starting.
node index.js
```

The application reads `DISCORD_TOKEN` and `OPEN_AI_API_KEY` (including the underscore in `OPEN_AI`). Keep credentials out of source control. Check the dependency engine requirements before choosing a Node.js version; this older demo's setup notes may need adjustment for current dependencies.

## Status and limitations

This is a personal integration experiment, not a supported music service. Playback depends on provider availability and permissions. Use only content you are authorized to play and follow the relevant platform terms. Messages or audio sent to external APIs may incur charges; use a test Discord server and synthetic content when evaluating.

The package currently has no automated test suite: `npm test` is a placeholder that exits with an error. This README does not imply runtime or provider compatibility has been verified.
