/* ==============================================
   DataStudio — AI Insights Engine (insights.js)
   ============================================== */
'use strict';

const InsightsEngine = {

  /* ── Entry point ── */
  async generate(sourceId, provider = 'heuristic', apiKey = '') {
    const src = DataManager.getSource(sourceId);
    if (!src || !src.data.length) throw new Error('No data available. Load a data source first.');

    const builtin = this._builtinAnalysis(src);

    if (provider === 'heuristic' || !apiKey.trim()) {
      return builtin;
    }

    try {
      const prompt  = this._buildPrompt(src, builtin);
      let aiText = '';
      if (provider === 'gemini') aiText = await this._callGemini(apiKey, prompt);
      if (provider === 'openai') aiText = await this._callOpenAI(apiKey, prompt);
      return { ...builtin, aiSummary: aiText };
    } catch (e) {
      console.warn('AI call failed:', e.message);
      return { ...builtin, aiError: e.message };
    }
  },

  /* ── Built-in statistical analysis ── */
  _builtinAnalysis(src) {
    const { data, columns, types, name } = src;
    const numCols = columns.filter(c => types[c] === 'number');
    const strCols = columns.filter(c => types[c] === 'string');
    const insights    = [];
    const columnStats = {};

    // Compute stats for all numeric columns
    numCols.forEach(col => {
      const vals = data.map(r => r[col]).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
      const s = DataManager.stats(vals);
      if (s) columnStats[col] = s;
    });

    /* 1. Overview */
    insights.push({
      cls: '',
      title: '📋 Dataset Overview',
      text: `"${name}" contains ${data.length.toLocaleString()} rows × ${columns.length} columns. `
          + `Found ${numCols.length} numeric and ${strCols.length} categorical column(s).`
          + (numCols.length === 0 ? ' ⚠️ No numeric columns detected — most chart types need at least one.' : ''),
    });

    /* 2. Stats per numeric column (top 3) */
    numCols.slice(0, 3).forEach(col => {
      const s = columnStats[col];
      if (!s) return;
      const cv = s.mean ? Math.abs(s.stdDev / s.mean) : 0;
      const highVar = cv > 0.5;
      insights.push({
        cls: highVar ? 'c-warning' : 'c-success',
        title: `📊 "${col}" — Distribution`,
        text: `Min: ${this._fmt(s.min)} · Max: ${this._fmt(s.max)} · Mean: ${this._fmt(s.mean)} · Median: ${this._fmt(s.median)} · Std Dev: ${this._fmt(s.stdDev)}.\n`
            + (highVar
              ? `⚠️ High variability (CV ${(cv*100).toFixed(0)}%) — values are widely spread. Check for outliers.`
              : `✅ Relatively uniform distribution (CV ${(cv*100).toFixed(0)}%). Data is consistent.`),
      });
    });

    /* 3. Outlier detection (top 2 numeric cols) */
    numCols.slice(0, 2).forEach(col => {
      const s = columnStats[col];
      if (!s || s.stdDev === 0) return;
      const lo = s.mean - 2.5 * s.stdDev;
      const hi = s.mean + 2.5 * s.stdDev;
      const outliers = data.filter(r => {
        const v = Number(r[col]);
        return !isNaN(v) && (v < lo || v > hi);
      });
      if (outliers.length > 0) {
        insights.push({
          cls: 'c-warning',
          title: `⚠️ Outliers in "${col}"`,
          text: `${outliers.length} row(s) fall outside 2.5σ from the mean [${this._fmt(lo)} – ${this._fmt(hi)}].\n`
              + `Investigate these records — they may indicate data entry errors or genuine anomalies.`,
        });
      }
    });

    /* 4. Top categorical values */
    strCols.slice(0, 2).forEach(col => {
      const freq = {};
      data.forEach(r => { const v = String(r[col] ?? ''); freq[v] = (freq[v] || 0) + 1; });
      const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]);
      if (sorted.length) {
        const top3 = sorted.slice(0, 3).map(([k,v]) => `"${k}" (${v})`).join(', ');
        insights.push({
          cls: '',
          title: `🏷️ Top Values in "${col}"`,
          text: `${sorted.length} unique value(s). Most frequent: ${top3}.`
              + (sorted.length === 1 ? '\n⚠️ This column has only one unique value — it may not be useful for grouping.' : ''),
        });
      }
    });

    /* 5. Correlation between first two numeric cols */
    if (numCols.length >= 2) {
      const c1 = numCols[0], c2 = numCols[1];
      const x  = data.map(r => Number(r[c1]) || 0);
      const y  = data.map(r => Number(r[c2]) || 0);
      const r  = this._pearson(x, y);
      if (!isNaN(r)) {
        const str  = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : 'weak';
        const dir  = r >= 0 ? 'positive' : 'negative';
        insights.push({
          cls: Math.abs(r) > 0.5 ? 'c-success' : '',
          title: `🔗 Correlation: "${c1}" vs "${c2}"`,
          text: `Pearson r = ${r.toFixed(3)} → ${str} ${dir} correlation.\n`
              + (Math.abs(r) > 0.7
                ? 'These variables tend to move strongly together. Consider using a scatter chart.'
                : Math.abs(r) < 0.3
                  ? 'These variables appear largely independent.'
                  : 'Some relationship exists — worth exploring with a scatter plot.'),
        });
      }
    }

    /* 6. Trend detection (first numeric col, assuming sequential rows) */
    if (numCols.length >= 1) {
      const col  = numCols[0];
      const vals = data.map(r => Number(r[col])).filter(v => !isNaN(v));
      if (vals.length > 5) {
        const n   = vals.length;
        const xi  = vals.map((_,i) => i);
        const r   = this._pearson(xi, vals);
        if (!isNaN(r) && Math.abs(r) > 0.3) {
          const trend = r > 0 ? 'upward 📈' : 'downward 📉';
          insights.push({
            cls: r > 0 ? 'c-success' : 'c-warning',
            title: `📉 Trend in "${col}"`,
            text: `Detected a ${trend} trend across the dataset (r = ${r.toFixed(2)}).\n`
                + `First value: ${this._fmt(vals[0])}, Last value: ${this._fmt(vals[n-1])}, `
                + `Change: ${r > 0 ? '+' : ''}${this._fmt(vals[n-1]-vals[0])}.`,
          });
        }
      }
    }

    /* 7. Data quality */
    const total   = data.length * columns.length;
    let missing   = 0;
    data.forEach(row => columns.forEach(col => { if (row[col] === null || row[col] === undefined || row[col] === '') missing++; }));
    const comp = total ? (1 - missing / total) * 100 : 100;
    insights.push({
      cls: comp >= 95 ? 'c-success' : comp >= 80 ? 'c-warning' : '',
      title: '🧹 Data Quality',
      text: `Completeness: ${comp.toFixed(1)}% (${missing.toLocaleString()} missing cell(s) out of ${total.toLocaleString()}).\n`
          + (comp >= 95 ? '✅ Excellent data quality.' : comp >= 80 ? '⚠️ Some missing values — check your data pipeline.' : '❗ Significant missing data — cleaning is recommended.'),
    });

    return { insights, columnStats };
  },

  /* ── Prompt for AI providers ── */
  _buildPrompt(src, builtin) {
    const statsText = Object.entries(builtin.columnStats || {})
      .map(([col, s]) => `  ${col}: mean=${s.mean}, min=${s.min}, max=${s.max}, stddev=${s.stdDev}`)
      .join('\n');
    const sampleRows = src.data.slice(0, 8);
    return `You are an expert data analyst. Analyze the following dataset and provide concise, actionable business insights.

Dataset: "${src.name}"
Dimensions: ${src.data.length} rows × ${src.columns.length} columns (${src.columns.join(', ')})

Sample rows (first 8):
${JSON.stringify(sampleRows, null, 2)}

Statistical summary of numeric columns:
${statsText || '  (none)'}

Instructions:
1. Identify the single most important insight or trend in the data.
2. Give one concrete, data-backed business recommendation.
3. Flag one risk or anomaly that deserves attention.

Format your response as 3 numbered points. Be specific, cite numbers, keep each point to 2 sentences maximum.`;
  },

  /* ── Gemini API call ── */
  async _callGemini(apiKey, prompt) {
    const url  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const res  = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '(No response)';
  },

  /* ── OpenAI API call ── */
  async _callOpenAI(apiKey, prompt) {
    const res  = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model:'gpt-4o-mini', messages:[{ role:'user', content:prompt }], max_tokens:500 }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.choices?.[0]?.message?.content || '(No response)';
  },

  /* ── Render results into modal ── */
  render(container, result) {
    const { insights = [], columnStats = {}, aiSummary, aiError } = result;
    let html = '';

    if (aiSummary) {
      html += `
        <div class="insight-card c-ai">
          <div class="insight-title">🤖 AI-Powered Analysis</div>
          <div class="insight-text">${this._escHtml(aiSummary)}</div>
        </div>`;
    }
    if (aiError) {
      html += `
        <div class="insight-card c-warning">
          <div class="insight-title">⚠️ AI Unavailable</div>
          <div class="insight-text">Could not reach AI provider: ${this._escHtml(aiError)}\nShowing built-in analytics below.</div>
        </div>`;
    }

    insights.forEach(ins => {
      html += `
        <div class="insight-card ${ins.cls}">
          <div class="insight-title">${ins.title}</div>
          <div class="insight-text">${this._escHtml(ins.text)}</div>
        </div>`;
    });

    // Column stats grid
    if (Object.keys(columnStats).length) {
      html += `
        <div class="insight-card">
          <div class="insight-title">📐 Column Statistics</div>
          <div class="stats-grid">
            ${Object.entries(columnStats).map(([col, s]) => `
              <div class="stat-item">
                <div class="stat-name">${col}</div>
                <div class="stat-val">${this._fmtNum(s.mean)}</div>
                <div class="stat-sub">avg · ${this._fmtNum(s.min)}–${this._fmtNum(s.max)}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    container.innerHTML = html;
  },

  /* ── Helpers ── */
  _pearson(x, y) {
    const n = x.length;
    if (n !== y.length || n < 2) return NaN;
    const mx = x.reduce((a,b)=>a+b,0)/n;
    const my = y.reduce((a,b)=>a+b,0)/n;
    const num = x.reduce((a,b,i) => a+(b-mx)*(y[i]-my), 0);
    const den = Math.sqrt(x.reduce((a,b)=>a+(b-mx)**2,0) * y.reduce((a,b)=>a+(b-my)**2,0));
    return den ? num/den : 0;
  },
  _fmt(v) { return this._fmtNum(v); },
  _fmtNum(v) {
    if (typeof v !== 'number' || isNaN(v)) return String(v);
    const a = Math.abs(v);
    if (a >= 1e9) return (v/1e9).toFixed(2)+'B';
    if (a >= 1e6) return (v/1e6).toFixed(2)+'M';
    if (a >= 1e3) return (v/1e3).toFixed(1)+'K';
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  },
  _escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\n/g,'<br>');
  },
};
