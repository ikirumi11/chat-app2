const SPREADSHEET_ID = "1wfmmVqHL5kkhq7AWUAaIBKvBBb0BHyOXR_DThDQIwMo";
const SHEET_NAME = "Messages";
const PEER_SHEET_NAME = "P2P";
const SIGNAL_SHEET_NAME = "Signals";
const PREFIX = "__CHAT_GAME_STATE__:";
const HEADERS = ["id","username","channel","message","image","files","device_id","edited","created_at"];
const PEER_HEADERS = ["device_id","last_seen"];
const SIGNAL_HEADERS = ["id","from","to","type","data","created_at"];

function sheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  return sh;
}

function peerSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(PEER_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(PEER_SHEET_NAME);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,PEER_HEADERS.length).setValues([PEER_HEADERS]);
  return sh;
}

function signalSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SIGNAL_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SIGNAL_SHEET_NAME);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,SIGNAL_HEADERS.length).setValues([SIGNAL_HEADERS]);
  return sh;
}

function setup() {
  const sh = sheet_();
  const peers = peerSheet_();
  const signals = signalSheet_();
  sh.setFrozenRows(1);
  peers.setFrozenRows(1);
  signals.setFrozenRows(1);
  sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  peers.getRange(1,1,1,PEER_HEADERS.length).setValues([PEER_HEADERS]);
  signals.getRange(1,1,1,SIGNAL_HEADERS.length).setValues([SIGNAL_HEADERS]);
  return json_({success:true});
}

function doGet(e) {
  try {
    const p = e && e.parameter || {};
    if (String(p.p2p || "") === "peers") return output_(getPeers_(), p.callback);
    if (String(p.p2p || "") === "signals") {
      return output_(getSignals_(String(p.device_id || ""), String(p.since || "")), p.callback);
    }

    const channel = String(p.channel || "general").slice(0,32);
    const since = String(p.since || "");
    return output_(readMessages_(channel, since), p.callback);
  } catch (err) {
    return output_({success:false,error:String(err && err.message || err)}, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const body = parseBody_(e);
    const method = String(body._method || body.method || "POST").toUpperCase();

    if (method === "P2P_HEARTBEAT") return json_(heartbeat_(body));
    if (method === "P2P_SIGNAL") return json_(signal_(body));
    if (method === "POST") return json_(post_(body));
    if (method === "PATCH") return json_(patch_(body));
    if (method === "DELETE") return json_(del_(body));

    throw new Error("Unsupported method.");
  } catch (err) {
    return json_({success:false,error:String(err && err.message || err)});
  } finally {
    lock.releaseLock();
  }
}

function heartbeat_(body) {
  const deviceId = String(body.device_id || "").slice(0,120);
  if (!deviceId) throw new Error("Device ID is required.");

  const sh = peerSheet_();
  const last = sh.getLastRow();
  const now = new Date().toISOString();

  if (last >= 2) {
    const values = sh.getRange(2,1,last-1,2).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === deviceId) {
        sh.getRange(i+2,2).setValue(now);
        return {success:true};
      }
    }
  }

  sh.appendRow([deviceId,now]);
  return {success:true};
}

function getPeers_() {
  const sh = peerSheet_();
  const last = sh.getLastRow();
  if (last < 2) return {success:true,peers:[]};

  const cutoff = Date.now() - 20000;
  const values = sh.getRange(2,1,last-1,2).getValues();
  const peers = [];

  for (let i = 0; i < values.length; i++) {
    const deviceId = String(values[i][0] || "");
    const lastSeen = new Date(values[i][1]).getTime();
    if (deviceId && !isNaN(lastSeen) && lastSeen >= cutoff) {
      peers.push({device_id:deviceId,last_seen:new Date(lastSeen).toISOString()});
    }
  }

  return {success:true,peers};
}

function signal_(body) {
  const from = String(body.from || "").slice(0,120);
  const to = String(body.to || "").slice(0,120);
  const type = String(body.type || "").slice(0,32);
  const data = typeof body.data === "string" ? body.data.slice(0,45000) : JSON.stringify(body.data || {});

  if (!from || !to || !type) throw new Error("Invalid P2P signal.");

  const sh = signalSheet_();
  const row = [
    Utilities.getUuid(),
    from,
    to,
    type,
    data,
    new Date().toISOString()
  ];

  sh.appendRow(row);
  trimSignals_(sh);
  return {success:true,id:row[0]};
}

function getSignals_(deviceId,since) {
  if (!deviceId) return {success:true,signals:[]};

  const sh = signalSheet_();
  const last = sh.getLastRow();
  if (last < 2) return {success:true,signals:[]};

  const values = sh.getRange(Math.max(2,last-499),1,Math.min(500,last-1),SIGNAL_HEADERS.length).getValues();
  const sinceTime = since ? new Date(since).getTime() : 0;
  const signals = [];

  for (let i = 0; i < values.length; i++) {
    const created = String(values[i][5] || "");
    const createdTime = new Date(created).getTime();
    const to = String(values[i][2] || "");

    if (
      (to === deviceId || to === "*") &&
      !isNaN(createdTime) &&
      createdTime > sinceTime
    ) {
      signals.push({
        id:String(values[i][0] || ""),
        from:String(values[i][1] || ""),
        to,
        type:String(values[i][3] || ""),
        data:String(values[i][4] || ""),
        created_at:created
      });
    }
  }

  return {success:true,signals};
}

function trimSignals_(sh) {
  const maxRows = 1001;
  const last = sh.getLastRow();
  if (last > maxRows) sh.deleteRows(2,last-maxRows);
}

function post_(body) {
  const sh = sheet_();

  if (body.delete_all === true) {
    clearMessages_(sh);
    return {success:true};
  }

  if (body.game_server === true) {
    const action = String(body.game_action || "");
    const channel = String(body.channel || "general").slice(0,32);
    const deviceId = String(body.device_id || "").slice(0,100);
    if (!deviceId) throw new Error("Device ID is required.");

    if (action === "stop") {
      return {success:true,removed:removeGame_(sh,channel,String(body.game_id || ""))};
    }

    if (action === "leave") {
      return leaveGame_(sh,channel,String(body.game_id || ""),deviceId);
    }

    const message = String(body.message || "").slice(0,20000);
    if (!message) throw new Error("Game state is required.");

    const row = makeRow_({
      id:body.id,
      username:"__GAME_SERVER__",
      channel,
      message,
      image:null,
      files:[],
      device_id:deviceId,
      edited:false
    });

    sh.appendRow(row);
    return {success:true,game:rowObject_(row)};
  }

  const username = String(body.username || "").trim().slice(0,24);
  const channel = String(body.channel || "general").trim().slice(0,32);
  const message = String(body.message || "").trim().slice(0,20000);
  const deviceId = String(body.device_id || "").trim().slice(0,100);
  const image = typeof body.image === "string" ? body.image : null;
  const files = Array.isArray(body.files) ? body.files.slice(0,5) : [];

  if (!username) throw new Error("Username is required.");
  if (!message && !image && !files.length) throw new Error("Message, image, or files are required.");
  if (image && image.length > 45000) throw new Error("Images are too large for Google Sheets storage.");

  for (const file of files) {
    if (file && typeof file.data === "string" && file.data.length > 45000) {
      throw new Error("Files over about 32 KB cannot be stored directly in Google Sheets.");
    }
  }

  const row = makeRow_({
    id:body.id,
    username,
    channel,
    message,
    image,
    files,
    device_id:deviceId,
    edited:false
  });

  sh.appendRow(row);
  return {success:true,message:rowObject_(row)};
}

function patch_(body) {
  const sh = sheet_();
  const id = String(body.id || "");
  const deviceId = String(body.device_id || "");

  if (!id || !deviceId) throw new Error("Message ID and device ID are required.");

  const found = findRow_(sh,id);
  if (!found) throw new Error("Message not found.");

  const current = found.object;

  if (body.game_server === true) {
    if (current.username !== "__GAME_SERVER__" || current.device_id !== deviceId) {
      throw new Error("You are not the game host.");
    }

    const gameState = String(body.game_state || "").slice(0,20000);
    if (!gameState) throw new Error("Game state is required.");

    sh.getRange(found.row,4).setValue(gameState);
    sh.getRange(found.row,8).setValue(true);

    current.message = gameState;
    current.edited = true;

    return {success:true,game:current};
  }

  if (current.username === "__GAME_SERVER__" || current.device_id !== deviceId) {
    throw new Error("You cannot edit this message.");
  }

  const message = String(body.message || "").trim().slice(0,2000);
  if (!message) throw new Error("Message cannot be empty.");

  sh.getRange(found.row,4,1,2).setValues([[message,current.image]]);
  sh.getRange(found.row,8).setValue(true);

  current.message = message;
  current.edited = true;

  return {success:true,message:current};
}

function del_(body) {
  const sh = sheet_();

  if (body.delete_all === true) {
    clearMessages_(sh);
    return {success:true};
  }

  if (body.game_server === true) {
    const deviceId = String(body.device_id || "");
    const gameId = String(body.game_id || "");
    const id = String(body.id || "");

    if (!deviceId) throw new Error("Device ID is required.");

    if (gameId) {
      return {success:true,removed:removeGame_(sh,String(body.channel || "general"),gameId)};
    }

    if (!id) throw new Error("Game ID/message ID is required.");

    const found = findRow_(sh,id);

    if (!found || found.object.username !== "__GAME_SERVER__" || found.object.device_id !== deviceId) {
      throw new Error("You cannot delete this game.");
    }

    sh.deleteRow(found.row);
    return {success:true};
  }

  const id = String(body.id || "");
  const deviceId = String(body.device_id || "");

  if (!id || !deviceId) throw new Error("Message ID and device ID are required.");

  const found = findRow_(sh,id);

  if (!found || found.object.username === "__GAME_SERVER__" || found.object.device_id !== deviceId) {
    throw new Error("You cannot delete this message.");
  }

  sh.deleteRow(found.row);
  return {success:true};
}

function leaveGame_(sh,channel,gameId,deviceId) {
  const rows = readRaw_(sh).filter(x =>
    x.object.channel === channel &&
    x.object.username === "__GAME_SERVER__" &&
    String(x.object.message).indexOf(gameId) !== -1
  );

  if (!rows.length) return {success:true,stopped:true,removed:0};

  const first = rows[0];
  let state;

  try {
    state = JSON.parse(String(first.object.message).slice(PREFIX.length));
  } catch (_) {
    removeRows_(sh,rows.map(x=>x.row));
    return {success:true,stopped:true};
  }

  if (state.hostDeviceId === deviceId) {
    removeRows_(sh,rows.map(x=>x.row));
    return {success:true,stopped:true,hostLeft:true};
  }

  state.players = Array.isArray(state.players)
    ? state.players.filter(p => p && p.deviceId !== deviceId)
    : [];

  removeRows_(sh,rows.map(x=>x.row));

  if (!state.players.length) return {success:true,stopped:true};

  const row = makeRow_({
    id:Utilities.getUuid(),
    username:"__GAME_SERVER__",
    channel,
    message:PREFIX + JSON.stringify(state),
    image:null,
    files:[],
    device_id:state.hostDeviceId || first.object.device_id,
    edited:false
  });

  sh.appendRow(row);

  return {success:true,stopped:false,left:true,game:rowObject_(row)};
}

function removeGame_(sh,channel,gameId) {
  if (!gameId) return 0;

  const rows = readRaw_(sh).filter(x =>
    x.object.channel === channel &&
    x.object.username === "__GAME_SERVER__" &&
    String(x.object.message).indexOf(gameId) !== -1
  );

  removeRows_(sh,rows.map(x=>x.row));
  return rows.length;
}

function readMessages_(channel,since) {
  const sh = sheet_();
  const rows = readRaw_(sh);

  let messages = rows
    .map(x=>x.object)
    .filter(x=>x.channel === channel);

  if (since) {
    const n = new Date(since).getTime();
    if (!isNaN(n)) messages = messages.filter(x=>new Date(x.created_at).getTime() >= n);
  }

  messages.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  return {success:true,messages};
}

function readRaw_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];

  const values = sh.getRange(2,1,last-1,HEADERS.length).getValues();

  return values.map((r,i)=>({
    row:i+2,
    object:{
      id:String(r[0] || ""),
      username:String(r[1] || ""),
      channel:String(r[2] || ""),
      message:String(r[3] || ""),
      image:r[4] === "" ? null : r[4],
      files:parseJson_(r[5],[]),
      device_id:String(r[6] || ""),
      edited:Boolean(r[7]),
      created_at:r[8] instanceof Date ? r[8].toISOString() : String(r[8] || "")
    }
  }));
}

function findRow_(sh,id) {
  return readRaw_(sh).find(x=>x.object.id === id) || null;
}

function makeRow_(o) {
  return [
    String(o.id || Utilities.getUuid()),
    String(o.username || ""),
    String(o.channel || "general"),
    String(o.message || ""),
    o.image || "",
    JSON.stringify(o.files || []),
    String(o.device_id || ""),
    Boolean(o.edited),
    new Date().toISOString()
  ];
}

function rowObject_(row) {
  return {
    id:String(row[0]),
    username:String(row[1]),
    channel:String(row[2]),
    message:String(row[3]),
    image:row[4] || null,
    files:parseJson_(row[5],[]),
    device_id:String(row[6] || ""),
    edited:Boolean(row[7]),
    created_at:String(row[8] || "")
  };
}

function parseJson_(value,fallback) {
  if (!value) return fallback;
  try { return JSON.parse(String(value)); } catch (_) { return fallback; }
}

function removeRows_(sh,rowNumbers) {
  [...new Set(rowNumbers)].sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r));
}

function clearMessages_(sh) {
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2,last-1);
}

function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents || "{}";
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function output_(data,callback) {
  const json = JSON.stringify(data);

  if (callback) {
    const safe = String(callback).replace(/[^A-Za-z0-9_.$]/g,"");
    return ContentService.createTextOutput(safe + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(data);
}