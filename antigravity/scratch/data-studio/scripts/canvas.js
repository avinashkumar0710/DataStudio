/* ==============================================
   DataStudio — Canvas / Widget Manager (canvas.js)
   ============================================== */
'use strict';

const CanvasManager = {

  /* ── Render entire page ── */
  renderPage(page, filters = []) {
    const grid  = document.getElementById('canvas-grid');
    const empty = document.getElementById('canvas-empty-state');

    // Remove existing widgets (not the empty state)
    Array.from(grid.querySelectorAll('.widget')).forEach(el => el.remove());

    if (!page || !page.widgets || !page.widgets.length) {
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    page.widgets.forEach(w => this.appendWidget(w, page, filters));
  },

  /* ── Append one widget ── */
  appendWidget(widget, page, filters) {
    const grid = document.getElementById('canvas-grid');
    const el   = this.buildElement(widget);
    grid.appendChild(el);
    this.renderContent(widget, el, filters);
    this.bindWidgetEvents(el, widget, page);
  },

  /* ── Build the DOM element ── */
  buildElement(w) {
    const el = document.createElement('div');
    el.className = 'widget';
    el.id = `widget-${w.id}`;
    el.style.cssText = `grid-column:${w.x+1} / span ${w.w}; grid-row:${w.y+1} / span ${w.h};`;
    el.innerHTML = `
      <div class="widget-header">
        <span class="widget-title" title="${w.title}">${w.title}</span>
        <div class="widget-actions">
          <button class="wact-btn" data-waction="edit"       title="Edit">✏️</button>
          <button class="wact-btn danger" data-waction="del" title="Delete">🗑</button>
        </div>
      </div>
      <div class="widget-body${w.type === 'table' ? ' no-padding' : ''}" id="wbody-${w.id}"></div>
      <div class="resize-handle" data-wid="${w.id}" title="Drag corner to resize">
        <span class="resize-size-badge" id="rsz-${w.id}">${w.w}×${w.h}</span>
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="11" y1="4"  x2="4"  y2="11"/>
          <line x1="11" y1="8"  x2="8"  y2="11"/>
          <line x1="11" y1="11" x2="11" y2="11" stroke-width="2"/>
        </svg>
      </div>
    `;
    return el;
  },

  /* ── Render widget content by type ── */
  renderContent(widget, el, filters) {
    const body = el.querySelector(`#wbody-${widget.id}`);
    if (!body) return;

    const { type } = widget;

    if (type === 'kpi')   { this._renderKPI(body, widget, filters);   return; }
    if (type === 'table') { this._renderTable(body, widget, filters); return; }
    if (type === 'gauge') { this._renderGauge(body, widget, filters); return; }

    // Chart types
    const wrap = document.createElement('div');
    wrap.className = 'chart-canvas-wrap';
    wrap.style.cssText = 'flex:1;min-height:0;position:relative;';
    const canvas = document.createElement('canvas');
    canvas.id = `canvas-${widget.id}`;
    wrap.appendChild(canvas);
    body.appendChild(wrap);

    const src = DataManager.getSource(widget.config.dataSourceId);
    if (!src) { body.innerHTML = '<div class="widget-no-data"><span>🔌</span>No data source</div>'; return; }
    const filtered = DataManager.applyFilters(src.data, filters);
    if (!filtered.length) { body.innerHTML = '<div class="widget-no-data"><span>📭</span>No data after filters</div>'; return; }

    requestAnimationFrame(() => ChartEngine.render(`canvas-${widget.id}`, widget, filtered));
  },

  /* ── KPI Card ── */
  _renderKPI(body, widget, filters) {
    const { config } = widget;
    const src = DataManager.getSource(config.dataSourceId);
    if (!src) { body.innerHTML = '<div class="kpi-wrap"><div class="kpi-value">—</div></div>'; return; }

    const data   = DataManager.applyFilters(src.data, filters);
    const vals   = data.map(r => Number(r[config.valueField])).filter(v => !isNaN(v));
    const aggFn  = config.aggFn || 'sum';
    let value    = 0;
    switch (aggFn) {
      case 'sum':   value = vals.reduce((a,b)=>a+b,0); break;
      case 'avg':   value = vals.reduce((a,b)=>a+b,0) / (vals.length||1); break;
      case 'count': value = data.length; break;
      case 'min':   value = Math.min(...vals); break;
      case 'max':   value = Math.max(...vals); break;
      default:      value = vals.reduce((a,b)=>a+b,0);
    }

    // Trend: compare first vs last half
    let changeClass = 'neutral', changeText = '';
    if (vals.length > 4) {
      const mid  = Math.floor(vals.length / 2);
      const avg1 = vals.slice(0, mid).reduce((a,b)=>a+b,0) / mid;
      const avg2 = vals.slice(mid).reduce((a,b)=>a+b,0) / (vals.length - mid);
      const pct  = avg1 ? ((avg2 - avg1) / avg1) * 100 : 0;
      changeClass = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
      changeText  = `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% vs prior period`;
    }

    const pct = vals.length ? Math.min(1, (value / (Math.max(...vals)||1))) : 0;

    body.innerHTML = `
      <div class="kpi-wrap">
        <div class="kpi-value">${this.fmtNum(value)}</div>
        <div class="kpi-label">${config.valueField} <span style="opacity:0.6">(${aggFn})</span></div>
        ${changeText ? `<div class="kpi-sub ${changeClass}">${changeText}</div>` : ''}
        <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${pct*100}%"></div></div>
      </div>
    `;
  },

  /* ── Data Table ── */
  _renderTable(body, widget, filters) {
    const { config } = widget;
    const src = DataManager.getSource(config.dataSourceId);
    if (!src) { body.innerHTML = '<div class="widget-no-data"><span>🔌</span>No data source</div>'; return; }

    const data = DataManager.applyFilters(src.data, filters);
    const cols = (config.columns && config.columns.length) ? config.columns : src.columns.slice(0, 7);
    const rows = data.slice(0, 200);

    body.innerHTML = `
      <div class="widget-table-wrap">
        <table class="widget-table">
          <thead><tr>${cols.map(c=>`<th title="${c}">${c}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td title="${r[c]??''}">${r[c]??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  },

  /* ── Gauge ── */
  _renderGauge(body, widget, filters) {
    const { config } = widget;
    const src = DataManager.getSource(config.dataSourceId);
    if (!src) { body.innerHTML = ''; return; }

    const data  = DataManager.applyFilters(src.data, filters);
    const vals  = data.map(r => Number(r[config.valueField])).filter(v => !isNaN(v));
    const aggFn = config.aggFn || 'avg';
    let value   = 0;
    switch (aggFn) {
      case 'avg':   value = vals.reduce((a,b)=>a+b,0) / (vals.length||1); break;
      case 'sum':   value = vals.reduce((a,b)=>a+b,0); break;
      case 'min':   value = Math.min(...vals); break;
      case 'max':   value = Math.max(...vals); break;
      case 'count': value = data.length; break;
      default:      value = vals.reduce((a,b)=>a+b,0) / (vals.length||1);
    }

    const maxVal  = config.maxValue ? Number(config.maxValue) : (Math.max(...vals) || 100);
    const pct     = Math.max(0, Math.min(1, value / maxVal));
    // Arc from -135° to 135° (270° total) → dasharray of 170 (radius=34)
    const arc     = 170; // circumference portion used
    const filled  = pct * arc;
    const color   = pct < 0.5 ? '#00d4aa' : pct < 0.8 ? '#ffa94d' : '#ff4d6d';

    body.innerHTML = `
      <div class="gauge-wrap">
        <svg viewBox="0 0 120 80" style="width:min(170px,100%);height:auto;overflow:visible">
          <circle cx="60" cy="62" r="34" fill="none" stroke="var(--border)" stroke-width="9"
            stroke-dasharray="${arc} 300" stroke-dashoffset="-${(300-arc)/2}"
            stroke-linecap="round" transform="rotate(135 60 62)"/>
          <circle cx="60" cy="62" r="34" fill="none" stroke="${color}" stroke-width="9"
            stroke-dasharray="${filled} 300" stroke-dashoffset="-${(300-arc)/2}"
            stroke-linecap="round" transform="rotate(135 60 62)"
            style="transition:stroke-dasharray 0.6s ease"/>
          <text x="60" y="65" text-anchor="middle" fill="var(--text-1)" font-size="13"
            font-weight="800" font-family="Inter">${this.fmtNum(value)}</text>
          <text x="60" y="74" text-anchor="middle" fill="var(--text-3)" font-size="5.5"
            font-family="Inter">${Math.round(pct*100)}% of ${this.fmtNum(maxVal)}</text>
        </svg>
        <div class="gauge-label">${config.valueField} (${aggFn})</div>
      </div>
    `;
  },

  /* ── Number formatter ── */
  fmtNum(v) {
    if (typeof v !== 'number' || isNaN(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1e12) return (v/1e12).toFixed(2)+'T';
    if (abs >= 1e9)  return (v/1e9).toFixed(2)+'B';
    if (abs >= 1e6)  return (v/1e6).toFixed(2)+'M';
    if (abs >= 1e3)  return (v/1e3).toFixed(1)+'K';
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  },

  /* ── Widget events: select, drag-to-move, action buttons, right-click, resize ── */
  bindWidgetEvents(el, widget, page) {

    // ── Select on click ──
    el.addEventListener('mousedown', e => {
      if (e.target.closest('.wact-btn') || e.target.closest('.resize-handle')) return;
      document.querySelectorAll('.widget.selected').forEach(w => w.classList.remove('selected'));
      el.classList.add('selected');
      App.selectedWidgetId = widget.id;
    });

    // ── Drag-to-move on header ──
    const header = el.querySelector('.widget-header');
    if (header) {
      let isDragging = false;
      let ghost = null, placeholder = null;
      let startMouseX, startMouseY;
      let pendingCol = widget.x, pendingRow = widget.y;

      const getGridCell = (clientX, clientY) => {
        const grid = document.getElementById('canvas-grid');
        const rect = grid.getBoundingClientRect();
        const PAD  = 18, GAP = 14, ROW_H = 58;
        const usableW = rect.width - PAD * 2 - GAP * 11;
        const colW    = usableW / 12;
        const col = Math.max(0, Math.min(12 - widget.w, Math.floor((clientX - rect.left - PAD) / (colW + GAP))));
        const row = Math.max(0, Math.floor((clientY - rect.top - PAD) / (ROW_H + GAP)));
        return { col, row };
      };

      const onMove = e => {
        const dx = Math.abs(e.clientX - startMouseX);
        const dy = Math.abs(e.clientY - startMouseY);

        // Start dragging after 6px of movement
        if (!isDragging && (dx > 6 || dy > 6)) {
          isDragging = true;

          // Ghost: floating semi-transparent copy
          ghost = document.createElement('div');
          ghost.className = 'widget-drag-ghost';
          ghost.style.cssText = `width:${el.offsetWidth}px;height:${el.offsetHeight}px;`;
          ghost.innerHTML = `<div class="widget-header" style="cursor:grabbing">
            <span class="widget-title">${widget.title}</span></div>
            <div class="widget-body" style="display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:0.8rem">Drop to move</div>`;
          document.body.appendChild(ghost);

          // Placeholder: dashed grid cell indicator
          placeholder = document.createElement('div');
          placeholder.className = 'widget-drop-placeholder';
          placeholder.style.gridColumn = `${widget.x+1} / span ${widget.w}`;
          placeholder.style.gridRow    = `${widget.y+1} / span ${widget.h}`;
          el.parentElement.appendChild(placeholder);

          // Dim the original
          el.style.opacity = '0.25';
          el.style.pointerEvents = 'none';
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'grabbing';
        }

        if (!isDragging) return;

        // Move ghost with cursor
        ghost.style.left = `${e.clientX - ghost.offsetWidth  / 2}px`;
        ghost.style.top  = `${e.clientY - 24}px`;

        // Update placeholder position
        const { col, row } = getGridCell(e.clientX, e.clientY);
        pendingCol = col;
        pendingRow = row;
        placeholder.style.gridColumn = `${col+1} / span ${widget.w}`;
        placeholder.style.gridRow    = `${row+1} / span ${widget.h}`;
      };

      const onUp = e => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor     = '';

        if (isDragging) {
          isDragging = false;
          ghost?.remove();       ghost       = null;
          placeholder?.remove(); placeholder = null;

          el.style.opacity       = '';
          el.style.pointerEvents = '';

          // Apply new position
          widget.x = pendingCol;
          widget.y = pendingRow;
          el.style.gridColumn = `${widget.x+1} / span ${widget.w}`;
          el.style.gridRow    = `${widget.y+1} / span ${widget.h}`;

          App.saveState();
          App.toast('Widget moved!', 'info');
        }
      };

      header.addEventListener('mousedown', e => {
        if (e.target.closest('.wact-btn')) return;
        e.preventDefault();
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        pendingCol  = widget.x;
        pendingRow  = widget.y;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });
    }

    // ── Action buttons ──
    el.querySelectorAll('[data-waction]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.waction === 'edit') App.openWidgetModal(widget.id);
        if (btn.dataset.waction === 'del')  App.deleteWidget(widget.id);
      });
    });

    // ── Right-click context menu ──
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      App.showContextMenu(e.clientX, e.clientY, widget.id);
    });

    // ── Resize handle ──
    const handle = el.querySelector('.resize-handle');
    const sizeBadge = el.querySelector(`#rsz-${widget.id}`);
    if (handle) {
      let startX, startY, startCol, startRow;
      let isResizing = false;

      const onResizeMove = e => {
        const grid = document.getElementById('canvas-grid');
        const rect = grid.getBoundingClientRect();
        const PAD   = 18, GAP = 14, ROW_H = 58;
        const colW  = (rect.width - PAD * 2 - GAP * 11) / 12;
        const dx    = e.clientX - startX;
        const dy    = e.clientY - startY;

        // Snap to grid increments
        const deltaCol = Math.round(dx / (colW + GAP));
        const deltaRow = Math.round(dy / (ROW_H + GAP));
        const newW = Math.max(2, Math.min(12 - widget.x, startCol + deltaCol));
        const newH = Math.max(2, Math.min(20, startRow + deltaRow));

        widget.w = newW;
        widget.h = newH;
        el.style.gridColumn = `${widget.x+1} / span ${newW}`;
        el.style.gridRow    = `${widget.y+1} / span ${newH}`;

        // Live size badge
        if (sizeBadge) {
          sizeBadge.textContent = `${newW}×${newH}`;
          sizeBadge.style.opacity = '1';
        }
      };

      const onResizeUp = () => {
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup',   onResizeUp);
        document.body.style.cursor     = '';
        document.body.style.userSelect = '';
        el.classList.remove('resizing');
        isResizing = false;

        // Fade out the badge
        if (sizeBadge) setTimeout(() => { sizeBadge.style.opacity = ''; }, 800);

        // ✅ Re-render the chart so it fills the new size
        const page = App.getCurrentPage();
        if (page) {
          const filters = page.filters || [];
          // For Chart.js types: destroy & re-render
          const inst = ChartEngine.instances[`canvas-${widget.id}`];
          if (inst) {
            requestAnimationFrame(() => inst.resize());
          } else {
            // KPI / Table / Gauge — just re-render
            CanvasManager.refreshWidget(widget.id, filters);
          }
        }
        App.saveState();
      };

      handle.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        isResizing = true;
        startX   = e.clientX; startY   = e.clientY;
        startCol = widget.w;  startRow = widget.h;
        document.body.style.cursor     = 'se-resize';
        document.body.style.userSelect = 'none';
        el.classList.add('resizing');
        if (sizeBadge) sizeBadge.style.opacity = '1';
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup',   onResizeUp);
      });
    }
  },

  /* ── Refresh a single widget ── */
  refreshWidget(widgetId, filters) {
    const page   = App.getCurrentPage();
    const widget = page?.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    ChartEngine.destroy(`canvas-${widgetId}`);
    const el = document.getElementById(`widget-${widgetId}`);
    if (!el) return;
    const body = el.querySelector(`#wbody-${widgetId}`);
    if (body) { body.innerHTML = ''; body.className = `widget-body${widget.type==='table'?' no-padding':''}`; }
    this.renderContent(widget, el, filters);
  },
};
