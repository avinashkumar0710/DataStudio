/* ==============================================
   DataStudio — Export (export.js)
   ============================================== */
'use strict';

const ExportManager = {

  /* PDF via browser print dialog */
  pdf() {
    window.print();
  },

  /* Open in new tab for screenshot */
  image() {
    const area = document.getElementById('canvas-area');
    if (!area) return;
    const win = window.open('', '_blank');
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>DataStudio Export</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { margin:0; font-family:Inter,sans-serif; background:${isDark?'#0c0e1a':'#f2f4fc'}; color:${isDark?'#edf2f7':'#1a1d3a'}; }
        .canvas-grid { display:grid; grid-template-columns:repeat(12,1fr); grid-auto-rows:58px; gap:14px; padding:18px; min-height:100vh; }
        .widget { background:${isDark?'#1c2038':'#fff'}; border:1px solid ${isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)'}; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; }
        .widget-header { padding:9px 13px; border-bottom:1px solid ${isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)'}; font-size:0.82rem; font-weight:600; }
        .widget-body { flex:1; padding:12px; overflow:hidden; display:flex; flex-direction:column; }
        .widget-actions, .resize-handle { display:none; }
        canvas { max-width:100%; }
      </style>
    </head><body>${area.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 800);
  },

  /* CSV download of active data source */
  csv(sourceId) {
    const src = DataManager.getSource(sourceId);
    if (!src) { App.toast('No active data source to export.', 'error'); return; }
    const csv  = Papa.unparse(src.data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (src.name.replace(/\s+/g, '_') || 'export') + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    App.toast(`"${src.name}" downloaded as CSV.`, 'success');
  },
};
