// Filter Edit Patch - Adds openFilterModal method to App
// This patch enables filter editing functionality

(function() {
  if (!window.App || App.openFilterModal) return; // Already patched

  App.openFilterModal = function(editIdx = null) {
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
  };

  // Add CSS for filter editing UI
  const style = document.createElement('style');
  style.textContent = `
    .filter-chip-actions { display: flex; gap: 4px; align-items: center; }
    .filter-chip-edit { 
      color: var(--text-3); 
      transition: color var(--transition); 
      padding: 1px 3px; 
      border-radius: 3px; 
      cursor: pointer; 
      background: none; 
      border: none; 
      font-size: 0.85em; 
    }
    .filter-chip-edit:hover { 
      color: var(--accent); 
      background: var(--accent-muted); 
    }
  `;
  document.head.appendChild(style);
  
  console.log('✅ Filter Edit Patch loaded');
})();
