'use strict';
// TEST-ONLY fixture. This module is never imported into Electron or Vite.
// Writes solely inside a marker-checked direct child of os.tmpdir().
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const PREFIX = 'omsi-manager-recovery-fixture-';
const MARKER = '.omsi-test-fixture-marker';
const MAX_RECORD_BYTES = 2048;
const FILENAMES = Object.freeze(['prepared.json', 'intent.json', 'published.tmp', 'published.json']);
const PHASES = Object.freeze(['prepared','intent','published','published']);
const CRASH_EXIT = 91;

function reject(message) { throw Error('Temporary recovery fixture refused: ' + message); }
function isNonce(nonce) { return typeof nonce === 'string' && /^[0-9a-f]{32}$/.test(nonce); }
function expectedRecord(nonce, phase) {
  return Object.freeze({schemaVersion:1, scope:'temporary-fixture-only',
    nonce, generation:1, phase, dataTrusted:false, operationsEnabled:false});
}
function validRecord(value, nonce, phase) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return false;
  const expected = expectedRecord(nonce,phase);
  const keys = Object.keys(expected);
  return Reflect.ownKeys(value).length === keys.length &&
    keys.every(k => Object.hasOwn(value,k) && value[k] === expected[k]);
}
async function checkedRoot(root, nonce) {
  if (!isNonce(nonce) || typeof root !== 'string') reject('invalid identifier');
  const base = path.resolve(os.tmpdir());
  const candidate = path.resolve(root);
  if (path.dirname(candidate) !== base ||
      !path.basename(candidate).startsWith(PREFIX) ||
      !/^omsi-manager-recovery-fixture-[a-zA-Z0-9_-]+$/.test(path.basename(candidate)))
    reject('not a direct temporary-fixture directory');
  const stat = await fsp.lstat(candidate);
  if (!stat.isDirectory() || stat.isSymbolicLink()) reject('root not a real directory');
  const actual = await fsp.realpath(candidate);
  const realBase = await fsp.realpath(base);
  if (path.dirname(actual) !== realBase || actual !== path.join(realBase,path.basename(candidate)))
    reject('root canonical path mismatch');
  const mark = path.join(candidate, MARKER);
  const markStat = await fsp.lstat(mark);
  if (!markStat.isFile() || markStat.isSymbolicLink() || markStat.size !== 32)
    reject('invalid marker');
  if (await fsp.readFile(mark,'utf8') !== nonce) reject('marker mismatch');
  return candidate;
}
async function safeRecord(root, filename, nonce, phase) {
  const p = path.join(root,filename);
  let stat;
  try { stat = await fsp.lstat(p); }
  catch (err) { if (err.code === 'ENOENT') return {present:false}; throw err; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RECORD_BYTES || stat.size < 2)
    return {present:true,valid:false};
  // Not a security-grade TOCTOU defense: only a bounded, private test fixture.
  try {
    const data = await fsp.readFile(p,'utf8');
    return {present:true,valid:validRecord(JSON.parse(data),nonce,phase)};
  } catch { return {present:true,valid:false}; }
}
async function writeSyncedRecord(root, name, record) {
  const p = path.join(root,name);
  const handle = await fsp.open(p,'wx',0o600); // refuse overwrites and symlinks
  try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); }
  finally { await handle.close(); }
}
async function simulate(root,nonce,checkpoint) {
  if (!['before-prepare','after-prepare','after-intent','after-publish','complete'].includes(checkpoint))
    reject('unknown crash point');
  await checkedRoot(root,nonce);
  for (let i = 0; i < FILENAMES.length; i++) {
    if ((await safeRecord(root,FILENAMES[i],nonce,PHASES[i])).present)
      reject('fixture already used');
  }
  // Intentional process.exit(91) ends the separate Node process with no cleanup.
  // This is NOT a power failure or storage durability guarantee.
  if (checkpoint === 'before-prepare') process.exit(CRASH_EXIT);
  await writeSyncedRecord(root,'prepared.json',expectedRecord(nonce,'prepared'));
  if (checkpoint === 'after-prepare') process.exit(CRASH_EXIT);
  await writeSyncedRecord(root,'intent.json',expectedRecord(nonce,'intent'));
  if (checkpoint === 'after-intent') process.exit(CRASH_EXIT);
  await writeSyncedRecord(root,'published.tmp',expectedRecord(nonce,'published'));
  // Publication is a same-directory rename, not proof of durable metadata.
  await fsp.rename(path.join(root,'published.tmp'),path.join(root,'published.json'));
  if (checkpoint === 'after-publish') process.exit(CRASH_EXIT);
  return {stage:'complete',dataTrusted:false,operationsEnabled:false};
}
async function reconcile(root,nonce) {
  await checkedRoot(root,nonce);
  const [prepared,intent,publishing,published] = await Promise.all([
    safeRecord(root,'prepared.json',nonce,'prepared'),
    safeRecord(root,'intent.json',nonce,'intent'),
    safeRecord(root,'published.tmp',nonce,'published'),
    safeRecord(root,'published.json',nonce,'published')
  ]);
  const corrupted = [prepared,intent,publishing,published].some(x=>x.present && !x.valid);
  const any = [prepared,intent,publishing,published].some(x=>x.present);
  const ambiguous = publishing.present && published.present;
  // Fail closed: no event is elevated to trusted evidence, even after publication.
  return Object.freeze({source:'temporary-fixture-only',
    outcome:corrupted||ambiguous?'rejected-corrupt-or-incomplete':
      published.present?'published-untrusted':
      any?'incomplete-untrusted':'empty-untrusted',
    retainedStage:prepared.present,retainedIntent:intent.present,
    uncommittedPublicationPresent:publishing.present,
    publicationObserved:published.present,
    durabilityProven:false,directorySyncVerified:false,
    fileIdentityNativeVerified:false,oldEvidenceReusable:false,
    newAnalysisRequired:true,realModsInspected:false,
    operationsEnabled:false,filesModifiedInGames:0});
}
module.exports = {PREFIX, MARKER, CRASH_EXIT, MAX_RECORD_BYTES,
 expectedRecord,validRecord,checkedRoot,reconcile,simulate};
