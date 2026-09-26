'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const DiscordRPC = require('discord-rpc');

loadEnvFile(path.join(__dirname, '..', '.env'));

const config = {
  port: Number(process.env.PORT || 3000),
  token: process.env.GSI_TOKEN || 'change-this-token',
  clientId: process.env.DISCORD_CLIENT_ID,
  showMenu: String(process.env.SHOW_MENU || 'false').toLowerCase() === 'true'
};

const startedAt = Date.now();
let gameState = {};
let lastActivity;
let rpcClient;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeObjects(base, patch) {
  if (!isObject(patch)) return patch;

  const result = isObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    result[key] = isObject(value) ? mergeObjects(result[key], value) : value;
  }
  return result;
}

function removePaths(state, removed) {
  if (!isObject(removed)) return state;

  const result = structuredClone(state);
  for (const [key, value] of Object.entries(removed)) {
    if (isObject(value) && isObject(result[key])) {
      result[key] = removePaths(result[key], value);
    } else {
      delete result[key];
    }
  }
  return result;
}

function applyGsiPayload(payload) {
  // GSI sends a full state on the first request and deltas afterwards.
  if (payload.provider || payload.map || payload.player || payload.round || payload.auth) {
    gameState = mergeObjects(gameState, payload);
  } else {
    gameState = mergeObjects(gameState, payload.previously || {});
    gameState = mergeObjects(gameState, payload.added || {});
    gameState = removePaths(gameState, payload.removed || {});
  }

  return gameState;
}

function valueOr(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function getModeLabel(map) {
  const mode = valueOr(map?.gamemode, '').toLowerCase();
  const labels = {
    competitive: 'Competitive',
    wingman: 'Wingman',
    premier: 'Premier',
    casual: 'Casual',
    deathmatch: 'Deathmatch',
    armsrace: 'Arms Race',
    demolition: 'Demolition',
    custom: 'Custom Match',
    training: 'Training'
  };

  if (labels[mode]) return labels[mode];
  if (mode.includes('premier')) return 'Premier';
  if (mode.includes('wingman')) return 'Wingman';
  if (mode.includes('competitive')) return 'Competitive';
  return mode ? mode.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'CS2';
}

function getScoreLine(map) {
  const ctScore = map?.team_ct?.score;
  const tScore = map?.team_t?.score;
  if (ctScore === undefined && tScore === undefined) return null;
  return `CT ${valueOr(ctScore, 0)} - T ${valueOr(tScore, 0)}`;
}

function buildActivity(state) {
  const map = state.map || {};
  const stats = state.player?.match_stats || {};
  const phase = valueOr(map.phase, '').toLowerCase();
  const mapName = valueOr(map.name, 'Unknown map');
  const mode = getModeLabel(map);
  const score = getScoreLine(map);
  const kd = `K/D ${valueOr(stats.kills, 0)}/${valueOr(stats.deaths, 0)}`;
  const matchScore = stats.score === undefined ? null : `Score ${stats.score}`;
  const details = phase === 'warmup' ? `${mode} • Warmup` : `${mode} • ${mapName}`;

  const activity = {
    details: details.slice(0, 128),
    state: ([score, kd, matchScore].filter(Boolean).join(' • ') || 'In game').slice(0, 128),
    startTimestamp: startedAt,
    largeImageKey: 'cs2',
    largeImageText: `Counter-Strike 2 • ${mapName}`,
    instance: true
  };

  if (state.round?.phase) {
    activity.smallImageText = `Round: ${state.round.phase}`;
  }

  return activity;
}

async function updatePresence() {
  if (!rpcClient || !gameState.map) return;

  const phase = valueOr(gameState.map.phase, '').toLowerCase();
  if (!config.showMenu && !phase && !gameState.player) {
    if (lastActivity) {
      await rpcClient.clearActivity().catch(() => {});
      lastActivity = undefined;
    }
    return;
  }

  const activity = buildActivity(gameState);
  const serialized = JSON.stringify(activity);
  if (serialized === lastActivity) return;

  try {
    await rpcClient.setActivity(activity);
    lastActivity = serialized;
    console.log(`[RPC] ${activity.details} | ${activity.state}`);
  } catch (error) {
    console.error(`[RPC] Could not update presence: ${error.message}`);
  }
}

function isAuthorized(request) {
  return config.token === 'change-this-token' || request.headers.authorization === config.token;
}

const server = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/') {
    const isHealthCheck = request.method === 'GET' && request.url === '/health';
    response.writeHead(isHealthCheck ? 200 : 404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: isHealthCheck, status: gameState.map ? 'receiving' : 'waiting' }));
    return;
  }

  if (!isAuthorized(request)) {
    response.writeHead(401);
    response.end('Unauthorized');
    return;
  }

  let body = '';
  request.on('data', chunk => {
    body += chunk;
    if (body.length > 2_000_000) request.destroy();
  });

  request.on('end', async () => {
    try {
      applyGsiPayload(JSON.parse(body));
      await updatePresence();
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
    } catch (error) {
      console.error(`[GSI] Invalid payload: ${error.message}`);
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    }
  });
});

async function connectToDiscord() {
  if (!config.clientId || config.clientId === 'your_discord_application_id') {
    console.warn('[RPC] DISCORD_CLIENT_ID is not set. GSI listener will run without Discord.');
    return;
  }

  rpcClient = new DiscordRPC.Client({ transport: 'ipc' });
  rpcClient.on('ready', () => {
    console.log('[RPC] Connected to Discord.');
    updatePresence().catch(() => {});
  });
  rpcClient.on('disconnected', () => {
    console.warn('[RPC] Discord disconnected. Restart the bridge to reconnect.');
  });

  try {
    await rpcClient.login({ clientId: config.clientId });
  } catch (error) {
    console.error(`[RPC] Discord connection failed: ${error.message}`);
    rpcClient = undefined;
  }
}

function start() {
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`CS2 GSI listener: http://127.0.0.1:${config.port}`);
    console.log('Waiting for CS2. Restart the game after installing the GSI config.');
    connectToDiscord().catch(error => console.error(`[RPC] ${error.message}`));
  });

  process.on('SIGINT', async () => {
    if (rpcClient) await rpcClient.clearActivity().catch(() => {});
    server.close(() => process.exit(0));
  });
}

if (require.main === module) start();

module.exports = {
  applyGsiPayload,
  buildActivity,
  getModeLabel,
  getScoreLine
};
