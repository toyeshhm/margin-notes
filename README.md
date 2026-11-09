# Margin Notes

Every comment, answered: it reads the teacher's marks on an essay, pins each one to its sentence in plain words, and checks your revision against every comment, ticking one only when it can quote the new sentence that answers it.

Live: https://margin-notes.toyeshhm.workers.dev (no sign-in; open **Try a sample**)

Built for SLAY HACKS 2026 by toyeshhm, solo.

## What it does

- Scan one to four photos of a marked, typed essay, or a Word file with typed comments. Each mark becomes a numbered pin beside its sentence, and an index card lists every comment. A wrong pin can be dragged to the right sentence.
- Each comment shows the teacher's mark as written and plain words that say what to do. The app never writes a sentence for the student.
- Paste a revision to check it. A language model judges each comment and must quote the new draft; code keeps the tick only if that quote is in the draft word for word:
  `const ticked = verdict.answered && normalize(revision).includes(quote);`
- Before and after, rounds, and a one-page note for the teacher (print it, or share a read-only link).
- A marking key, **My essays** (kept in your browser), and three invented sample essays that open from saved scans with no AI call.

## Run it

```sh
npm ci
npm run dev      # Vite dev server; the /api routes need the Worker, see below
make check       # lint, type-check, unit tests, build, Playwright suite
```

`npm run dev` serves the screens only. For the full app run `npm run build && npm run preview` (Wrangler on port 4173). The AI routes need a Cloudflare account with the Workers AI and D1 bindings in `wrangler.jsonc` (create a D1 database named `margin-notes` and add its `database_id`), and optionally free keys set as Worker secrets: `NVIDIA_API_KEY` (NVIDIA NIM) and `GROQ_API_KEY` (Groq). Without them the app falls back to Workers AI. `PLAYTEST_URL=<deployed url> make check` runs the AI specs against a deployment.

## How it is built

- React, Vite, GSAP, Tailwind. The teacher's pen marks are drawn in code (Hershey script glyphs outlined by perfect-freehand).
- A Cloudflare Worker serves the app and four routes: `/api/scan`, `/api/explain`, `/api/check`, `/api/note`. Cloudflare D1 keeps note links, what each scan read (without the photo) and each check's result. Essays and rounds stay in the browser.
- Models, all on free tiers and tried in order (`api/ai.ts`): pictures go to NVIDIA NIM (Llama 3.2 90B Vision), then Groq (Qwen3.8 27B), then Workers AI (Llama 4 Scout); plain words and checks go to Groq (gpt-oss-120b, gpt-oss-20b), then NVIDIA NIM, then Workers AI (Llama 3.3 70B); sentence embeddings come from NVIDIA NIM, then Workers AI (bge-m3). Drafts are lined up in order with dynamic programming.
- Limits: the free tiers have per-minute and daily limits. When they are spent the app says so, and the samples still work. A photo scan can pin a mark to the wrong sentence. A comment answered by cutting its sentence is ticked as "Removed in your revision", with no quote.
- Tests: Vitest and Playwright.

## AI use

AI tools did the building (code, tests, cards), directed and approved by the author at the idea, the look and the final review. The product itself calls the models above when someone uses it. The demo video's narration is synthetic (Qwen3-TTS, speaker Ryan) and its music is an original CC0 piece; no picture in the project is AI-generated.

## Credits

See [CREDITS.md](CREDITS.md): Gather depth stills, a CC0 source photo (rawpixel), hersheytext and perfect-freehand (MIT), Sofia Sans and Tinos (SIL OFL 1.1), and the models' hosts. Music: "Margin Notes bed", an original piece made for the demo video (CC0).

## License

MIT, see [LICENSE](LICENSE).
