'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyGsiPayload, buildActivity, getModeLabel, getScoreLine } = require('../src');

test('formats common CS2 modes and scores', () => {
  assert.equal(getModeLabel({ gamemode: 'wingman' }), 'Wingman');
  assert.equal(getModeLabel({ gamemode: 'premier' }), 'Premier');
  assert.equal(getScoreLine({ team_ct: { score: 8 }, team_t: { score: 5 } }), 'CT 8 - T 5');
});

test('builds activity with map, score, and K/D', () => {
  const activity = buildActivity({ map: { name: 'de_mirage', gamemode: 'competitive', phase: 'live', team_ct: { score: 8 }, team_t: { score: 5 } }, player: { match_stats: { kills: 12, deaths: 7, score: 96 } }, round: { phase: 'live' } });
  assert.match(activity.details, /Competitive/);
  assert.match(activity.details, /de_mirage/);
  assert.match(activity.state, /CT 8 - T 5/);
  assert.match(activity.state, /K\/D 12\/7/);
});

test('applies delta payloads', () => {
  applyGsiPayload({ map: { name: 'de_nuke', gamemode: 'premier' }, player: { match_stats: { kills: 1 } } });
  const next = applyGsiPayload({ added: { map: { phase: 'live' } }, previously: { player: { match_stats: { deaths: 2 } } } });
  assert.equal(next.map.phase, 'live');
  assert.equal(next.player.match_stats.kills, 1);
  assert.equal(next.player.match_stats.deaths, 2);
});
