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

---

<!-- series-footer:start -->

<p align="center">
<a href="https://github.com/SonghaiFan/leftopen"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/leftopen.svg" width="32" height="32" alt="LeftOpen" title="LeftOpen" /></a>&nbsp;
  <a href="https://github.com/SonghaiFan/her-os"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/her-os.svg" width="32" height="32" alt="her-os" title="her-os" /></a>&nbsp;
  <a href="https://github.com/SonghaiFan/roc-ui"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/roc.svg" width="32" height="32" alt="ROC" title="ROC" /></a>&nbsp;
  <a href="https://github.com/SonghaiFan/token-flow"><img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/token-flow.svg" width="32" height="32" alt="Token Flow" title="Token Flow" /></a>&nbsp;
  <img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/aboard.svg" width="32" height="32" alt="Aboard" title="Aboard" />&nbsp;
  <img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/structured-text.svg" width="32" height="32" alt="Structured Text" title="Structured Text · local package" />&nbsp;
  <img src="https://raw.githubusercontent.com/SonghaiFan/SonghaiFan/main/assets/series/tasty-text.svg" width="32" height="32" alt="Tasty Text" title="Tasty Text" />
</p>

<p align="center"><a href="https://github.com/SonghaiFan/rea">REA</a> · <a href="https://github.com/SonghaiFan/franklin-comments">Franklin Comments</a> · <a href="https://github.com/SonghaiFan/obsidian-blog-publisher">Obsidian Blog Publisher</a></p>

<p align="center"><sub>Franklin series · Made by <a href="https://github.com/SonghaiFan">Songhai Fan</a></sub></p>

<!-- series-footer:end -->
