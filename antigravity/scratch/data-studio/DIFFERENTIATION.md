# DataStudio vs Power BI — Differentiation & Feature Roadmap

> Scope: compares **DataStudio** (`antigravity/scratch/data-studio`) — a local, browser-based, single-user dashboard tool — against **Microsoft Power BI** (the enterprise BI suite: Desktop + Service + Mobile).
> Date: 2026-07-15

---

## 1. What DataStudio is today

DataStudio is a **client-side, file-based, single-machine** analytics app. Everything runs in the browser; data, dashboards, and chat sessions live in `localStorage` or are shared as base64/gzip URL hashes. No server, no database, no account.

**Current capabilities**
- Data sources: CSV, JSON, and 3 built-in sample datasets (sales / population / stocks).
- Type inference + coercion; per-source column typing.
- Filters (`equals`, `contains`, `gt/lt/gte/lte`, `not_equals`).
- Aggregations: `groupBy` with `sum / avg / count / min / max`.
- Statistics: mean, median, stddev, min/max, completeness.
- Charts (Chart.js): bar, h-bar, line, area, pie, donut, scatter, bubble, mixed bar+line, KPI, table, gauge.
- Multi-page dashboards, themes, share-by-URL, export/import JSON.
- Built-in heuristic insights + optional AI (Gemini / OpenAI) summaries.
- Dev server (`server.js`) serves the static app on port 3000.

---

## 2. Side-by-side comparison

| Area | DataStudio | Power BI |
|------|-----------|----------|
| **Deployment** | Local browser only; static files + `server.js` | Desktop authoring + cloud Service + Mobile apps + Embedded |
| **Data connectors** | CSV, JSON, 3 samples | 150+ (SQL Server, Azure, Excel, Salesforce, REST, SAP, BigQuery…) + gateways |
| **Data prep / ETL** | Parse + filter + groupBy | Power Query (M): merge, append, pivot, custom columns, scheduled refresh |
| **Data model** | Flat per-source arrays | Relational model: tables, relationships, star schema, calculated columns |
| **Calculations** | Fixed `sum/avg/min/max/count` | DAX measures, time intelligence, ranked/running totals, what-if params |
| **Interactivity** | Filters + share link | Slicers, drill-down/drill-through, bookmarks, buttons, sync slicers |
| **Natural language** | None (manual chart config) | Power BI Q&A ("show sales by region") |
| **Sharing / publish** | URL hash (base64/gzip) | Workspaces, apps, publish-to-web, email subscriptions, Teams |
| **Security / governance** | None | Row-Level Security, workspaces, audit logs, sensitivity labels, tenant policies |
| **Refresh** | Manual reload | Scheduled + incremental + real-time streaming / DirectQuery |
| **AI** | Heuristic + optional LLM summary | Built-in AI visuals, Copilot, Azure ML integration, anomaly detection |
| **Mobile** | Responsive UI only | Dedicated mobile apps + mobile layout optimizer |
| **Alerts** | None | Data-driven alerts on KPIs/tiles |
| **Extensibility** | None | Custom visuals (marketplace), Power BI Embedded SDK, REST API |
| **Cost** | Free (local) | Free Desktop; Pro/Premium per-user/month for Service |
| **Multi-user / collaboration** | No | Yes (comments, shared workspaces, co-ownership) |

---

## 3. Differentiation summary

**Where DataStudio wins**
- Zero install, zero account, zero cost — open the folder, run `server.js`, done.
- Fully private: data never leaves the machine (AI is opt-in via user-supplied key).
- Shareable without a server: one URL hash carries the whole dashboard.
- Lightweight and hackable — pure HTML/JS, easy to extend.

**Where DataStudio is far behind Power BI**
- No real data connectivity, modeling, or relational joins.
- No DAX-style measures, time intelligence, or reusable calculated fields.
- No server, publishing, collaboration, security, or scheduled refresh.
- Single-user, single-machine, no governance.

**Positioning:** DataStudio is a **personal, exploratory, privacy-first BI scratchpad** — good for quick local analysis and prototyping. Power BI is an **enterprise reporting & governance platform**. They are not competitors; DataStudio competes more with tools like *Datawrapper*, *Observable*, or a lightweight *Tableau Public* alternative.

---

## 4. Functionality to add for users (prioritized roadmap)

### P0 — Core BI gaps (highest value)
1. **More data connectors** — Excel/XLSX, Google Sheets, REST/JSON API with auth, SQL (SQLite/Postgres/MySQL via WASM or a local proxy).
2. **Relational data model** — multiple sources, joins/relationships, a shared field dictionary.
3. **Calculated fields & measures** — user-defined formulas (a small expression engine) + time intelligence (YoY, MTD, moving avg).
4. **Interactive slicers + drill-down/drill-through** across widgets on a page.
5. **Cross-filtering** — clicking a chart filters other widgets (not just global filter bar).

### P1 — Collaboration, persistence & sharing
6. **Real persistence** — save dashboards to a local file/IndexedDB and optionally a backend, replacing fragile `localStorage` + URL-hash sharing.
7. **Export to image/PDF/PPTX** for reports (currently only JSON export).
8. **Scheduled refresh / auto-load** of live sources.
9. **Publish option** — optional lightweight server or export-to-static-host for sharing beyond a URL hash.

### P2 — Advanced analytics & UX
10. **Natural-language query** ("show revenue by region") backed by the existing LLM hook.
11. **More chart types** — maps/geo, treemap, waterfall, funnel, heatmap, histograms, box plots.
12. **Bookmarks & presentation mode** (like Power BI bookmarks/buttons).
13. **KPI alerts** — notify when a threshold is crossed.
14. **Mobile-optimized layout** builder.
15. **Row-Level Security / view roles** if multi-user is ever introduced.

### P3 — Hardening (from the security audit)
16. Fix `server.js` path traversal + bind to `127.0.0.1` + restrict CORS (see audit).
17. Never embed API keys in shared state; keep LLM keys in a secure store.

---

## 5. Suggested MVP next step
Implement **P0 #1 (Excel/REST connectors) + #3 (calculated measures) + #4 (slicers/cross-filter)** — these three move DataStudio from "chart viewer" to a real self-serve BI tool while staying local and free.
