/* ==============================================
   DataStudio — App Controller (app.js)
   ============================================== */
'use strict';

const App = {
  /* ── State ── */
  state: {
    pages:          [],
    currentPageId:  null,
    activeSourceId: null,
    theme:          'dark',
    settings: { aiProvider:'heuristic', aiApiKey:'', defaultWidgetSize:'medium' },
  },

  selectedWidgetId: null,
  _previewChart:    null,
  _pendingFile:     null,
  _pendingApi:      null,

  /* ─────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────── */
  init() {
    this._loadState();
    this._applyTheme();
    this._renderTabs();
    this._renderPage();
    this._renderSidebar();
    this._bindAll();
    // If the URL contains a shared dashboard, load it (overrides local state)
    if (location.hash.includes('dash=')) {
      this._loadFromShareHash();
    }
  },

  /* ─────────────────────────────────────────────
     PERSISTENCE
  ───────────────────────────────────────────── */
  saveState() {
    try {
      const payload = {
        ...this.state,
        _sources: DataManager.serialise(),
        // Include chat sessions for each page
        _chatSessions: PersistenceManager.getAllChatSessions()
      };
      localStorage.setItem('ds_v2', JSON.stringify(payload));
    } catch(e) { console.warn('Save failed:', e); }
  },

  _loadState() {
    try {
      const raw = localStorage.getItem('ds_v2');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved._sources) { DataManager.restore(saved._sources); delete saved._sources; }
        this.state = { ...this.state, ...saved };
        
        // Restore chat sessions for each page
        const chatSessions = PersistenceManager.getAllChatSessions();
        this.state.pages.forEach(page => {
          if (chatSessions[page.id]) {
            page.chatSession = chatSessions[page.id];
          }
        });
      }
    } catch(e) { console.warn('Load state failed:', e); }

    if (!this.state.pages.length) this._addPage(false);
    if (!this.state.currentPageId) this.state.currentPageId = this.state.pages[0].id;
  },

  _saveDashboard() {
    if (PersistenceManager.exportDashboard(this.state, DataManager)) {
      this.toast('Dashboard exported successfully.','success');
    } else {
      this.toast('Failed to export dashboard.','error');
    }
  },

  _loadDashboard(state, sources) {
    try {
      DataManager.restore(sources);
      this.state = { ...this.state, ...state };
      this._renderTabs();
      this._renderPage();
      this._renderSidebar();
      this.toast('Dashboard imported successfully.','success');
    } catch(e) {
      console.error('Load dashboard failed:', e);
      this.toast('Failed to import dashboard.','error');
    }
  },

  /* ─────────────────────────────────────────────
     SHARE
  ───────────────────────────────────────────── */
  openShareModal() {
    const input = document.getElementById('share-link-input');
    const status = document.getElementById('share-status');
    if (input) input.value = '';
    if (status) status.innerHTML = '';
    this.openModal('share-modal');
  },

  async generateShareLink() {
    const input  = document.getElementById('share-link-input');
    const status = document.getElementById('share-status');
    const compress = document.getElementById('share-compress')?.checked !== false;
    if (!input) return;

    try {
      if (status) status.innerHTML = '⏳ Generating link…';
      const { data } = await PersistenceManager.encodeShare(this.state, DataManager, compress);
      const url = `${location.origin}${location.pathname}#dash=${data}`;
      input.value = url;
      input.select();
      if (status) {
        const kb = Math.round((data.length * 3 / 4) / 1024);
        status.innerHTML = `✅ Link ready (${(compress ? 'compressed' : 'raw')}, ~${kb} KB). Anyone with this link can view your dashboard.`;
      }
      this.toast('Share link generated.','success');
    } catch(e) {
      console.error('Share failed:', e);
      if (status) status.innerHTML = `❌ ${e.message}`;
      this.toast('Failed to generate link.','error');
    }
  },

  async _loadFromShareHash() {
    const hash = location.hash || '';
    const m = hash.match(/dash=([^&]+)/);
    if (!m) return false;
    try {
      const payload = await PersistenceManager.decodeShare(decodeURIComponent(m[1]));
      // Restore chat sessions
      if (payload.chat) {
        Object.entries(payload.chat).forEach(([pid, sess]) => {
          PersistenceManager.saveChatSession(pid, sess.messages || []);
        });
      }
      this._loadDashboard(payload.state, payload.sources);
      this.toast('Loaded shared dashboard from link.','success');
      return true;
    } catch(e) {
      console.error('Share load failed:', e);
      this.toast('Could not load shared dashboard.','error');
      return false;
    }
  },

  /* ─────────────────────────────────────────────
     PAGES
  ───────────────────────────────────────────── */
  _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); },

  _addPage(save = true) {
    const id   = this._uid();
    const page = { id, name:`Page ${this.state.pages.length+1}`, widgets:[], filters:[] };
    this.state.pages.push(page);
    this.state.currentPageId = id;
    if (save) { this.saveState(); this._renderTabs(); this._renderPage(); this._renderSidebar(); }
    return page;
  },

  _deletePage(id) {
    if (this.state.pages.length <= 1) { this.toast('Cannot delete the last page.','error'); return; }
    // Destroy chart instances on that page
    const page = this.state.pages.find(p=>p.id===id);
    page?.widgets.forEach(w => ChartEngine.destroy(`canvas-${w.id}`));
    this.state.pages = this.state.pages.filter(p=>p.id!==id);
    if (this.state.currentPageId === id) this.state.currentPageId = this.state.pages[0].id;
    this.saveState(); this._renderTabs(); this._renderPage();
  },

  _renamePage(id, name) {
    const page = this.state.pages.find(p=>p.id===id);
    if (page && name) { page.name = name.trim(); this.saveState(); this._renderTabs(); }
  },

  getCurrentPage() { return this.state.pages.find(p=>p.id===this.state.currentPageId) || null; },

  /* ─────────────────────────────────────────────
     FILTERS
  ───────────────────────────────────────────── */
  _addFilter(col, op, val) {
    const page = this.getCurrentPage();
    if (!page) return;
    if (!page.filters) page.filters = [];
    page.filters.push({ column:col, operator:op, value:val });
    this.saveState();
    this._renderFilters();
    this._renderPage();
    this.toast('Filter applied.','success');
  },

  _editFilter(idx, col, op, val) {
    const page = this.getCurrentPage();
    if (!page?.filters || idx < 0 || idx >= page.filters.length) return;
    page.filters[idx] = { column:col, operator:op, value:val };
    this.saveState();
    this._renderFilters();
    this._renderPage();
    this.toast('Filter updated.','success');
  },

  _removeFilter(idx) {
    const page = this.getCurrentPage();
    if (!page?.filters) return;
    page.filters.splice(idx, 1);
    this.saveState();
    this._renderFilters();
    this._renderPage();
  },

  _switchPage(id) {
    this.state.currentPageId = id;
    this.saveState();
    this._renderTabs();
    this._renderPage();
    this._renderSidebar();
  },

  /* ─────────────────────────────────────────────
     RENDER TABS
  ───────────────────────────────────────────── */
  _renderTabs() {
    const container = document.getElementById('page-tabs');
    container.innerHTML = this.state.pages.map(p => `
      <button class="page-tab ${p.id===this.state.currentPageId?'active':''}" data-page-id="${p.id}">
        ${this._esc(p.name)}
        <span class="tab-close" data-close-page="${p.id}" title="Delete page">✕</span>
      </button>
    `).join('');
  },

  /* ─────────────────────────────────────────────
     RENDER PAGE
  ───────────────────────────────────────────── */
  _renderPage() {
    const page = this.getCurrentPage();
    if (!page) return;
    CanvasManager.renderPage(page, page.filters||[]);
  },

  /* ─────────────────────────────────────────────
     SIDEBAR
  ───────────────────────────────────────────── */
  _renderSidebar() {
    this._renderSources();
    this._renderFields();
    this._renderFilters();
    this._renderVizPanel();
  },

  _renderSources() {
    const list    = document.getElementById('datasource-list');
    const sources = Object.values(DataManager.sources);
    if (!sources.length) { list.innerHTML='<div class="sidebar-empty">No data loaded yet</div>'; return; }
    list.innerHTML = sources.map(s=>`
      <div class="datasource-item ${s.id===this.state.activeSourceId?'active':''}" data-sid="${s.id}">
        <span class="ds-icon">${s.name.toLowerCase().includes('api')||s.name.toLowerCase().includes('http')?'🌐':'📄'}</span>
        <div class="ds-info">
          <div class="ds-name" title="${s.name}">${s.name}</div>
          <div class="ds-meta">${s.rowCount.toLocaleString()} rows · ${s.columns.length} cols</div>
        </div>
        <div class="ds-actions">
          <button class="ds-view" data-view-src="${s.id}" title="Open data in table view">👁</button>
          <button class="ds-delete" data-del-src="${s.id}" title="Remove source">✕</button>
        </div>
      </div>
    `).join('');
  },

  _renderFields() {
    const list  = document.getElementById('field-list');
    const badge = document.getElementById('field-count');
    const src   = DataManager.getSource(this.state.activeSourceId);
    if (!src) { list.innerHTML='<div class="sidebar-empty">Select a data source</div>'; badge.textContent='0'; return; }
    badge.textContent = src.columns.length;
    list.innerHTML = src.columns.map(col=>{
      const t   = src.types[col];
      const cls = t==='number'?'fb-number':t==='date'?'fb-date':'fb-string';
      const lbl = t==='number'?'123':t==='date'?'DATE':'ABC';
      return `<div class="field-item"><span class="field-badge ${cls}">${lbl}</span><span class="field-name" title="${col}">${col}</span></div>`;
    }).join('');
  },

  _renderFilters() {
    const list = document.getElementById('filter-list');
    const page = this.getCurrentPage();
    const filters = page?.filters || [];
    if (!filters.length) { list.innerHTML='<div class="sidebar-empty">No active filters</div>'; return; }
    list.innerHTML = filters.map((f,i)=>`
      <div class="filter-chip">
        <span class="filter-chip-text">${f.column} ${f.operator} "${f.value}"</span>
        <div class="filter-chip-actions">
          <button class="filter-chip-edit" data-edit-filter="${i}" title="Edit filter">✏️</button>
          <button class="filter-chip-del" data-del-filter="${i}" title="Remove filter">✕</button>
        </div>
      </div>
    `).join('');
  },

  /* ─────────────────────────────────────────────
     VISUALIZATIONS PANEL (middle)
  ───────────────────────────────────────────── */
  _renderVizPanel() {
    const dsSelect = document.getElementById('viz-ds-select');
    const list     = document.getElementById('viz-list');
    if (!dsSelect || !list) return;

    const sources = Object.values(DataManager.sources);
    dsSelect.innerHTML = '<option value="">Select data source…</option>'
      + sources.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    if (this.state.activeSourceId) dsSelect.value = this.state.activeSourceId;

    if (!sources.length) {
      list.innerHTML = '<div class="viz-empty">Load a data source to add visualizations.</div>';
      return;
    }

    list.innerHTML = CHART_TYPES.map(ct=>`
      <div class="viz-card" data-viz="${ct.id}">
        <div class="viz-card-head">
          <span class="viz-card-icon">${ct.icon}</span>
          <span class="viz-card-label">${ct.label}</span>
          <button class="viz-card-add" data-add-viz="${ct.id}" title="Add ${ct.label}">+</button>
        </div>
        <div class="viz-card-body" id="viz-body-${ct.id}"></div>
      </div>
    `).join('');

    // Populate config bodies for the currently selected source
    this._refreshVizBodies();
  },

  /* Fill each viz card's config body based on the selected data source. */
  _refreshVizBodies() {
    const dsId = document.getElementById('viz-ds-select')?.value;
    const src  = DataManager.getSource(dsId);
    CHART_TYPES.forEach(ct => {
      const body = document.getElementById(`viz-body-${ct.id}`);
      if (!body) return;
      if (!src) { body.innerHTML = '<div class="viz-empty">Select a data source above.</div>'; return; }
      body.innerHTML = this._buildFieldInputs(ct, src, {}, 'vz', body);
    });
  },

  /* ─────────────────────────────────────────────
     WIDGET MODAL (Add / Edit)
  ───────────────────────────────────────────── */
  openWidgetModal(editId = null) {
    const modal  = document.getElementById('widget-modal');
    const isEdit = !!editId;
    document.getElementById('widget-modal-title').textContent = isEdit ? 'Edit Widget' : 'Add Widget';
    document.getElementById('confirm-widget-btn').textContent = isEdit ? 'Save Changes' : 'Add to Dashboard';

    let editWidget = null;
    if (isEdit) editWidget = this.getCurrentPage()?.widgets.find(w=>w.id===editId) || null;

    let selectedType = editWidget?.type || 'bar';

    /* Build chart type grid */
    const grid = document.getElementById('chart-type-grid');
    grid.innerHTML = CHART_TYPES.map(ct=>`
      <div class="ct-card ${ct.id===selectedType?'active':''}" data-ct="${ct.id}">
        <span class="ct-icon">${ct.icon}</span>
        <span>${ct.label}</span>
      </div>
    `).join('');

    /* Populate data source select */
    const dsSelect = document.getElementById('widget-ds-select');
    const sources  = Object.values(DataManager.sources);
    dsSelect.innerHTML = '<option value="">Select data source…</option>'
      + sources.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    if (editWidget) dsSelect.value = editWidget.config.dataSourceId || '';
    else if (this.state.activeSourceId) dsSelect.value = this.state.activeSourceId;

    /* Pre-fill title */
    document.getElementById('widget-title-input').value = editWidget?.title || '';

    const updateFields = () => {
      const dsId = dsSelect.value;
      const src  = DataManager.getSource(dsId);
      const ct   = CHART_TYPES.find(c=>c.id===selectedType);
      const cont = document.getElementById('widget-field-inputs');
      if (!src || !ct) { cont.innerHTML='<div class="sidebar-empty">Select a data source first</div>'; return; }
      cont.innerHTML = this._buildFieldInputs(ct, src, editWidget?.config || {}, 'wf');
      this._updatePreview(selectedType, dsId);
    };

    /* Attach type card clicks */
    grid.addEventListener('click', e => {
      const card = e.target.closest('.ct-card');
      if (!card) return;
      grid.querySelectorAll('.ct-card').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
      selectedType = card.dataset.ct;
      updateFields();
    });

    dsSelect.addEventListener('change', updateFields);
    document.getElementById('widget-field-inputs').addEventListener('change', () => {
      // Rebuild from the CURRENT selections (not the saved config) so the user's
      // in-progress X/Y change is preserved and the hint/preview stay in sync.
      const dsId = dsSelect.value;
      const src  = DataManager.getSource(dsId);
      const ct   = CHART_TYPES.find(c=>c.id===selectedType);
      const cont = document.getElementById('widget-field-inputs');
      if (!src || !ct) return;
      const current = this._collectConfig(selectedType, dsId, src, 'wf', cont);
      cont.innerHTML = this._buildFieldInputs(ct, src, current, 'wf', cont);
      this._updatePreview(selectedType, dsId);
    });

    /* Confirm button */
    const btn    = document.getElementById('confirm-widget-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      const dsId   = dsSelect.value;
      const src    = DataManager.getSource(dsId);
      const title  = document.getElementById('widget-title-input').value.trim() || CHART_TYPES.find(c=>c.id===selectedType)?.label || 'Widget';
      if (!dsId || !src) { this.toast('Select a data source.','error'); return; }
      const config = this._collectConfig(selectedType, dsId, src);

      if (isEdit) {
        const w = this.getCurrentPage()?.widgets.find(w=>w.id===editId);
        if (w) { w.type=selectedType; w.title=title; w.config=config; }
      } else {
        const page = this.getCurrentPage();
        const { w, h } = this._defaultSize();
        const page_widgets = page.widgets;
        // Find next free Y row
        const nextY = page_widgets.length ? Math.max(...page_widgets.map(ww=>ww.y+ww.h)) : 0;
        page_widgets.push({ id:this._uid(), type:selectedType, title, x:0, y:nextY, w, h, config });
      }

      this.saveState();
      this.closeModal('widget-modal');
      this._renderPage();
      this.toast(isEdit ? 'Widget updated!':'Widget added! 🎉','success');
    });

    modal.classList.add('open');
    updateFields();
  },

  _defaultSize() {
    const sz = this.state.settings?.defaultWidgetSize || 'medium';
    const map = { small:{w:4,h:4}, medium:{w:6,h:5}, large:{w:8,h:6}, full:{w:12,h:5} };
    return map[sz] || map.medium;
  },

  _collectConfig(type, dsId, src, idPrefix='wf', container=document) {
    const q  = id => container.querySelector(`#${idPrefix}-${id}`);
    const g  = id => q(id)?.value;
    const gM = id => Array.from(q(id)?.selectedOptions||[]).map(o=>o.value);
    return {
      dataSourceId: dsId,
      xField:    g('xField'),   yField:   g('yField'),
      y2Field:   g('y2Field'),  sizeField:g('sizeField'),
      valueField:g('valueField'), aggFn:  g('aggFn') || 'sum',
      maxValue:  g('maxValue') ? Number(g('maxValue')) : null,
      columns:   gM('columns'),
    };
  },

  /* Build the field configuration HTML for a chart type.
     `idPrefix` keeps element ids unique (e.g. 'wf' for modal, 'vz' for viz panel). */
  _buildFieldInputs(ct, src, saved, idPrefix) {
    const num = src.columns.filter(c=>src.types[c]==='number');
    const all = src.columns;
    const agg = `<option value="sum">Sum</option><option value="avg">Average</option><option value="count">Count</option><option value="min">Min</option><option value="max">Max</option>`;

    const sel = (id, opts, current) =>
      `<select class="form-input" id="${idPrefix}-${id}">${opts.map(o=>`<option value="${o}" ${o===current?'selected':''}>${o}</option>`).join('')}</select>`;

    let html = '';
    if (ct.fields.includes('xField'))     html += `<div class="form-group"><label>X Axis (Category)</label>${sel('xField', all, saved.xField||all[0])}</div>`;
    if (ct.fields.includes('yField'))     html += `<div class="form-group"><label>Y Axis (Value)</label>${sel('yField', num.length?num:all, saved.yField||(num[0]||all[0]))}</div>`;
    if (ct.fields.includes('y2Field'))    html += `<div class="form-group"><label>Second Y (Line)</label>${sel('y2Field', num.length?num:all, saved.y2Field||(num[1]||num[0]||all[0]))}</div>`;
    if (ct.fields.includes('sizeField'))  html += `<div class="form-group"><label>Bubble Size</label>${sel('sizeField', num.length?num:all, saved.sizeField||(num[0]||all[0]))}</div>`;
    if (ct.fields.includes('valueField')) html += `<div class="form-group"><label>Value Column</label>${sel('valueField', num.length?num:all, saved.valueField||(num[0]||all[0]))}</div>`;
    if (ct.fields.includes('aggFn')) {
      const curAgg = saved.aggFn || 'sum';
      html += `<div class="form-group"><label>Aggregation</label><select class="form-input" id="${idPrefix}-aggFn">${agg.replace(`value="${curAgg}"`,`value="${curAgg}" selected`)}</select></div>`;
    }
    if (ct.fields.includes('maxValue'))   html += `<div class="form-group"><label>Max Value (Gauge)</label><input type="number" class="form-input" id="${idPrefix}-maxValue" placeholder="Auto" value="${saved.maxValue||''}"></div>`;
    if (ct.fields.includes('columns')) {
      const savedCols = saved.columns || [];
      html += `<div class="form-group"><label>Columns to Show</label><select class="form-input" id="${idPrefix}-columns" multiple size="5">${all.map(c=>`<option value="${c}" ${savedCols.includes(c)?'selected':''}>${c}</option>`).join('')}</select><small>Hold Ctrl/Cmd to select multiple</small></div>`;
    }
    return (html || '<div class="sidebar-empty">No configuration needed</div>') + this._cardinalityHint(ct, src, saved, idPrefix);
  },

  /* Warn when the chosen X-axis has a 1:1 relationship with the value column,
     which makes switching the category field produce an identical-looking chart. */
  _cardinalityHint(ct, src, saved, idPrefix) {
    if (!ct.fields.includes('xField') || !ct.fields.includes('yField')) return '';
    const xField = saved.xField || src.columns[0];
    const yField = saved.yField || src.columns.filter(c=>src.types[c]==='number')[0];
    if (!xField || !yField) return '';

    const rows = src.data;
    const xVals = new Set();
    const yPerX = {};
    let xUnique = 0, yUnique = 0;
    rows.forEach(r => {
      const x = String(r[xField] ?? '(blank)');
      const y = String(r[yField] ?? '(blank)');
      if (!xVals.has(x)) { xVals.add(x); xUnique++; }
      if (!yPerX[x]) yPerX[x] = new Set();
      yPerX[x].add(y);
      yUnique++;
    });
    const yDistinct = new Set(rows.map(r => String(r[yField] ?? '(blank)'))).size;

    // 1:1 if every X maps to exactly one Y AND X count ≈ Y distinct count
    const isOneToOne = xUnique > 1 && Object.values(yPerX).every(s => s.size === 1) && xUnique === yDistinct;
    if (!isOneToOne) return '';

    return `<div class="field-hint warn">
      ⚠️ "${xField}" is unique per row (1:1 with "${yField}"). Switching the X-axis to another unique column will show the <strong>same values</strong> — only labels change. Pick a column with repeated values (e.g. a category) to see grouped/aggregated bars.
    </div>`;
  },

  /* Add a widget directly from the Visualizations panel (no review step). */
  _addWidgetDirect(type, dsId) {
    const src = DataManager.getSource(dsId);
    if (!src) { this.toast('Select a data source first.','error'); return; }
    const ct  = CHART_TYPES.find(c=>c.id===type);
    const config = this._collectConfig(type, dsId, src, 'vz');
    const title  = ct?.label || 'Widget';
    const page   = this.getCurrentPage();
    const { w, h } = this._defaultSize();
    const nextY  = page.widgets.length ? Math.max(...page.widgets.map(ww=>ww.y+ww.h)) : 0;
    page.widgets.push({ id:this._uid(), type, title, x:0, y:nextY, w, h, config });
    this.saveState();
    this._renderPage();
    this.toast('Widget added! 🎉','success');
  },

  _updatePreview(type, dsId) {
    const src  = DataManager.getSource(dsId);
    const box  = document.getElementById('chart-preview-box');
    if (!box) return;

    if (!src) { box.innerHTML='<span class="preview-placeholder">Select a data source</span>'; return; }

    const config = this._collectConfig(type, dsId, src);
    const tmpW   = { id:'_prev', type, config };

    // Non-chart types
    if (['kpi','table','gauge'].includes(type)) {
      box.innerHTML='<span class="preview-placeholder">' + (type==='kpi'?'KPI Card':type==='table'?'Data Table':'Gauge') + ' preview not available here.</span>';
      return;
    }

    if (this._previewChart) { try{this._previewChart.destroy();}catch(e){} this._previewChart=null; }
    box.innerHTML = '<canvas id="preview-canvas" style="max-height:220px"></canvas>';
    const cfg = ChartEngine.buildConfig(tmpW, src.data.slice(0,200));
    if (cfg) {
      try { this._previewChart = new Chart(document.getElementById('preview-canvas'), cfg); } catch(e){}
    } else {
      box.innerHTML = '<span class="preview-placeholder">Not enough data to preview</span>';
    }
  },

  /* ─────────────────────────────────────────────
     DELETE WIDGET
  ───────────────────────────────────────────── */
  deleteWidget(id) {
    const page = this.getCurrentPage();
    if (!page) return;
    ChartEngine.destroy(`canvas-${id}`);
    page.widgets = page.widgets.filter(w=>w.id!==id);
    if (this.selectedWidgetId === id) this.selectedWidgetId = null;
    // Compact layout — remove any empty gaps left behind
    this._compactWidgets(page.widgets);
    this.saveState();
    this._renderPage();
    this.toast('Widget deleted.','info');
  },

  /* Gravity-pack: move every widget up to fill empty rows */
  _compactWidgets(widgets) {
    if (!widgets || widgets.length < 2) return;
    // Sort top-to-bottom, left-to-right
    widgets.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    const occupied = {};
    const key      = (c, r) => `${c},${r}`;

    const isFree = (x, y, w, h) => {
      for (let r = y; r < y + h; r++)
        for (let c = x; c < x + w; c++)
          if (occupied[key(c, r)]) return false;
      return true;
    };
    const occupy = (x, y, w, h) => {
      for (let r = y; r < y + h; r++)
        for (let c = x; c < x + w; c++)
          occupied[key(c, r)] = true;
    };

    widgets.forEach(widget => {
      // Try to move the widget as far up as possible
      let bestY = widget.y;
      for (let tryY = 0; tryY < widget.y; tryY++) {
        if (isFree(widget.x, tryY, widget.w, widget.h)) {
          bestY = tryY;
          break;
        }
      }
      widget.y = bestY;
      occupy(widget.x, widget.y, widget.w, widget.h);
    });
  },

  /* ─────────────────────────────────────────────
     DATA SOURCES
  ───────────────────────────────────────────── */
  _setActiveSource(id) {
    this.state.activeSourceId = id;
    this.saveState();
    this._renderSidebar();
  },

  _removeSource(id) {
    DataManager.deleteSource(id);
    if (this.state.activeSourceId === id) {
      const remaining = Object.keys(DataManager.sources);
      this.state.activeSourceId = remaining[0] || null;
    }
    this.saveState();
    this._renderSidebar();
    this.toast('Data source removed.','info');
  },

  /* ─────────────────────────────────────────────
     FILTERS
  ───────────────────────────────────────────── */
  _addFilter(col, op, val) {
    const page = this.getCurrentPage();
    if (!page) return;
    if (!page.filters) page.filters = [];
    page.filters.push({ column:col, operator:op, value:val });
    this.saveState();
    this._renderFilters();
    this._renderPage();
    this.toast('Filter applied.','success');
  },

  _editFilter(idx, col, op, val) {
    const page = this.getCurrentPage();
    if (!page?.filters || idx < 0 || idx >= page.filters.length) return;
    page.filters[idx] = { column:col, operator:op, value:val };
    this.saveState();
    this._renderFilters();
    this._renderPage();
    this.toast('Filter updated.','success');
  },

  _removeFilter(idx) {
    const page = this.getCurrentPage();
    if (!page?.filters) return;
    page.filters.splice(idx, 1);
    this.saveState();
    this._renderFilters();
    this._renderPage();
  },

  openChatModal() {
    const modal = document.getElementById('chat-modal');
    const history = document.getElementById('chat-history');
    const input = document.getElementById('chat-input');
    
    // Load existing chat session
    const pageId = this.state.currentPageId;
    const existingMessages = PersistenceManager.loadChatSession(pageId);
    
    // Clear and rebuild chat history
    history.innerHTML = '';
    
    // Add existing messages
    existingMessages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `chat-message ${msg.role}`;
      div.innerHTML = `<div class="chat-bubble">${msg.content}</div>`;
      history.appendChild(div);
    });
    
    // Scroll to bottom
    history.scrollTop = history.scrollHeight;
    
    // Focus input
    setTimeout(() => input.focus(), 100);
    
    // Show modal
    modal.classList.add('open');
  },

  closeChatModal() {
    document.getElementById('chat-modal')?.classList.remove('open');
  },

  async sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    const history = document.getElementById('chat-history');
    const pageId = this.state.currentPageId;
    
    // Add user message to UI
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message user';
    userDiv.innerHTML = `<div class="chat-bubble">${message}</div>`;
    history.appendChild(userDiv);
    
    // Add to persistence
    const existingMessages = PersistenceManager.loadChatSession(pageId);
    existingMessages.push({ role: 'user', content: message, timestamp: Date.now() });
    PersistenceManager.saveChatSession(pageId, existingMessages);
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    
    // Scroll to bottom
    history.scrollTop = history.scrollHeight;
    
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message bot loading';
    loadingDiv.innerHTML = '<div class="chat-bubble"><span class="typing-indicator">...</span></div>';
    history.appendChild(loadingDiv);
    history.scrollTop = history.scrollHeight;
    
    try {
      // Get current data source
      const src = DataManager.getSource(this.state.activeSourceId);
      if (!src || !src.data.length) {
        throw new Error('No data loaded. Please load a data source first.');
      }
      
      // Generate AI insights based on the question
      const insights = await InsightsEngine.generate(this.state.activeSourceId, 'heuristic');
      
      // Create a simple response based on the question and insights
      let response = this.generateChatResponse(message, insights, src);
      
      // Remove loading indicator
      loadingDiv.remove();
      
      // Add bot response to UI
      const botDiv = document.createElement('div');
      botDiv.className = 'chat-message bot';
      botDiv.innerHTML = `<div class="chat-bubble">${response}</div>`;
      history.appendChild(botDiv);
      
      // Add to persistence
      existingMessages.push({ role: 'bot', content: response, timestamp: Date.now() });
      PersistenceManager.saveChatSession(pageId, existingMessages);
      
      // Scroll to bottom
      history.scrollTop = history.scrollHeight;
      
    } catch (error) {
      // Remove loading indicator
      loadingDiv.remove();
      
      // Add error message
      const errorDiv = document.createElement('div');
      errorDiv.className = 'chat-message bot';
      errorDiv.innerHTML = `<div class="chat-bubble error">Sorry, I encountered an error: ${error.message}</div>`;
      history.appendChild(errorDiv);
      
      // Add to persistence
      existingMessages.push({ role: 'bot', content: `Error: ${error.message}`, timestamp: Date.now() });
      PersistenceManager.saveChatSession(pageId, existingMessages);
      
      // Scroll to bottom
      history.scrollTop = history.scrollHeight;
    }
  },

  generateChatResponse(question, insights, source) {
    const lowerQuestion = question.toLowerCase();
    
    // Simple pattern matching for common questions
    if (lowerQuestion.includes('population') && lowerQuestion.includes('country')) {
      const countries = source.data.filter(row => row.Population > 0).sort((a, b) => b.Population - a.Population);
      const top5 = countries.slice(0, 5);
      return `Here are the top 5 most populous countries:\n\n${top5.map(row => `• ${row.Country}: ${row.Population.toLocaleString()} people`).join('\n')}`;
    }
    
    if (lowerQuestion.includes('average') || lowerQuestion.includes('mean')) {
      const numericCols = source.columns.filter(col => source.types[col] === 'number');
      if (numericCols.length > 0) {
        const col = numericCols[0];
        const values = source.data.map(row => Number(row[col])).filter(v => !isNaN(v));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return `The average value for ${col} is ${avg.toFixed(2)}.`;
      }
    }
    
    if (lowerQuestion.includes('continent') || lowerQuestion.includes('region')) {
      const continents = [...new Set(source.data.map(row => row.Continent))];
      return `Found ${continents.length} continents: ${continents.join(', ')}.`;
    }
    
    if (lowerQuestion.includes('growth') || lowerQuestion.includes('rate')) {
      const growthRates = source.data.map(row => Number(row.GrowthRate_Pct)).filter(v => !isNaN(v));
      const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      return `The average growth rate is ${avgGrowth.toFixed(2)}%.`;
    }
    
    if (lowerQuestion.includes('chart') || lowerQuestion.includes('graph')) {
      return `I can help you create charts! You currently have a ${source.data.length} row dataset with ${source.columns.length} columns. What type of chart would you like to see? I can create bar charts, line charts, pie charts, scatter plots, and more.`;
    }
    
    // Default response based on insights
    if (insights && insights.length > 0) {
      const overview = insights.find(i => i.title.includes('Dataset Overview'));
      if (overview) {
        return `Based on your ${source.name} dataset (${source.data.length} rows, ${source.columns.length} columns), here's what I found:\n\n${overview.text}\n\nWhat specific aspect would you like to explore?`;
      }
    }
    
    return `I analyzed your ${source.name} dataset. It contains ${source.data.length} rows and ${source.columns.length} columns including ${source.columns.join(', ')}. What would you like to know about this data?`;
  },

  openFilterModal(editIdx = null) {
    const src = DataManager.getSource(this.state.activeSourceId);
    if (!src) { this.toast('Select a data source first.','error'); return; }
    const sel = document.getElementById('filter-column-select');
    sel.innerHTML = src.columns.map(c=>`<option>${c}</option>`).join('');
    
    const page = this.getCurrentPage();
    const modal = document.getElementById('filter-modal');
    const titleEl = document.querySelector('#filter-modal h2');
    
    if (editIdx !== null && editIdx >= 0) {
      const filter = page?.filters?.[editIdx];
      if (!filter) return;
      if (titleEl) titleEl.textContent = 'Edit Page Filter';
      document.getElementById('filter-column-select').value = filter.column;
      document.getElementById('filter-operator-select').value = filter.operator;
      document.getElementById('filter-value-input').value = filter.value;
      document.getElementById('confirm-filter-btn').textContent = 'Save Changes';
      modal.dataset.editIndex = editIdx;
    } else {
      if (titleEl) titleEl.textContent = 'Add Page Filter';
      document.getElementById('filter-column-select').value = src.columns[0] || '';
      document.getElementById('filter-operator-select').value = '=';
      document.getElementById('filter-value-input').value = '';
      document.getElementById('confirm-filter-btn').textContent = 'Apply Filter';
      modal.dataset.editIndex = '';
    }
    this.openModal('filter-modal');
  },

  /* ─────────────────────────────────────────────
     THEME
  ───────────────────────────────────────────── */
  _toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this._applyTheme();
    this.saveState();
    const page = this.getCurrentPage();
    if (page) setTimeout(() => ChartEngine.rerenderAll(page.widgets, page.filters||[]), 150);
  },
  _applyTheme() { document.documentElement.setAttribute('data-theme', this.state.theme); },

  /* ─────────────────────────────────────────────
     MODAL HELPERS
  ───────────────────────────────────────────── */
  closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
    if (id === 'widget-modal' && this._previewChart) {
      try{this._previewChart.destroy();}catch(e){} this._previewChart = null;
    }
  },
  openModal(id) { document.getElementById(id)?.classList.add('open'); },

  /* ─────────────────────────────────────────────
     DATA TABLE VIEW (Excel-like)
  ───────────────────────────────────────────── */
  openDataModal(srcId) {
    const src = DataManager.getSource(srcId);
    if (!src) { this.toast('Source not found.','error'); return; }
    document.getElementById('data-modal-title').textContent = src.name;
    document.getElementById('data-modal-meta').textContent =
      `${src.rowCount.toLocaleString()} rows · ${src.columns.length} columns`;

    const cols = src.columns;
    const head = '<tr>' + cols.map(c=>`<th title="${c}">${c}<span class="col-type">${src.types[c]==='number'?'123':src.types[c]==='date'?'DATE':'ABC'}</span></th>`).join('') + '</tr>';
    const body = src.data.map((row, i) =>
      '<tr>' + `<td class="row-num">${i+1}</td>` + cols.map(c=>{
        const v = row[c];
        const cls = src.types[c]==='number' ? 'cell-num' : '';
        const txt = (v===null||v===undefined||v==='') ? '' : String(v);
        return `<td class="${cls}" title="${txt.replace(/"/g,'&quot;')}">${txt}</td>`;
      }).join('') + '</tr>'
    ).join('');

    document.getElementById('data-table-head').innerHTML = head;
    document.getElementById('data-table-body').innerHTML = body;
    this.openModal('data-modal');
  },

  /* ─────────────────────────────────────────────
     CONTEXT MENU
  ───────────────────────────────────────────── */
  showContextMenu(x, y, widgetId) {
    this.selectedWidgetId = widgetId;
    const menu = document.getElementById('context-menu');
    menu.classList.add('visible');
    menu.style.left = `${Math.min(x, window.innerWidth-185)}px`;
    menu.style.top  = `${Math.min(y, window.innerHeight-130)}px`;
  },
  hideContextMenu() { document.getElementById('context-menu')?.classList.remove('visible'); },

  /* ─────────────────────────────────────────────
     TOAST
  ───────────────────────────────────────────── */
  toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
      t.style.cssText = 'opacity:0;transform:translateX(16px);transition:0.28s ease';
      setTimeout(() => t.remove(), 300);
    }, 3200);
  },

  /* ─────────────────────────────────────────────
     HTML ESCAPE
  ───────────────────────────────────────────── */
  _esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

  /* ─────────────────────────────────────────────
     BIND ALL EVENTS
  ───────────────────────────────────────────── */
  _bindAll() {
    /* Page tabs */
    document.getElementById('page-tabs').addEventListener('click', e => {
      const close = e.target.closest('[data-close-page]');
      if (close) { e.stopPropagation(); this._deletePage(close.dataset.closePage); return; }
      const tab = e.target.closest('.page-tab');
      if (tab) this._switchPage(tab.dataset.pageId);
    });
    document.getElementById('page-tabs').addEventListener('dblclick', e => {
      const tab = e.target.closest('.page-tab');
      if (!tab) return;
      const id   = tab.dataset.pageId;
      const page = this.state.pages.find(p=>p.id===id);
      const name = prompt('Rename page:', page?.name||'Page');
      if (name) this._renamePage(id, name);
    });
    document.getElementById('add-page-btn').addEventListener('click', () => this._addPage());

    /* Header buttons */
    document.getElementById('add-datasource-btn').addEventListener('click', () => this.openModal('datasource-modal'));
    document.getElementById('sidebar-add-ds-btn').addEventListener('click', () => this.openModal('datasource-modal'));
    document.getElementById('add-widget-btn').addEventListener('click', () => {
      if (!Object.keys(DataManager.sources).length) { this.toast('Add a data source first.','error'); return; }
      this.openWidgetModal();
    });
    document.getElementById('insights-btn').addEventListener('click', () => this._openInsights());
    document.getElementById('chat-btn').addEventListener('click', () => this.openChatModal());
    document.getElementById('share-btn').addEventListener('click', () => this.openShareModal());
    document.getElementById('export-btn').addEventListener('click', () => this.openModal('export-modal'));
    document.getElementById('theme-btn').addEventListener('click', () => this._toggleTheme());
    document.getElementById('save-dashboard-btn').addEventListener('click', () => this._saveDashboard());
    document.getElementById('load-dashboard-btn').addEventListener('click', () => this.openModal('load-dashboard-modal'));
    document.getElementById('settings-btn').addEventListener('click', () => this._openSettings());

    /* Chat modal events */
    document.getElementById('chat-modal').addEventListener('click', e => {
      if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal-overlay')) {
        this.closeChatModal();
      }
    });
    document.getElementById('chat-send-btn').addEventListener('click', () => this.sendChatMessage());
    document.getElementById('chat-input').addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
    document.getElementById('chat-input').addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    /* Empty state */
    document.getElementById('empty-upload-btn').addEventListener('click', () => this.openModal('datasource-modal'));
    document.getElementById('empty-sample-btn').addEventListener('click', () => {
      this.openModal('datasource-modal');
      setTimeout(() => document.querySelector('[data-tab="sample"]')?.click(), 50);
    });

    /* Datasource list clicks */
    document.getElementById('datasource-list').addEventListener('click', e => {
      const del = e.target.closest('[data-del-src]');
      if (del) { this._removeSource(del.dataset.delSrc); return; }
      const viewBtn = e.target.closest('[data-view-src]');
      if (viewBtn) { this.openDataModal(viewBtn.dataset.viewSrc); return; }
      const item = e.target.closest('[data-sid]');
      if (item) this._setActiveSource(item.dataset.sid);
    });

    /* Filter list */
    document.getElementById('filter-list').addEventListener('click', e => {
      const delBtn = e.target.closest('[data-del-filter]');
      if (delBtn) this._removeFilter(Number(delBtn.dataset.delFilter));
      const editBtn = e.target.closest('[data-edit-filter]');
      if (editBtn) this.openFilterModal(Number(editBtn.dataset.editFilter));
    });
    document.getElementById('add-filter-btn').addEventListener('click', () => {
      this.openFilterModal(null);
    });
    document.getElementById('confirm-filter-btn').addEventListener('click', () => {
      const col = document.getElementById('filter-column-select').value;
      const op  = document.getElementById('filter-operator-select').value;
      const val = document.getElementById('filter-value-input').value.trim();
      if (!col || !val) { this.toast('Fill all filter fields.','error'); return; }
      const editIdx = document.getElementById('filter-modal').dataset.editIndex;
      if (editIdx !== undefined && editIdx !== '') {
        this._editFilter(Number(editIdx), col, op, val);
      } else {
        this._addFilter(col, op, val);
      }
      this.closeModal('filter-modal');
    });

    /* Load dashboard modal */
    document.getElementById('load-dashboard-input').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = PersistenceManager.importDashboard(evt.target.result);
            document.getElementById('load-dashboard-status').innerHTML = 
              `✅ <strong>${file.name}</strong> ready to import`;
            document.getElementById('confirm-load-dashboard-btn').disabled = false;
            document.getElementById('load-dashboard-modal').dataset.pendingData = JSON.stringify(data);
          } catch(err) {
            document.getElementById('load-dashboard-status').innerHTML = 
              `❌ Error: ${err.message}`;
            document.getElementById('confirm-load-dashboard-btn').disabled = true;
          }
        };
        reader.onerror = () => {
          document.getElementById('load-dashboard-status').innerHTML = '❌ Failed to read file';
          document.getElementById('confirm-load-dashboard-btn').disabled = true;
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('confirm-load-dashboard-btn').addEventListener('click', () => {
      const modal = document.getElementById('load-dashboard-modal');
      const dataStr = modal.dataset.pendingData;
      if (!dataStr) { this.toast('No file selected.','error'); return; }
      try {
        const data = JSON.parse(dataStr);
        this._loadDashboard(data.state, data.sources);
        this.closeModal('load-dashboard-modal');
        document.getElementById('load-dashboard-input').value = '';
        document.getElementById('load-dashboard-status').innerHTML = '';
        document.getElementById('confirm-load-dashboard-btn').disabled = true;
      } catch(err) {
        this.toast('Failed to load dashboard.','error');
        console.error('Load failed:', err);
      }
    });

    /* Modal close buttons */
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) this.closeModal(ov.id); });
    });

    /* Data source modal — tab switching */
    document.querySelectorAll('.src-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.src-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.src-tab-content').forEach(c=>c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
      });
    });

    /* File upload */
    this._bindFileUpload();

    /* REST API */
    this._bindAPISource();

    /* Sample data */
    document.querySelectorAll('[data-sample]').forEach(btn => {
      if (!btn.dataset.sample) return;
      btn.addEventListener('click', () => {
        const ds = DataManager.getSampleData(btn.dataset.sample);
        if (!ds) return;
        const id  = this._uid();
        const src = DataManager.addSource(id, ds.name, ds.rows);
        this.state.activeSourceId = id;
        this.saveState();
        this.closeModal('datasource-modal');
        this._renderSidebar();
        this.toast(`"${src.name}" loaded — ${src.rowCount} rows ✅`,'success');
      });
    });

    /* Export */
    document.getElementById('export-pdf-btn').addEventListener('click', () => { ExportManager.pdf(); this.closeModal('export-modal'); });
    document.getElementById('export-png-btn').addEventListener('click', () => { ExportManager.image(); this.closeModal('export-modal'); });
    document.getElementById('export-csv-btn').addEventListener('click', () => { ExportManager.csv(this.state.activeSourceId); this.closeModal('export-modal'); });

    /* Share */
    document.getElementById('generate-share-link-btn').addEventListener('click', () => this.generateShareLink());
    document.getElementById('copy-share-link-btn').addEventListener('click', () => {
      const input = document.getElementById('share-link-input');
      if (!input || !input.value) { this.toast('Generate a link first.','error'); return; }
      input.select();
      navigator.clipboard?.writeText(input.value).then(
        () => this.toast('Link copied to clipboard.','success'),
        () => { document.execCommand('copy'); this.toast('Link copied.','success'); }
      );
    });

    /* Settings */
    document.getElementById('ai-provider-select').addEventListener('change', e => {
      document.getElementById('ai-key-group').style.display = e.target.value==='heuristic'?'none':'block';
    });
    document.getElementById('save-settings-btn').addEventListener('click', () => {
      this.state.settings.aiProvider         = document.getElementById('ai-provider-select').value;
      this.state.settings.aiApiKey           = document.getElementById('ai-api-key-input').value;
      this.state.settings.defaultWidgetSize  = document.getElementById('default-widget-size').value;
      this.saveState();
      this.closeModal('settings-modal');
      this.toast('Settings saved.','success');
    });

    /* Context menu */
    document.getElementById('ctx-edit').addEventListener('click', () => { this.openWidgetModal(this.selectedWidgetId); this.hideContextMenu(); });
    document.getElementById('ctx-delete').addEventListener('click', () => { this.deleteWidget(this.selectedWidgetId); this.hideContextMenu(); });
    document.getElementById('ctx-duplicate').addEventListener('click', () => {
      const page = this.getCurrentPage();
      const orig = page?.widgets.find(w=>w.id===this.selectedWidgetId);
      if (orig) {
        const dup = JSON.parse(JSON.stringify(orig));
        dup.id = this._uid(); dup.title += ' (Copy)'; dup.y += dup.h;
        page.widgets.push(dup);
        this.saveState(); this._renderPage();
        this.toast('Widget duplicated.','success');
      }
      this.hideContextMenu();
    });

    document.addEventListener('click', () => this.hideContextMenu());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m=>this.closeModal(m.id));
        this.hideContextMenu();
      }
      if (e.key === 'Delete' && this.selectedWidgetId && !e.target.closest('input,select,textarea')) {
        this.deleteWidget(this.selectedWidgetId);
      }
    });

    /* Fields section collapse/expand */
    const fieldsHeader = document.getElementById('fields-header');
    fieldsHeader?.addEventListener('click', () => fieldsHeader.classList.toggle('collapsed'));

    /* Visualizations panel */
    const vizDs = document.getElementById('viz-ds-select');
    vizDs?.addEventListener('change', () => {
      if (vizDs.value) this.state.activeSourceId = vizDs.value;
      this._refreshVizBodies();
    });
    const vizList = document.getElementById('viz-list');
    vizList?.addEventListener('click', e => {
      const addBtn = e.target.closest('[data-add-viz]');
      if (addBtn) {
        const dsId = document.getElementById('viz-ds-select')?.value;
        if (!dsId) { this.toast('Select a data source first.','error'); return; }
        this._addWidgetDirect(addBtn.dataset.addViz, dsId);
        return;
      }
      const head = e.target.closest('.viz-card-head');
      if (head) {
        const card = head.parentElement;
        card.classList.toggle('open');
        // Scroll the expanded card into view so all fields (incl. Aggregation) are reachable
        if (card.classList.contains('open')) {
          setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
      }
    });
    // Re-render a card body when its X/Y field changes so the hint stays in sync
    vizList?.addEventListener('change', e => {
      const card = e.target.closest('.viz-card');
      if (!card) return;
      const ctId = card.dataset.viz;
      const ct   = CHART_TYPES.find(c=>c.id===ctId);
      const dsId = document.getElementById('viz-ds-select')?.value;
      const src  = DataManager.getSource(dsId);
      const body = document.getElementById(`viz-body-${ctId}`);
      if (ct && src && body) {
        const saved = this._collectConfig(ctId, dsId, src, 'vz', body);
        body.innerHTML = this._buildFieldInputs(ct, src, saved, 'vz');
      }
    });
  },

  /* ─────────────────────────────────────────────
     FILE UPLOAD
  ───────────────────────────────────────────── */
  _bindFileUpload() {
    const zone = document.getElementById('drop-zone');
    const inp  = document.getElementById('file-input');

    const handle = async file => {
      try {
        const text = await file.text();
        let data;
        if (/\.json$/i.test(file.name)) data = DataManager.parseJSON(text);
        else data = await DataManager.parseCSV(text);
        if (!data.length) throw new Error('File is empty or has no rows.');
        this._pendingFile = { name: file.name.replace(/\.[^.]+$/, ''), data };
        this._showFilePreview(data, file.name);
      } catch(e) { this.toast(`Parse error: ${e.message}`,'error'); }
    };

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    inp.addEventListener('change', () => { if (inp.files[0]) handle(inp.files[0]); });

    document.getElementById('cancel-upload-btn').addEventListener('click', () => {
      document.getElementById('file-preview').style.display = 'none';
      document.getElementById('drop-zone').style.display = 'flex';
      this._pendingFile = null;
    });

    document.getElementById('confirm-upload-btn').addEventListener('click', () => {
      if (!this._pendingFile) return;
      const id  = this._uid();
      const src = DataManager.addSource(id, this._pendingFile.name, this._pendingFile.data);
      this.state.activeSourceId = id;
      this._pendingFile = null;
      document.getElementById('file-preview').style.display = 'none';
      document.getElementById('drop-zone').style.display = 'flex';
      this.saveState();
      this.closeModal('datasource-modal');
      this._renderSidebar();
      this.toast(`"${src.name}" imported — ${src.rowCount} rows ✅`,'success');
    });
  },

  _showFilePreview(data, filename) {
    const cols = Object.keys(data[0] || {});
    document.getElementById('preview-info').innerHTML =
      `<strong>${filename}</strong> — ${data.length.toLocaleString()} rows · ${cols.length} columns`;
    const rows = data.slice(0,5);
    document.getElementById('preview-table').innerHTML =
      `<thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`
      +`<tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${r[c]??''}</td>`).join('')}</tr>`).join('')}</tbody>`;
    document.getElementById('drop-zone').style.display   = 'none';
    document.getElementById('file-preview').style.display = 'block';
  },

  /* ─────────────────────────────────────────────
     API SOURCE
  ───────────────────────────────────────────── */
  _bindAPISource() {
    let testData = null;

    document.getElementById('test-api-btn').addEventListener('click', async () => {
      const url  = document.getElementById('api-url').value.trim();
      const path = document.getElementById('api-path').value.trim();
      const auth = document.getElementById('api-auth').value.trim();
      if (!url) { this.toast('Enter an API URL.','error'); return; }
      const btn = document.getElementById('test-api-btn');
      btn.textContent = 'Testing…'; btn.disabled = true;
      try {
        const headers = auth ? { Authorization: auth } : {};
        const res     = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const json = await res.json();
        const data = DataManager.parseJSON(JSON.stringify(json), path);
        testData = data;
        const cols = Object.keys(data[0] || {});
        document.getElementById('api-preview-info').innerHTML =
          `✅ Connected · <strong>${data.length.toLocaleString()}</strong> records · ${cols.length} columns`;
        const rows = data.slice(0,4);
        document.getElementById('api-preview-table').innerHTML =
          `<thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>`
          +`<tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${r[c]??''}</td>`).join('')}</tr>`).join('')}</tbody>`;
        document.getElementById('api-preview-section').style.display = 'block';
        document.getElementById('confirm-api-btn').disabled = false;
        this.toast('API connected!','success');
      } catch(e) { this.toast(`API Error: ${e.message}`,'error'); testData=null; }
      finally { btn.textContent='Test Connection'; btn.disabled=false; }
    });

    document.getElementById('confirm-api-btn').addEventListener('click', () => {
      if (!testData) return;
      const url  = document.getElementById('api-url').value;
      const name = decodeURIComponent(url.split('/').filter(Boolean).pop() || 'API Data');
      const id   = this._uid();
      const src  = DataManager.addSource(id, name, testData);
      this.state.activeSourceId = id;
      testData = null;
      document.getElementById('api-preview-section').style.display='none';
      document.getElementById('confirm-api-btn').disabled=true;
      this.saveState(); this.closeModal('datasource-modal'); this._renderSidebar();
      this.toast(`"${src.name}" imported — ${src.rowCount} rows ✅`,'success');
    });
  },

  /* ─────────────────────────────────────────────
     AI INSIGHTS MODAL
  ───────────────────────────────────────────── */
  _openInsights() {
    if (!Object.keys(DataManager.sources).length) { this.toast('Load a data source first.','error'); return; }
    this.openModal('insights-modal');
    const loading = document.getElementById('insights-loading');
    const results = document.getElementById('insights-results');
    loading.style.display = 'flex'; results.style.display = 'none';
    const srcId = this.state.activeSourceId || Object.keys(DataManager.sources)[0];
    InsightsEngine.generate(srcId, this.state.settings.aiProvider, this.state.settings.aiApiKey)
      .then(r => {
        loading.style.display = 'none';
        results.style.display = 'flex';
        InsightsEngine.render(results, r);
      })
      .catch(e => {
        loading.style.display = 'none';
        results.style.display = 'flex';
        results.innerHTML = `<div class="insight-card"><div class="insight-title">Error</div><div class="insight-text">${e.message}</div></div>`;
      });
  },

  /* ─────────────────────────────────────────────
     SETTINGS MODAL
  ───────────────────────────────────────────── */
  _openSettings() {
    document.getElementById('ai-provider-select').value = this.state.settings.aiProvider || 'heuristic';
    document.getElementById('ai-api-key-input').value   = this.state.settings.aiApiKey   || '';
    document.getElementById('default-widget-size').value = this.state.settings.defaultWidgetSize || 'medium';
    document.getElementById('ai-key-group').style.display = this.state.settings.aiProvider==='heuristic'?'none':'block';
    this.openModal('settings-modal');
  },
};

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => App.init());
