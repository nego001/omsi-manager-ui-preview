'use strict';
// Main-process-only capability for a folder selected through Electron's native
// directory picker. Renderer cannot issue tokens or supply a pathname.
// A grant is one-shot, short-lived and scoped to a webContents/game pair.
const path=require('node:path');
const {requireGameId,inspectGameDirectory}=require('./game-inspection.cjs');
const MAX_GRANT_AGE_MS=15000;

function createInspectionGrantGate(options={}){
 const now=options.now||Date.now;
 const inspect=options.inspect||inspectGameDirectory;
 if(typeof now!=='function'||typeof inspect!=='function')
  throw new TypeError('Configuração de inspeção inválida.');
 const grants=new WeakMap();
 function deny(){throw new Error('Autorização de inspeção expirada ou inválida.');}
 function validOwner(ownerId){
  return Number.isSafeInteger(ownerId)&&ownerId>0;
 }
 function issue(selectedDirectory,gameId,ownerId){
  requireGameId(gameId);
  if(!validOwner(ownerId)||typeof selectedDirectory!=='string'||
      selectedDirectory.length===0||selectedDirectory.length>32767||
      selectedDirectory.includes('\0')||!path.isAbsolute(selectedDirectory))
   deny();
  const created=now();
  if(!Number.isSafeInteger(created)||created<0)deny();
  const ticket=Object.freeze({scope:'selected-directory-read-only',
    operationsEnabled:false});
  grants.set(ticket,{selectedDirectory,gameId,ownerId,created,used:false});
  return ticket;
 }
 async function inspectOnce(ticket,ownerId,gameId){
  // Never inspect a forged/cloned/JSON-provided ticket. No getters read.
  const grant=ticket&&typeof ticket==='object'?grants.get(ticket):null;
  if(!grant||grant.used)deny();
  // Fail closed even on wrong owner/game, expiry or bad clock, so a leaked
  // reference cannot be retried in a different renderer.
  grant.used=true;
  const current=now();
  if(!validOwner(ownerId)||ownerId!==grant.ownerId||
     gameId!==grant.gameId||
     !Number.isSafeInteger(current)||current<grant.created||
     current-grant.created>MAX_GRANT_AGE_MS)deny();
  return inspect(grant.selectedDirectory,grant.gameId);
 }
 function revoke(ticket){
  const grant=ticket&&typeof ticket==='object'?grants.get(ticket):null;
  if(!grant||grant.used)return false;
  grant.used=true;
  return true;
 }
 return Object.freeze({issue,inspectOnce,revoke});
}
module.exports={createInspectionGrantGate,MAX_GRANT_AGE_MS};
