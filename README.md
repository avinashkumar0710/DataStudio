# DataStudio → Power BI–Class BI Platform

Turn **DataStudio** from a local chart viewer into a self-service BI platform: real data sources, multi-table modeling, reusable measures, interactive dashboards, secure publishing, and governance.

### Done when
Users can connect to data, model/transform it, write measures, build cross-filtering drillable dashboards, publish/collaborate securely, and consume on web + mobile with NL Q&A.

### Scope
- **Connect:** files, SQL DBs, REST/OAuth2, streaming, credential vault, refresh
- **Model:** relationships, transforms, DAX-like measures, time intel, hierarchies
- **Visualize:** slicers, cross-filter, drill-through, bookmarks, mobile layouts
- **AI:** NL Q&A, forecasting, explain-a-visual
- **Share:** persistence, workspaces, export, embeds, comments
- **Secure:** RLS, auth, audit logs, secrets vault
- **Platform:** backend, refresh gateway, multi-user, web + mobile

### Phasing
1. Local modeling + interactivity MVP
2. Connectors + transforms
3. Server + collaboration
4. Enterprise + governance

See `POWERBI_REQUIREMENTS.md` for full spec and open questions.

---

# Deep Dive, Installation & Usage

## What DataStudio is today
DataStudio is a **client-side, browser-based, single-user BI scratchpad**. Everything runs in the browser — no database, no account, no cloud. Data, dashboards, and chat sessions live in `localStorage` or are shared as a base64/gzip **URL hash** (one link carries the whole dashboard).

**Architecture**
- `index.html` — app shell (header, page tabs, sidebar, canvas).
- `scripts/app.js` — main controller (state, pages, widgets, events).
- `scripts/data.js` — CSV/JSON parsing (PapaParse), type inference, filters, `groupBy` aggregations, stats.
- `scripts/charts.js` + `canvas.js` — Chart.js rendering, drag/resize, multi-page canvas.
- `scripts/insights.js` — heuristic insights + optional LLM (Gemini/OpenAI) summaries.
- `scripts/persistence.js` — `localStorage` save/load, JSON export/import, URL-hash sharing.
- `scripts/export.js` — JSON export.
- `server.js` — minimal Node static file server (port 3000) that also logs requests to `log/`.

**Current capabilities**
- Sources: CSV, JSON, and 3 built-in samples (sales / population / stocks).
- Filters (`equals`, `contains`, `gt/lt/gte/lte`, `not_equals`); aggregations (`sum/avg/count/min/max`); stats (mean, median, stddev, completeness).
- Charts: bar, h-bar, line, area, pie, donut, scatter, bubble, mixed bar+line, KPI, table, gauge.
- Multi-page dashboards, themes, share-by-URL, export/import JSON, optional AI summaries.

## Why the project exists
The goal is to evolve this private, hackable scratchpad into a **Power BI–class self-service platform** while keeping its core wins: zero install, zero cost, fully private (data never leaves the machine). The gap is real data connectivity, relational modeling, measures, interactivity, and governance — captured in `POWERBI_REQUIREMENTS.md` and `DIFFERENTIATION.md`.

## Installation

> Requirements: **Node.js 16+** (for the dev server) and a modern browser (Chrome/Edge/Firefox). No build step, no dependencies to install — Chart.js and PapaParse load from CDN.

```bash
# 1. Clone the repository
git clone <your-repo-url> DataStudio
cd DataStudio

# 2. (Optional) run the bundled static server
node server.js
# → DataStudio Server running at http://localhost:3000

# 3. Open in browser
# Either use the server URL above, or just open index.html directly (file://)
```

No `npm install` is needed — all runtime dependencies are loaded via CDN in `index.html`.

## Usage (local, today)
1. **Start** — open `http://localhost:3000` (or `index.html`).
2. **Add data** — click **Data** (header) → upload a CSV/JSON or pick a sample dataset. Columns are auto-typed.
3. **Filter** — use the global filter bar to scope rows (`equals`, `contains`, numeric ranges).
4. **Add widgets** — click **Add Widget**, choose a chart type, pick X/Y fields and an aggregation (`sum/avg/count/min/max`).
5. **Build pages** — use **+** tab to add dashboard pages; drag/resize widgets on the canvas.
6. **Insights / AI** — open the insights panel for heuristics; optionally paste a Gemini/OpenAI key for natural-language summaries.
7. **Save / share** — export the dashboard as JSON, or copy the **share URL** (the full state is encoded in the URL hash).
8. **Logs** — `server.js` writes per-day logs to `log/app-YYYY-MM-DD.log`.

## Roadmap at a glance (phased)
- **Phase 1 — Local modeling + interactivity MVP:** multi-table model, relationships, measures, slicers, cross-filter. Usable with no server.
- **Phase 2 — Connectors + transforms:** Excel/SQL/REST, Power Query–like transforms, time intelligence, more chart types, NL Q&A.
- **Phase 3 — Server + collaboration:** backend persistence, publishing, workspaces, export (PDF/PNG/PPTX/Excel), embed links, comments.
- **Phase 4 — Enterprise + governance:** RLS, auth, audit logs, secrets vault, forecasting, mobile layout optimizer, monitoring.

## Security note (from audit)
`server.js` currently binds to all interfaces with open CORS and has a path-traversal risk. Phase 4 / hardening (SEC-1) will bind to `127.0.0.1`, restrict CORS, sanitize paths, and move API/AI keys into a secrets vault instead of shared state.
