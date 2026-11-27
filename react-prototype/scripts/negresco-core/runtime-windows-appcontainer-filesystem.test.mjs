import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-windows-appcontainer-filesystem.ps1',import.meta.url));
test('Windows disposable AppContainer fixture ACL permits read-only input and refuses sentinel and mutation access',t=>{
 if(process.platform!=='win32'){t.diagnostic('Windows AppContainer filesystem laboratory not executed on this host.');return;}
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script],{encoding:'utf8',timeout:65000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-windows-appcontainer-filesystem',mechanism:'AppContainerFixtureAcl',
  positiveBefore:true,positiveAfter:true,appContainerTokenVerified:true,zeroCapabilitiesVerified:true,profileSidVerified:true,
  allowedRead:true,outsideReadRefused:true,writeRefused:true,truncateRefused:true,createRefused:true,deleteRefused:true,
  explicitFixtureAcl:true,fixturesUnchanged:true,profileDeleteSucceeded:true,temporaryFilesRemoved:true,
  inheritedHandlesVerified:false,universalFilesystemIsolationVerified:false,readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native permission binding: '+JSON.stringify(bindExecutedResource('windowsAppContainerFilesystem',r,script)));
 t.diagnostic('Windows AppContainer filesystem: '+JSON.stringify(r));
});
