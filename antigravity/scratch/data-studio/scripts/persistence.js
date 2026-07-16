/* ==============================================
   DataStudio — Persistence Manager (persistence.js)
   ============================================== */
'use strict';

const PersistenceManager = {
  /* ── Chat Session Storage ── */
  chatSessionKey: 'ds_chat_sessions',

  /**
   * Save a chat session for the current page
   */
  saveChatSession(pageId, messages) {
    try {
      const sessions = JSON.parse(localStorage.getItem(this.chatSessionKey) || '{}');
      sessions[pageId] = {
        timestamp: Date.now(),
        messages: messages
      };
      localStorage.setItem(this.chatSessionKey, JSON.stringify(sessions));
    } catch(e) {
      console.warn('Chat session save failed:', e);
    }
  },

  /**
   * Load chat session for the current page
   */
  loadChatSession(pageId) {
    try {
      const sessions = JSON.parse(localStorage.getItem(this.chatSessionKey) || '{}');
      return sessions[pageId]?.messages || [];
    } catch(e) {
      console.warn('Chat session load failed:', e);
      return [];
    }
  },

  /**
   * Delete chat session for a page
   */
  deleteChatSession(pageId) {
    try {
      const sessions = JSON.parse(localStorage.getItem(this.chatSessionKey) || '{}');
      delete sessions[pageId];
      localStorage.setItem(this.chatSessionKey, JSON.stringify(sessions));
    } catch(e) {
      console.warn('Chat session delete failed:', e);
    }
  },

  /**
   * Export dashboard as JSON file
   */
  exportDashboard(state, dataManager) {
    try {
      const payload = {
        version: '1.0',
        exported: new Date().toISOString(),
        state: {
          pages: state.pages,
          currentPageId: state.currentPageId,
          activeSourceId: state.activeSourceId,
          theme: state.theme,
          settings: state.settings
        },
        sources: dataManager.serialise()
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return true;
    } catch(e) {
      console.error('Export failed:', e);
      return false;
    }
  },

  /**
   * Import dashboard from JSON
   */
  importDashboard(jsonText) {
    try {
      const payload = JSON.parse(jsonText);
      
      // Validate structure
      if (!payload.state || !payload.sources) {
        throw new Error('Invalid dashboard format');
      }

      return {
        state: payload.state,
        sources: payload.sources
      };
    } catch(e) {
      console.error('Import parse failed:', e);
      throw new Error('Failed to import dashboard: ' + e.message);
    }
  },

  /**
   * Get all chat sessions metadata
   */
  getAllChatSessions() {
    try {
      return JSON.parse(localStorage.getItem(this.chatSessionKey) || '{}');
    } catch(e) {
      console.warn('Get chat sessions failed:', e);
      return {};
    }
  },

  /**
   * Clear all chat sessions
   */
  clearAllChatSessions() {
    try {
      localStorage.removeItem(this.chatSessionKey);
    } catch(e) {
      console.warn('Clear chat sessions failed:', e);
    }
  },

  /**
   * Encode the full dashboard state into a URL-safe base64 string.
   * Optionally compresses with the built-in CompressionStream (gzip) when available.
   * Returns an object: { data, compressed }
   */
  async encodeShare(state, dataManager, compress = true) {
    const payload = {
      v: 1,
      state: {
        pages: state.pages,
        currentPageId: state.currentPageId,
        activeSourceId: state.activeSourceId,
        theme: state.theme,
        settings: state.settings
      },
      sources: dataManager.serialise(),
      chat: this.getAllChatSessions()
    };
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);

    if (compress && 'CompressionStream' in window) {
      try {
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const buf = await this._streamToBytes(cs.readable);
        const b64 = this._bytesToBase64(new Uint8Array(buf));
        return { data: 'g' + b64, compressed: true };
      } catch(e) {
        console.warn('Compression failed, falling back to raw:', e);
      }
    }
    return { data: 'r' + this._bytesToBase64(bytes), compressed: false };
  },

  /**
   * Read a ReadableStream fully into a Uint8Array without using Response
   * (Response.arrayBuffer can fail in some embedded browser contexts).
   */
  async _streamToBytes(readable) {
    const reader = readable.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  },

  /**
   * Decode a share string (from a URL hash) back into a dashboard payload.
   */
  async decodeShare(encoded) {
    if (!encoded) throw new Error('No share data found in link.');
    const tag = encoded[0];
    const b64 = encoded.slice(1);
    let bytes = this._base64ToBytes(b64);

    if (tag === 'g') {
      if (!('DecompressionStream' in window)) {
        throw new Error('This browser cannot decompress the shared link.');
      }
      try {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const buf = await this._streamToBytes(ds.readable);
        bytes = new Uint8Array(buf);
      } catch(e) {
        throw new Error('Failed to decompress shared link: ' + e.message);
      }
    } else if (tag !== 'r') {
      throw new Error('Unrecognised share link format.');
    }

    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json);
    if (!payload.state || !payload.sources) {
      throw new Error('Invalid share link.');
    }
    return payload;
  },

  _bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  _base64ToBytes(b64) {
    // Reverse URL-safe alphabet and any percent-encoding from the URL hash
    const norm = decodeURIComponent(b64).replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
    const bin = atob(norm + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
};
