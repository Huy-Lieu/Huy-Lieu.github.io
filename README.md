# budaica — Huy's personal space

Personal website of **Quoc Huy Lieu** — part learning journal, part resume.

> Hard work buys freedom. Freedom means being there when my family needs me.

## Structure

| File | Purpose |
|---|---|
| `index.html` | Home — the garage: currently learning, roadmap, latest entries |
| `notes.html` | Field Notes — the logbook (all journal entries) |
| `posts.html` + `posts/` | Longer articles (template: `posts/_template.html`) |
| `resume.html` | The resume page (resume.budaica.com) |
| **`data.js`** | **The only file I edit** — entries, roadmap, currently-learning |
| `shared.css`, `render.js` | Theme + rendering engine (rarely touched) |

## Daily workflow

1. Open `data.js`
2. Copy an entry block, paste at the top of `entries`, edit date/mood/text/tags
3. Commit & push — site updates itself

Tick a roadmap item: `done: false` → `done: true`.

## Hosting

Static site — no build step, no backend. Hosted via GitHub Pages,
custom domain: **budaica.com** (+ resume.budaica.com → resume page).
