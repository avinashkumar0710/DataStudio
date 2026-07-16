# Requirements: Evolving DataStudio into a Power BI–Class BI Platform

> Goal: define the capabilities required to take **DataStudio** (`antigravity/scratch/data-studio`) from a local single-user chart viewer to a **Power BI–class** self-service business-intelligence platform.
> Reference: Microsoft Power BI (Desktop + Service + Mobile) feature set.
> Date: 2026-07-16

---

## 0. Definition of "Done"

DataStudio is Power BI–class when a user can:
1. Connect to real data sources (files, databases, cloud services, APIs).
2. Model and transform data across multiple related tables.
3. Build reusable measures with a formula language.
4. Design interactive, drillable dashboards with cross-filtering.
5. Secure, publish, schedule, and collaborate on reports.
6. Consume reports on web and mobile, with alerts and natural-language Q&A.

---

## 1. Data Connectivity (REQ-CONN)

| ID | Requirement | Notes |
|----|-------------|-------|
| CONN-1 | Flat-file connectors: CSV, TSV, Excel (.xlsx), JSON, Parquet | Replace current CSV/JSON-only parsing |
| CONN-2 | Database connectors: SQLite, PostgreSQL, MySQL, SQL Server | Via WASM driver or a local proxy/bridge |
| CONN-3 | Cloud/REST connectors: REST/GraphQL APIs with auth (API key, OAuth2, bearer) | Generic REST + common SaaS (Sheets, Salesforce) |
| CONN-4 | Streaming/real-time sources: WebSocket, Server-Sent Events | For live tiles |
| CONN-5 | Connection management: saved connections, credentials vault, reconnection | Securely store creds (not in URL hash) |
| CONN-6 | Incremental / scheduled refresh of sources | Background refresh with last-refresh timestamp |

---

## 2. Data Preparation & Modeling (REQ-MODEL)

| ID | Requirement | Notes |
|----|-------------|-------|
| MODEL-1 | Multi-table data model with named tables | Replace flat per-source arrays |
| MODEL-2 | Relationships: one-to-many / many-to-one, active/inactive, cross-filter direction | Star/snowflake schema support |
| MODEL-3 | Transform engine (Power Query–like "M" equivalent): merge, append, pivot/unpivot, split columns, fill, replace, dedupe, custom column | Visual step builder + formula option |
| MODEL-4 | Calculated columns and **measures** via an expression language (DAX-like) | Aggregations over context |
| MODEL-5 | Time intelligence: YoY, MoM, MTD/QTD/YTD, moving average, date dimension table | Requires a date table generator |
| MODEL-6 | Hierarchies (e.g., Year→Quarter→Month; Geo) for drill-down | |
| MODEL-7 | Data profiling & quality view (distinct counts, null %, type suggestions) | Extend existing `stats()` |

---

## 3. Visualization & Interactivity (REQ-VIZ)

| ID | Requirement | Notes |
|----|-------------|-------|
| VIZ-1 | Current chart types retained (bar, line, area, pie, scatter, bubble, KPI, table, gauge, mixed) | |
| VIZ-2 | Add: maps/geo, treemap, waterfall, funnel, heatmap, histogram, box plot, ribbon | |
| VIZ-3 | **Slicers** (dropdown, list, range, date) bound to model fields | |
| VIZ-4 | **Cross-filtering / cross-highlighting** across widgets on a page | Click chart → filter others |
| VIZ-5 | **Drill-down / drill-through** using hierarchies and target pages | |
| VIZ-6 | **Bookmarks & buttons** to switch states/layouts (presentation mode) | |
| VIZ-7 | Theming: custom palettes, report-level themes, conditional formatting | |
| VIZ-8 | Tooltips (report/page/visual-level) with detail tiles | |
| VIZ-9 | Mobile layout optimizer (reflow widgets for phone) | |

---

## 4. Analytics & AI (REQ-AI)

| ID | Requirement | Notes |
|----|-------------|-------|
| AI-1 | Keep heuristic insights engine | Already present |
| AI-2 | **Natural-language Q&A**: "show revenue by region" → auto chart | Build on existing LLM hook |
| AI-3 | Anomaly detection / forecasting on time series | |
| AI-4 | Explain-a-visual (why did this change?) | |
| AI-5 | Secure key handling for AI providers (vault, not in share state) | From security audit |

---

## 5. Publishing, Sharing & Collaboration (REQ-SHARE)

| ID | Requirement | Notes |
|----|-------------|-------|
| SHARE-1 | Replace `localStorage` + URL-hash sharing with **real persistence** (IndexedDB + optional backend) | |
| SHARE-2 | **Publish to a server/service** (workspace, report catalog) | Needs backend (REQ-PLAT) |
| SHARE-3 | Workspaces / folders, ownership, co-editing | |
| SHARE-4 | Export: PDF, PNG, PPTX, Excel of underlying data | Currently JSON-only |
| SHARE-5 | Embed mode (iframe / public link) with token | |
| SHARE-6 | Comments / annotations on visuals | |
| SHARE-7 | Email subscriptions / scheduled snapshot delivery | |

---

## 6. Security & Governance (REQ-SEC)

| ID | Requirement | Notes |
|----|-------------|-------|
| SEC-1 | Fix `server.js` path traversal + bind `127.0.0.1` + restrict CORS | From audit |
| SEC-2 | **Row-Level Security (RLS)**: role-based row filters | |
| SEC-3 | Authentication / authorization for published reports | |
| SEC-4 | Sensitivity labels & audit logs | |
| SEC-5 | Tenant/admin policies (if multi-org) | |
| SEC-6 | Secrets vault for connections & AI keys | |

---

## 7. Platform & Infrastructure (REQ-PLAT)

| ID | Requirement | Notes |
|----|-------------|-------|
| PLAT-1 | **Backend service** (API + storage) for persistence, auth, publishing | Node/Go service; DB (Postgres/SQLite) |
| PLAT-2 | **Refresh service / gateway** for scheduled & on-prem refreshes | |
| PLAT-3 | Multi-user accounts & roles | |
| PLAT-4 | Web app shell + Mobile apps (responsive + native) | |
| PLAT-5 | Embedding SDK / REST API for ISV embedding | |
| PLAT-6 | Monitoring, usage analytics, cost/governance dashboards | |

---

## 8. Phased Delivery Plan

- **Phase 1 — Modeling & Interactivity (MVP for "real BI")**
  CONN-1, MODEL-1/2/4, VIZ-3/4/5, SHARE-1.
  *Outcome: local multi-table model, measures, slicers, cross-filter — usable without a server.*

- **Phase 2 — Connectors & Transforms**
  CONN-2/3, MODEL-3/5/6, VIZ-2/6/7, AI-2.

- **Phase 3 — Server & Collaboration**
  PLAT-1/2/3, SHARE-2/3/4/5/6/7, SEC-3/6.

- **Phase 4 — Enterprise & Governance**
  SEC-2/4/5, AI-3/4, PLAT-4/5/6, VIZ-8/9.

---

## 9. Open Questions / Decisions

1. Fully local-only (no server) vs. requiring a backend for sharing/collab?
2. Expression language: adopt an existing one (e.g., a DAX-subset) or invent a small DSL?
3. Target storage: IndexedDB alone, or mandated backend from day one?
4. Licensing/cost model (Power BI splits free Desktop vs. paid Service) — same split here?

---

## 10. Traceability to Prior Audit

Security items from the earlier audit map to: SEC-1 (path traversal / CORS / bind), SEC-6 (API-key vault), and SHARE-1 (stop embedding full state in URL hashes).
