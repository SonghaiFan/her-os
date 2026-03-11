# Her OS

Modern Next.js rebuild of the archived `index.html` experience, tuned for a Vercel-style React setup.

## Stack

- Next.js App Router
- React 19
- TypeScript
- CSS with no additional UI runtime dependencies

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `GEMINI_API_KEY` in `.env.local` with a Google AI Studio API key.

Optional TTS configuration in `.env.local`:

```bash
NOIZ_API_KEY=your_noiz_api_key
NOIZ_VOICE_ID=your_existing_cloned_voice_id
NOIZ_OUTPUT_FORMAT=mp3
NOIZ_TARGET_LANG=en
NOIZ_SPEED=1
NOIZ_AUTO_EMOTION=false
```

The app now uses Gemini for Samantha's replies through a server-side Next.js route, keeps the archived `public/audio/hello.ogg` boot sound, falls back to the archived local Q&A clips if the model request fails, and will use Noiz TTS for reply playback when `NOIZ_API_KEY` and `NOIZ_VOICE_ID` are configured. If Noiz is unavailable, the UI falls back to the existing browser `speechSynthesis` voice.
