/* Chat export/import: Excel .xlsx saved locally and optionally offered to Public Chat peers. */
(() => {
  'use strict';

  const DB_NAME = 'chat-app2-local';
  const STORE = 'messages';
  const ROOM = 'public';
  const EXPORT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const EXPORT_NAME = 'Chat-App-2-Chat-Export.xlsx';
  const MAX_SHARE_BYTES = 4 * 1024 * 1024;
  let pendingOffer = null;

  const $ = id => document.getElementById(id);

  function username() {
    return localStorage.getItem('chat_username') || localStorage.getItem('chat_name') || 'Someone';
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open local chat storage.'));
    });
  }

  async function readLocalMessages() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => {
        const list = (req.result || [])
          .filter(m => m && (m.room === ROOM || m.channel === ROOM))
          .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error || new Error('Could not read local chat.'));
    });
  }

  function rowsFromMessages(messages) {
    return messages.map(m => ({
      Time: m.created_at || '',
      Username: m.username || '',
      Message: m.message || '',
      'Device ID': m.device_id || '',
      Edited: m.edited ? 'Yes' : 'No',
      'Game Message': m.game_message ? 'Yes' : 'No'
    }));
  }

  function base64FromBytes(bytes) {
    let out = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(out);
  }

  function bytesFromBase64(base64) {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  function getBase64FromFile(file) {
    if (!file) return '';
    if (file.data && file.base64) return String(file.data).replace(/^data:[^,]+,/, '');
    if (typeof file.data === 'string' && file.data.startsWith('data:')) return file.data.split(',')[1] || '';
    return '';
  }

  function downloadBytes(bytes, name, type) {
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function exportChat() {
    if (!window.XLSX) {
      alert('Excel support is still loading. Please try again in a moment.');
      return;
    }
    try {
      const messages = await readLocalMessages();
      if (!messages.length) {
        alert('There are no Public Chat messages saved on this device yet.');
        return;
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rowsFromMessages(messages));
      ws['!cols'] = [
        { wch: 24 }, { wch: 22 }, { wch: 70 }, { wch: 38 }, { wch: 10 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Chat');
      const info = XLSX.utils.aoa_to_sheet([
        ['Chat App 2 Export'],
        ['Channel', '# public'],
        ['Messages', messages.length],
        ['Exported by', username()],
        ['Exported at', new Date().toISOString()],
        ['Note', 'This file is a chat export. Loading it imports the message history into the local Public Chat on the receiving device.']
      ]);
      XLSX.utils.book_append_sheet(wb, info, 'Info');

      const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const bytes = new Uint8Array(arrayBuffer);
      downloadBytes(bytes, EXPORT_NAME, EXPORT_TYPE);

      const shareBase64 = base64FromBytes(bytes);
      const shareFile = {
        name: EXPORT_NAME,
        data: shareBase64,
        size: bytes.byteLength,
        type: EXPORT_TYPE,
        base64: true,
        chatExport: true,
        messageCount: messages.length
      };

      if (bytes.byteLength > MAX_SHARE_BYTES) {
        alert(`Chat saved as Excel. It is ${Math.round(bytes.byteLength / 1024)} KB, so it is too large to offer to other P2P users.`);
        return;
      }

      const body = {
        id: 'chat-export-offer-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()),
        username: username(),
        channel: ROOM,
        message: `📊 ${username()} shared a chat Excel file. Other people can choose whether to load it into their Public Chat.`,
        files: [shareFile],
        device_id: localStorage.getItem('chat_device_id') || '',
        created_at: new Date().toISOString(),
        invisible_to_others: true,
        game_message: false
      };

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`P2P share failed (${response.status}).`);

      alert(`Chat saved as ${EXPORT_NAME} and offered to the connected Public Chat users.`);
    } catch (error) {
      console.error(error);
      alert('Could not save/share the chat: ' + (error.message || error));
    }
  }

  function makeOfferDialog() {
    if ($('chatImportOffer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'chatImportOffer';
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2>📊 Load Chat Excel?</h2>
          <button class="icon-btn" id="chatImportClose">×</button>
        </div>
        <div class="panel-body">
          <p id="chatImportText" style="color:#9da5b0;line-height:1.6"></p>
          <div class="game-actions">
            <button class="game-btn" id="chatImportNo">No</button>
            <button class="game-btn" id="chatImportYes">Load into Public Chat</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    $('chatImportClose').onclick = closeOffer;
    $('chatImportNo').onclick = closeOffer;
    $('chatImportYes').onclick = acceptOffer;
  }

  function closeOffer() {
    pendingOffer = null;
    $('chatImportOffer')?.classList.remove('show');
  }

  function showOffer(file, message) {
    makeOfferDialog();
    pendingOffer = { file, message };
    const sender = message?.username || 'Someone';
    $('chatImportText').textContent = `${sender} wants to share ${file.name || 'an Excel chat file'} with you. Do you want to load its chat history into your local Public Chat?`;
    $('chatImportOffer').classList.add('show');
  }

  function normalizeImportedMessage(row, index) {
    const text = String(row.Message ?? '');
    if (!text && !row.Username) return null;
    const created = row.Time && !Number.isNaN(Date.parse(row.Time)) ? new Date(row.Time).toISOString() : new Date().toISOString();
    return {
      id: 'import-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + index),
      username: String(row.Username || 'Imported User').slice(0, 24),
      channel: ROOM,
      room: ROOM,
      message: text.slice(0, 20000),
      image: null,
      files: [],
      device_id: String(row['Device ID'] || 'imported').slice(0, 100),
      edited: String(row.Edited || '').toLowerCase() === 'yes',
      created_at: created,
      invisible_to_others: false,
      game_message: String(row['Game Message'] || '').toLowerCase() === 'yes',
      p2p: true,
      imported_from_excel: true
    };
  }

  async function writeImportedMessages(messages) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const message of messages) store.put(message);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not import chat locally.'));
      tx.onabort = () => reject(tx.error || new Error('Chat import was aborted.'));
    });
  }

  async function acceptOffer() {
    const offer = pendingOffer;
    closeOffer();
    if (!offer?.file || !window.XLSX) return;
    try {
      const base64 = getBase64FromFile(offer.file);
      if (!base64) throw new Error('The shared Excel file data is missing.');
      const bytes = bytesFromBase64(base64);
      const wb = XLSX.read(bytes, { type: 'array' });
      const sheetName = wb.SheetNames.includes('Chat') ? 'Chat' : wb.SheetNames[0];
      if (!sheetName) throw new Error('The Excel file has no sheets.');
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      const imported = rows.map(normalizeImportedMessage).filter(Boolean);
      if (!imported.length) throw new Error('No chat messages were found in the Excel file.');
      await writeImportedMessages(imported);

      for (const message of imported) {
        window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: message }));
      }
      alert(`Loaded ${imported.length} chat messages into your local Public Chat.`);
    } catch (error) {
      console.error(error);
      alert('Could not load the Excel chat: ' + (error.message || error));
    }
  }

  function findExportFile(message) {
    const files = Array.isArray(message?.files) ? message.files : [];
    return files.find(f => f && (f.chatExport === true || f.type === EXPORT_TYPE || String(f.name || '').toLowerCase().endsWith('.xlsx')));
  }

  function installButton() {
    if ($('saveChatBtn')) return true;
    const actions = document.querySelector('.header-actions');
    if (!actions) return false;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'saveChatBtn';
    btn.title = 'Save Chat as Excel';
    btn.setAttribute('aria-label', 'Save Chat as Excel');
    btn.textContent = '📊';
    btn.onclick = exportChat;
    actions.insertBefore(btn, actions.firstChild);
    return true;
  }

  function init() {
    if (!installButton()) setTimeout(init, 150);
    window.addEventListener('chat:p2p-message', event => {
      const message = event.detail;
      const file = findExportFile(message);
      if (file && message?.device_id !== localStorage.getItem('chat_device_id')) showOffer(file, message);
    });
  }

  init();
})();
