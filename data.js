/* ============================================================
   data.js  ·  THE ONLY FILE YOU EDIT
   ------------------------------------------------------------
   HOW TO LOG YOUR DAY:
     1. Copy one ENTRY block below
     2. Paste it at the TOP of the entries list
     3. Change date / mood / text / tags
     4. Save. Done. The site updates itself.

   HOW TO TICK A ROADMAP ITEM:
     Change  done: false  →  done: true

   HOW TO CHANGE "CURRENTLY LEARNING":
     Edit the currentlyLearning block.

   No HTML needed. Ever. (Dates use YYYY-MM-DD format.)
   ============================================================ */

const SITE_DATA = {

  /* The day you started this journey — powers the "Day N" counter */
  startedDate: "2026-08-01",

  /* ---------------- CURRENTLY LEARNING ---------------- */
  currentlyLearning: {
    topic: "Automotive Ethernet & SOME/IP fundamentals",
    why: "next-gen HIL postings keep asking for it — CAN/CAN-FD already covered",
    since: "2026-08-01",
    note: "Classic-bus validation is home turf. Ethernet is the gap to close."
  },

  /* ---------------- LEARNING ROADMAP ---------------- */
  /* done: true = ticked. Progress bar fills automatically. */
  roadmap: [
    {
      phase: "Phase 1 · Professional core (proven at Bosch)",
      items: [
        { name: "ADAS HIL validation — PAS / PSL / SDW", done: true },
        { name: "UDS & DTC diagnostics — ISO 14229", done: true },
        { name: "CANoe / CAPL / vTESTstudio automation", done: true }
      ]
    },
    {
      phase: "Phase 2 · Deepen the bus",
      items: [
        { name: "CAN-FD advanced scenarios", done: false },
        { name: "Automotive Ethernet & SOME/IP", done: false },
        { name: "DBC authoring at scale", done: false }
      ]
    },
    {
      phase: "Phase 3 · Automation power-ups",
      items: [
        { name: "pytest & structured test design", done: false },
        { name: "python-can home lab", done: false },
        { name: "Auto-generated test reports", done: false }
      ]
    },
    {
      phase: "Phase 4 · Home bench",
      items: [
        { name: "Mini HIL bench build", done: false },
        { name: "Fault-injection practice rig", done: false },
        { name: "Publish tools on GitHub", done: false }
      ]
    },
    {
      phase: "Phase 5 · Domain breadth",
      items: [
        { name: "ISO 26262 fundamentals", done: false },
        { name: "AUTOSAR basics", done: false },
        { name: "dSPACE / NI VeriStand concepts", done: false }
      ]
    },
    {
      phase: "Phase 6 · Job ready",
      items: [
        { name: "Resume page live on budaica.com", done: false },
        { name: "LinkedIn aligned with the site", done: false },
        { name: "STAR bank → 3 war stories rehearsed", done: false }
      ]
    }
  ],

  /* ---------------- LONGER POSTS ---------------- */
  /* HOW TO WRITE A FULL POST (Markdown — no HTML):
     1. Copy posts/_template.md to posts/your-slug.md
        (lowercase, hyphens, e.g. posts/spi-vs-i2c-vs-uart.md)
     2. Write your post in Markdown. Images go in posts/img/
        and are referenced as  ![caption](img/photo.png)
     3. Register it below with:
          file: "post.html?p=your-slug"
     4. Commit. Done — the reader page renders it automatically.
     (Old hand-written .html posts like the full-duplex one
      still work exactly as before.)                              */
  posts: [
    {
      date: "2026-07-30",
      title: "What full-duplex really means (and why SPI confused me)",
      file: "posts/what-full-duplex-means.html",
      summary: "Phone call vs walkie-talkie vs radio station — the duplex types finally sorted out, and why SPI's two wires make it full-duplex.",
      tags: ["learning", "SPI"]
    }
  ],

  /* ---------------- FIELD NOTES (your log) ---------------- */
  /* Newest entry goes FIRST in the list.                      */
  /* mood: any emoji. tags: pick from learning / life / career / website — or invent your own. */
  entries: [
    {
      date: "2026-08-01",
      mood: "📄",
      tags: ["career", "website"],
      text: "Handed over my STAR bank (20 stories) and my resume — the resume page is real now: Bosch HIL validation, the PUF research, actual numbers. Funny how much stronger it looks when it's all in one place. Next: tick the roadmap boxes for real."
    },
    {
      date: "2026-08-01",
      mood: "🚀",
      tags: ["website", "life"],
      text: "Day one. Built this place — part journal, part resume, all mine. The rule: write for myself, but nothing here should embarrass me if a stranger reads it. Let's see where the road goes."
    },
    {
      date: "2026-07-30",
      mood: "💡",
      tags: ["learning", "SPI"],
      text: "Full-duplex finally clicked: both directions AT THE SAME TIME — like a phone call, not a walkie-talkie. SPI is full-duplex because MISO and MOSI have separate wires. Half-duplex = taking turns. Simplex = one-way street."
    },
    {
      date: "2026-07-25",
      mood: "🌧️",
      tags: ["life"],
      text: "Long day at work, brain was empty. Still opened the notes and wrote two lines. Hard work buys freedom — even on the days it doesn't feel like it."
    },
    {
      date: "2026-07-20",
      mood: "🎯",
      tags: ["career", "learning"],
      text: "Decision made: targeting Bench / HIL testing roles in automotive. My CAN & CAN-FD trace analysis experience transfers directly — I'm not switching fields, I'm aiming the same skills at the right target."
    }
  ]
};
