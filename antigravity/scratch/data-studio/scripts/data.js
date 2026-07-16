/* ==============================================
   DataStudio — Data Layer (data.js)
   ============================================== */
'use strict';

const DataManager = {
  sources: {},

  /* ── Sample datasets ── */
  getSampleData(type) {
    const datasets = {
      sales: {
        name: 'Sales Dashboard',
        rows: (() => {
          const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const regions = ['North','South','East','West'];
          const products = ['Laptop','Phone','Tablet','Monitor','Keyboard'];
          const out = [];
          months.forEach((month, mi) => {
            regions.forEach(region => {
              products.forEach(product => {
                const base = { Laptop:800,Phone:500,Tablet:400,Monitor:350,Keyboard:150 }[product];
                const seasonal = 1 + 0.2 * Math.sin((mi / 12) * Math.PI * 2);
                const revenue = Math.round(base * seasonal * (Math.random() * 0.4 + 0.8) * 100);
                const units   = Math.round(Math.random() * 200 + 20);
                out.push({
                  Month: month, MonthNum: mi + 1, Region: region, Product: product,
                  Revenue: revenue, Units: units,
                  Profit: Math.round(revenue * (Math.random() * 0.2 + 0.15)),
                  Satisfaction: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
                  ReturnRate: parseFloat((Math.random() * 5).toFixed(1)),
                });
              });
            });
          });
          return out;
        })(),
      },
      population: {
        name: 'World Population',
        rows: [
          { Country:'China',       Continent:'Asia',           Population:1412600000, GrowthRate_Pct:0.39, GDP_Trillion:18.10, LifeExpectancy:78.2, HDI:0.768 },
          { Country:'India',       Continent:'Asia',           Population:1380004000, GrowthRate_Pct:1.00, GDP_Trillion:3.53,  LifeExpectancy:70.9, HDI:0.645 },
          { Country:'USA',         Continent:'North America',  Population:331002651,  GrowthRate_Pct:0.58, GDP_Trillion:23.32, LifeExpectancy:78.9, HDI:0.926 },
          { Country:'Indonesia',   Continent:'Asia',           Population:273523615,  GrowthRate_Pct:1.07, GDP_Trillion:1.19,  LifeExpectancy:71.9, HDI:0.705 },
          { Country:'Pakistan',    Continent:'Asia',           Population:220892340,  GrowthRate_Pct:2.00, GDP_Trillion:0.35,  LifeExpectancy:67.3, HDI:0.544 },
          { Country:'Brazil',      Continent:'South America',  Population:212559417,  GrowthRate_Pct:0.71, GDP_Trillion:1.61,  LifeExpectancy:76.0, HDI:0.765 },
          { Country:'Nigeria',     Continent:'Africa',         Population:206139589,  GrowthRate_Pct:2.58, GDP_Trillion:0.44,  LifeExpectancy:54.7, HDI:0.539 },
          { Country:'Bangladesh',  Continent:'Asia',           Population:164689383,  GrowthRate_Pct:1.01, GDP_Trillion:0.42,  LifeExpectancy:73.0, HDI:0.661 },
          { Country:'Russia',      Continent:'Europe',         Population:145934462,  GrowthRate_Pct:0.04, GDP_Trillion:1.78,  LifeExpectancy:72.7, HDI:0.822 },
          { Country:'Mexico',      Continent:'North America',  Population:128932753,  GrowthRate_Pct:1.06, GDP_Trillion:1.29,  LifeExpectancy:75.0, HDI:0.779 },
          { Country:'Ethiopia',    Continent:'Africa',         Population:114963588,  GrowthRate_Pct:2.57, GDP_Trillion:0.11,  LifeExpectancy:66.6, HDI:0.498 },
          { Country:'Japan',       Continent:'Asia',           Population:126476461,  GrowthRate_Pct:-0.30, GDP_Trillion:4.94, LifeExpectancy:84.3, HDI:0.925 },
          { Country:'Philippines', Continent:'Asia',           Population:109581078,  GrowthRate_Pct:1.35, GDP_Trillion:0.38,  LifeExpectancy:71.7, HDI:0.718 },
          { Country:'Egypt',       Continent:'Africa',         Population:102334404,  GrowthRate_Pct:1.94, GDP_Trillion:0.42,  LifeExpectancy:72.0, HDI:0.731 },
          { Country:'DR Congo',    Continent:'Africa',         Population:89561403,   GrowthRate_Pct:3.19, GDP_Trillion:0.05,  LifeExpectancy:60.4, HDI:0.479 },
          { Country:'Germany',     Continent:'Europe',         Population:83783942,   GrowthRate_Pct:0.32, GDP_Trillion:4.26,  LifeExpectancy:81.4, HDI:0.947 },
          { Country:'UK',          Continent:'Europe',         Population:67886011,   GrowthRate_Pct:0.53, GDP_Trillion:3.11,  LifeExpectancy:81.4, HDI:0.929 },
          { Country:'France',      Continent:'Europe',         Population:65273511,   GrowthRate_Pct:0.21, GDP_Trillion:2.94,  LifeExpectancy:82.7, HDI:0.901 },
          { Country:'South Africa',Continent:'Africa',         Population:59308690,   GrowthRate_Pct:1.28, GDP_Trillion:0.42,  LifeExpectancy:64.1, HDI:0.713 },
          { Country:'Argentina',   Continent:'South America',  Population:45195777,   GrowthRate_Pct:0.89, GDP_Trillion:0.49,  LifeExpectancy:76.9, HDI:0.842 },
        ],
      },
      stocks: {
        name: 'Tech Stock Prices',
        rows: (() => {
          const tickers = [
            { t:'AAPL', name:'Apple',     base:185 },
            { t:'GOOGL', name:'Google',   base:142 },
            { t:'MSFT', name:'Microsoft', base:385 },
            { t:'META', name:'Meta',      base:495 },
            { t:'AMZN', name:'Amazon',    base:192 },
            { t:'NVDA', name:'Nvidia',    base:880 },
            { t:'TSLA', name:'Tesla',     base:205 },
          ];
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const out = [];
          tickers.forEach(tk => {
            let price = tk.base;
            months.forEach((month, mi) => {
              price = parseFloat((price * (0.92 + Math.random() * 0.16)).toFixed(2));
              out.push({
                Month: month, MonthNum: mi + 1,
                Ticker: tk.t, Company: tk.name,
                Price: price,
                Open: parseFloat((price * (0.98 + Math.random() * 0.04)).toFixed(2)),
                Volume: Math.round(Math.random() * 60e6 + 10e6),
                MarketCap_B: parseFloat((price * (Math.random() * 3 + 14)).toFixed(1)),
                Change_Pct: parseFloat((Math.random() * 8 - 4).toFixed(2)),
                PERatio: parseFloat((Math.random() * 20 + 15).toFixed(1)),
              });
            });
          });
          return out;
        })(),
      },
    };
    return datasets[type] || null;
  },

  /* ── Type inference ── */
  inferTypes(data) {
    if (!data || !data.length) return {};
    const sample = data.slice(0, Math.min(50, data.length));
    const types = {};
    Object.keys(sample[0]).forEach(col => {
      const vals = sample.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
      const numCount  = vals.filter(v => !isNaN(Number(v)) && String(v).trim() !== '').length;
      const dateCount = vals.filter(v => /^\d{4}[-/]/.test(String(v)) || (!isNaN(Date.parse(v)) && isNaN(Number(v)))).length;
      if (numCount / vals.length > 0.8)  types[col] = 'number';
      else if (dateCount / vals.length > 0.7) types[col] = 'date';
      else types[col] = 'string';
    });
    return types;
  },

  coerceData(data, types) {
    return data.map(row => {
      const out = {};
      Object.keys(row).forEach(col => {
        if (types[col] === 'number') {
          const n = Number(row[col]);
          out[col] = isNaN(n) ? row[col] : n;
        } else {
          out[col] = row[col];
        }
      });
      return out;
    });
  },

  /* ── Parsers ── */
  async parseCSV(text) {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true, skipEmptyLines: true, dynamicTyping: true,
        complete: res => {
          if (!res.data.length && res.errors.length) reject(new Error('CSV parse failed: ' + res.errors[0].message));
          else resolve(res.data);
        },
        error: e => reject(new Error(e.message)),
      });
    });
  },

  parseJSON(text, path = '') {
    let obj = JSON.parse(text);
    if (path) {
      path.split('.').forEach(k => { if (obj && obj[k] !== undefined) obj = obj[k]; });
    }
    if (Array.isArray(obj)) return obj;
    // Try to find first array value in object
    if (typeof obj === 'object' && obj !== null) {
      for (const k of Object.keys(obj)) {
        if (Array.isArray(obj[k])) return obj[k];
      }
    }
    throw new Error('No array found in JSON response. Try specifying a data path.');
  },

  /* ── Source management ── */
  addSource(id, name, rawData) {
    const types   = this.inferTypes(rawData);
    const data    = this.coerceData(rawData, types);
    const columns = Object.keys(data[0] || {});
    const source  = { id, name, data, types, columns, rowCount: data.length };
    this.sources[id] = source;
    return source;
  },
  getSource(id) { return this.sources[id] || null; },
  deleteSource(id) { delete this.sources[id]; },

  /* ── Filters ── */
  applyFilters(data, filters = []) {
    if (!filters.length) return data;
    return data.filter(row => filters.every(f => {
      const val  = row[f.column];
      const fVal = f.value;
      const numVal  = Number(val);
      const numFVal = Number(fVal);
      switch (f.operator) {
        case 'equals':     return String(val).toLowerCase() === String(fVal).toLowerCase();
        case 'not_equals': return String(val).toLowerCase() !== String(fVal).toLowerCase();
        case 'contains':   return String(val).toLowerCase().includes(String(fVal).toLowerCase());
        case 'gt':  return numVal > numFVal;
        case 'lt':  return numVal < numFVal;
        case 'gte': return numVal >= numFVal;
        case 'lte': return numVal <= numFVal;
        default:    return true;
      }
    }));
  },

  /* ── Aggregation ── */
  groupBy(data, groupCol, valueCol, aggFn = 'sum') {
    const groups = {};
    data.forEach(row => {
      const key = String(row[groupCol] ?? '(blank)');
      if (!groups[key]) groups[key] = [];
      const n = Number(row[valueCol]);
      if (!isNaN(n)) groups[key].push(n);
    });
    return Object.entries(groups).map(([label, vals]) => {
      let value;
      if (!vals.length) { value = 0; }
      else switch (aggFn) {
        case 'sum':   value = vals.reduce((a,b)=>a+b, 0); break;
        case 'avg':   value = vals.reduce((a,b)=>a+b, 0) / vals.length; break;
        case 'count': value = vals.length; break;
        case 'min':   value = Math.min(...vals); break;
        case 'max':   value = Math.max(...vals); break;
        default:      value = vals.reduce((a,b)=>a+b, 0);
      }
      return { label, value: parseFloat(value.toFixed(4)) };
    });
  },

  /* ── Statistics ── */
  stats(values) {
    const nums = values.filter(v => v !== null && v !== undefined && !isNaN(Number(v))).map(Number).sort((a,b)=>a-b);
    if (!nums.length) return null;
    const n = nums.length;
    const sum = nums.reduce((a,b)=>a+b, 0);
    const mean = sum / n;
    const mid = Math.floor(n / 2);
    const median = n % 2 ? nums[mid] : (nums[mid-1] + nums[mid]) / 2;
    const variance = nums.reduce((a,b) => a + (b-mean)**2, 0) / n;
    return {
      count: n, sum: parseFloat(sum.toFixed(4)),
      mean: parseFloat(mean.toFixed(4)), median: parseFloat(median.toFixed(4)),
      min: nums[0], max: nums[n-1],
      stdDev: parseFloat(Math.sqrt(variance).toFixed(4)),
    };
  },

  /* ── Serialise/restore (strips circular refs) ── */
  serialise() {
    const out = {};
    Object.entries(this.sources).forEach(([id, src]) => {
      out[id] = { id: src.id, name: src.name, types: src.types, columns: src.columns, rowCount: src.rowCount, data: src.data };
    });
    return out;
  },
  restore(saved) {
    Object.values(saved).forEach(src => { this.sources[src.id] = src; });
  },
};
