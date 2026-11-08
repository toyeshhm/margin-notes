# Credits

Everything not listed here is drawn in code: the teacher's pen marks, ticks and handwriting (SVG), the index cards, the desk objects on the home screen and the sample tray, and the page layouts.

## Pictures

| What | Where it shows | Source | Licence and credit |
|---|---|---|---|
| Graphite-dust depth stills: `public/assets/home-pencil.webp`, `home-page1.webp`, `band-pages.webp`, `page1-dust.webp`, `page1-side.webp`, `scan-plane.webp` | Home mosaic, Scan an essay, the cards | Rendered with **Gather · 聚 by DAO** (Gather Lite, https://gather.be-of-dao.com) from the photo below and from the first sample's page photo, then cropped and mapped to the graphite palette with ffmpeg | Gather's output is ours to use; credit: "Gather · 聚 by DAO" |
| Depth loop: `public/assets/relief-loop.mp4`, `relief-loop.webm` | Title card | Gather Lite, the first sample's page turned in 3D, trimmed and re-encoded with ffmpeg | As above |
| Turning clouds: `public/assets/turn-page.*`, `turn-pencil.*`, `turn-band.*` (a still and two frame sheets each) | Home mosaic and the essay title band, turned by the visitor's mouse, finger or tilt | Gather Lite: the first sample's page and the pencil photo below, each turned by a held mouse drag in small steps and shot at every step, then cropped, mapped to the graphite palette and tiled with ffmpeg and cwebp | As above |
| "Pencil, ribber, paper clips, stationery" | Source picture for the pencil, eraser and clips in the Gather stills | rawpixel, https://www.rawpixel.com/image/6020785/photo-image-public-domain-pencil-office (found through Openverse) | CC0 |
| Sample page photos: `public/samples/later-bells-page-1.jpg`, `later-bells-page-2.jpg`, `yeast-sugar-time-page-1.jpg` | Try a sample, and the input to the scan | Drawn in code: the essays in `src/samples/` set in Tinos and marked with the pen code, photographed in a browser by `scripts/photo.html` | Made for this project |

No picture in this project is AI-generated.

## Code and type

| What | Licence |
|---|---|
| Hershey "Script 1-stroke" glyph data, from hersheytext 2.0.0 (`src/ink/hershey-script.json`) | MIT, `src/ink/LICENSE-hersheytext.txt` |
| perfect-freehand 1.2.3 (pen stroke outlines) | MIT |
| Sofia Sans and Sofia Sans Extra Condensed (`src/fonts/`) | SIL Open Font License 1.1, `src/fonts/OFL-SofiaSans*.txt` |
| Tinos (`src/fonts/`) | SIL Open Font License 1.1, `src/fonts/OFL-Tinos.txt` |
| React, GSAP, Vite, Tailwind, Playwright, Vitest, Wrangler | Their own licences (see `package.json`) |

## Texts

The three sample essays, their students, teachers and school are invented for this project. "What the Necklace Cost" discusses and briefly quotes Guy de Maupassant's "The Necklace" (1884), which is in the public domain. "Later Bells" quotes one sentence of the American Academy of Pediatrics' 2014 policy statement on school start times and cites Dunster et al. (2018), *Science Advances*.

## AI models

Workers AI on Cloudflare: Llama 4 Scout (reads page photos and each mark), Llama 3.3 70B (plain words and revision checks), bge-m3 (sentence embeddings to line up drafts). They run when a student uses the app; nothing they write is shipped as an asset.
