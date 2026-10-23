'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_ENTRIES_PER_GROUP = 2000;
const GAME_GROUPS = Object.freeze({
  omsi: Object.freeze([
    Object.freeze({ key: 'vehicles', name: 'Veículos', folder: 'Vehicles' }),
    Object.freeze({ key: 'maps', name: 'Mapas', folder: 'maps' }),
    Object.freeze({ key: 'scenery', name: 'Objetos de cenário', folder: 'Sceneryobjects' }),
    Object.freeze({ key: 'splines', name: 'Splines', folder: 'Splines' })
  ]),
  ets2: Object.freeze([
    Object.freeze({ key: 'mods', name: 'Mods', folder: 'mod' })
  ]),
  ats: Object.freeze([
    Object.freeze({ key: 'mods', name: 'Mods', folder: 'mod' })
  ])
});

function requireGameId(game) {
  if (typeof game !== 'string' || !Object.hasOwn(GAME_GROUPS, game))
    throw new TypeError('Jogo inválido para inspeção.');
  return game;
}

// No recursion, no file reads, no writes, no path supplied by renderer.
async function countDirectChildren(folder, max = MAX_ENTRIES_PER_GROUP) {
  let dir;
  try {
    const stats = await fs.lstat(folder);
    if (stats.isSymbolicLink() || !stats.isDirectory())
      return { count: 0, found: false, limited: false };
    dir = await fs.opendir(folder);
  } catch (err) {
    if (err && ['ENOENT','ENOTDIR','EACCES','EPERM'].includes(err.code))
      return { count: 0, found: false, limited: false };
    throw err;
  }
  let count = 0;
  let limited = false;
  try {
    for await (const entry of dir) {
      // Directory entries are counted but never opened. Symbolic links are ignored.
      if (entry.isSymbolicLink()) continue;
      count++;
      // Only mark truncated if an entry exists beyond the cap.
      if (count > max) { count = max; limited = true; break; }
    }
  } finally {
    // for-await closes the directory automatically on break, but explicit safe
    // close when still open avoids retaining any directory handle.
    try { await dir.close(); } catch (err) { if (err?.code !== 'ERR_DIR_CLOSED') throw err; }
  }
  return { count, found: true, limited };
}

async function inspectGameDirectory(selectedRoot, game) {
  requireGameId(game);
  if (typeof selectedRoot !== 'string' || selectedRoot.length === 0)
    throw new TypeError('Selecione uma pasta válida.');
  const rootInfo = await fs.lstat(selectedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    throw new Error('A pasta selecionada não é um diretório normal.');
  const root = await fs.realpath(selectedRoot);
  const groups = [];
  for (const spec of GAME_GROUPS[game]) {
    const found = await countDirectChildren(path.join(root, spec.folder));
    groups.push({ key: spec.key, name: spec.name, found: found.found,
      count: found.count, limited: found.limited });
  }
  return {
    status: 'ok',
    game,
    // Only the folder's basename is returned; no absolute paths or file names.
    folderName: path.basename(root).slice(0,100),
    recognized: groups.some(g=>g.found),
    groups,
    limited: groups.some(g=>g.limited),
    mode: 'read-only'
  };
}

module.exports = { requireGameId, inspectGameDirectory, countDirectChildren, GAME_GROUPS, MAX_ENTRIES_PER_GROUP };
