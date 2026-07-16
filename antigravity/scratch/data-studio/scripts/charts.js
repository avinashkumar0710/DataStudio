/* ==============================================
   DataStudio — Chart Engine (charts.js)
   ============================================== */
'use strict';

/* ── Chart type definitions ── */
const CHART_TYPES = [
  { id:'bar',    label:'Bar Chart',    icon:'📊', fields:['xField','yField','aggFn'] },
  { id:'hbar',   label:'H. Bar',       icon:'📉', fields:['xField','yField','aggFn'] },
  { id:'line',   label:'Line Chart',   icon:'📈', fields:['xField','yField','aggFn'] },
  { id:'area',   label:'Area Chart',   icon:'🏔️', fields:['xField','yField','aggFn'] },
  { id:'pie',    label:'Pie Chart',    icon:'🥧', fields:['xField','yField','aggFn'] },
  { id:'donut',  label:'Donut',        icon:'🍩', fields:['xField','yField','aggFn'] },
  { id:'scatter',label:'Scatter',      icon:'🔵', fields:['xField','yField'] },
  { id:'bubble', label:'Bubble',       icon:'⭕', fields:['xField','yField','sizeField'] },
  { id:'mixed',  label:'Bar + Line',   icon:'🎛️', fields:['xField','yField','y2Field','aggFn'] },
  { id:'kpi',    label:'KPI Card',     icon:'🎯', fields:['valueField','aggFn'] },
  { id:'table',  label:'Data Table',   icon:'📋', fields:['columns'] },
  { id:'gauge',  label:'Gauge',        icon:'🕐', fields:['valueField','aggFn','maxValue'] },
];

/* ── Colour palette ── */
const PALETTE = [
  'rgba(108,99,255,0.85)',  'rgba(0,212,170,0.85)',   'rgba(255,169,77,0.85)',
  'rgba(255,77,109,0.85)',  'rgba(99,179,237,0.85)',  'rgba(255,206,84,0.85)',
  'rgba(165,94,234,0.85)',  'rgba(0,198,255,0.85)',   'rgba(255,128,63,0.85)',
  'rgba(50,214,120,0.85)',  'rgba(255,82,160,0.85)',  'rgba(52,211,153,0.85)',
];
const PALETTE_SOLID = PALETTE.map(c => c.replace('0.85','1'));

const ChartEngine = {
  instances: {}, // canvasId → Chart

  /* ── Helpers ── */
  _isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; },
  _scaleDefaults() {
    const dark  = this._isDark();
    const grid  = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tick  = dark ? '#6a7390' : '#8a93b2';
    const font  = { family:'Inter', size:10.5 };
    return {
      grid: { color: grid, drawBorder: false },
      ticks: { color: tick, font },
    };
  },

  /* ── Build Chart.js config ── */
  buildConfig(widget, data) {
    const { type, config } = widget;
    const aggFn = config.aggFn || 'sum';
    const sd    = this._scaleDefaults();
    const dark  = this._isDark();
    const legendColor = dark ? '#a0aec0' : '#4a5270';
    const legendFont  = { family:'Inter', size:11 };

    /* --- Grouped bar / horizontal bar --- */
    if (type === 'bar' || type === 'hbar') {
      const grouped = DataManager.groupBy(data, config.xField, config.yField, aggFn);
      if (!grouped.length) return null;
      return {
        type: 'bar',
        data: {
          labels: grouped.map(d => d.label),
          datasets: [{
            label: config.yField,
            data: grouped.map(d => d.value),
            backgroundColor: grouped.map((_, i) => PALETTE[i % PALETTE.length]),
            borderColor:     grouped.map((_, i) => PALETTE_SOLID[i % PALETTE_SOLID.length]),
            borderWidth: 1, borderRadius: 5, borderSkipped: false,
          }],
        },
        options: {
          indexAxis: type === 'hbar' ? 'y' : 'x',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: sd, y: sd },
        },
      };
    }

    /* --- Line / Area --- */
    if (type === 'line' || type === 'area') {
      const grouped = DataManager.groupBy(data, config.xField, config.yField, aggFn);
      if (!grouped.length) return null;
      const fill  = type === 'area';
      const color = PALETTE[0];
      return {
        type: 'line',
        data: {
          labels: grouped.map(d => d.label),
          datasets: [{
            label: config.yField,
            data: grouped.map(d => d.value),
            borderColor: PALETTE_SOLID[0],
            backgroundColor: fill ? color.replace('0.85','0.18') : 'transparent',
            fill, tension: 0.38,
            pointRadius: 4, pointBackgroundColor: PALETTE_SOLID[0],
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: sd, y: sd },
        },
      };
    }

    /* --- Pie / Donut --- */
    if (type === 'pie' || type === 'donut') {
      const grouped = DataManager.groupBy(data, config.xField, config.yField, aggFn);
      if (!grouped.length) return null;
      const borderColor = dark ? '#171b2e' : '#fff';
      return {
        type: 'doughnut',
        data: {
          labels: grouped.map(d => d.label),
          datasets: [{
            data: grouped.map(d => d.value),
            backgroundColor: grouped.map((_, i) => PALETTE[i % PALETTE.length]),
            borderColor, borderWidth: 2,
            hoverOffset: 8,
          }],
        },
        options: {
          cutout: type === 'donut' ? '58%' : '0%',
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: legendColor, font: legendFont, padding: 14, usePointStyle: true, pointStyleWidth: 8 },
            },
          },
        },
      };
    }

    /* --- Scatter --- */
    if (type === 'scatter') {
      const pts = data.slice(0, 600).map(row => ({
        x: Number(row[config.xField]) || 0,
        y: Number(row[config.yField]) || 0,
      }));
      return {
        type: 'scatter',
        data: { datasets: [{ label: `${config.xField} vs ${config.yField}`, data: pts, backgroundColor: PALETTE[0], pointRadius: 4, pointHoverRadius: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...sd, title: { display: true, text: config.xField, color: sd.ticks.color, font: sd.ticks.font } },
            y: { ...sd, title: { display: true, text: config.yField, color: sd.ticks.color, font: sd.ticks.font } },
          },
        },
      };
    }

    /* --- Bubble --- */
    if (type === 'bubble') {
      const szField = config.sizeField || config.yField;
      const szVals  = data.map(r => Number(r[szField]) || 0);
      const maxSz   = Math.max(...szVals) || 1;
      const pts = data.slice(0, 150).map(row => ({
        x: Number(row[config.xField]) || 0,
        y: Number(row[config.yField]) || 0,
        r: Math.max(3, Math.min(22, ((Number(row[szField]) || 0) / maxSz) * 22)),
      }));
      return {
        type: 'bubble',
        data: { datasets: [{ label: config.yField, data: pts, backgroundColor: PALETTE[0], borderColor: PALETTE_SOLID[0] }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: sd, y: sd },
        },
      };
    }

    /* --- Mixed Bar + Line --- */
    if (type === 'mixed') {
      const g1 = DataManager.groupBy(data, config.xField, config.yField, aggFn);
      const g2 = DataManager.groupBy(data, config.xField, config.y2Field || config.yField, aggFn);
      if (!g1.length) return null;
      return {
        type: 'bar',
        data: {
          labels: g1.map(d => d.label),
          datasets: [
            { type:'bar',  label: config.yField,  data: g1.map(d=>d.value), backgroundColor: PALETTE[0], borderRadius: 5 },
            { type:'line', label: config.y2Field || config.yField, data: g2.map(d=>d.value), borderColor: PALETTE_SOLID[1], backgroundColor:'transparent', tension:0.38, borderWidth:2, pointRadius:4, yAxisID:'y2' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: legendColor, font: legendFont, usePointStyle: true } } },
          scales: {
            x: sd,
            y:  sd,
            y2: { ...sd, position:'right', grid:{ display:false } },
          },
        },
      };
    }

    return null;
  },

  /* ── Render to a canvas ── */
  render(canvasId, widget, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.instances[canvasId]) {
      try { this.instances[canvasId].destroy(); } catch(e) {}
      delete this.instances[canvasId];
    }

    const cfg = this.buildConfig(widget, data);
    if (!cfg) { canvas.parentElement.innerHTML = '<div class="widget-no-data"><span>📭</span>Not enough data to render</div>'; return; }

    try {
      this.instances[canvasId] = new Chart(canvas, cfg);
    } catch(e) {
      console.warn('Chart render error:', e);
    }
  },

  /* ── Destroy ── */
  destroy(canvasId) {
    if (this.instances[canvasId]) {
      try { this.instances[canvasId].destroy(); } catch(e) {}
      delete this.instances[canvasId];
    }
  },

  /* ── Update colours on theme change ── */
  rerenderAll(widgets, filters) {
    widgets.forEach(w => {
      const id  = `canvas-${w.id}`;
      const src = DataManager.getSource(w.config.dataSourceId);
      if (!src) return;
      const filtered = DataManager.applyFilters(src.data, filters);
      this.render(id, w, filtered);
    });
  },
};
