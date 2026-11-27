import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-appcontainer-network.ps1',import.meta.url));
test('Windows disposable AppContainer without capabilities refuses loopback and preserves controls',t=>{
 if(process.platform!=='win32'){t.diagnostic('Windows AppContainer laboratory not executed on this host.');return;}
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:60000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-windows-appcontainer-network',mechanism:'AppContainer',
  positiveBefore:true,positiveAfter:true,appContainerTokenVerified:true,zeroCapabilitiesVerified:true,profileSidVerified:true,
  loopbackConnectRefused:true,refusalWin32Code:10013,loopbackListenerUnreached:true,
  profileDeleteSucceeded:true,temporaryFilesRemoved:true,firewallChanged:false,
  allNetworkDeniedVerified:false,readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native permission binding: '+JSON.stringify(bindExecutedResource('windowsAppContainerNetwork',r,script)));
 t.diagnostic('Windows AppContainer network: '+JSON.stringify(r));
});
