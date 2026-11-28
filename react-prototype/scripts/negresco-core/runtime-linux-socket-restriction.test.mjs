import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bindExecutedResource} from './runtime-resource-test-binding.mjs';
const script=fileURLToPath(new URL('../../native-lab/negresco-linux-socket-restriction.py',import.meta.url));
test('Linux disposable seccomp worker refuses new sockets and connect on existing unconnected socket',t=>{
 if(process.platform!=='linux'){t.diagnostic('Linux socket restriction laboratory not executed on this host.');return;}
 const p=spawnSync('python3',['-I','-B',script],{encoding:'utf8',timeout:35000,maxBuffer:4096,windowsHide:true});
 assert.equal(p.error,undefined);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const r=JSON.parse(p.stdout);
 assert.deepEqual(r,{
  scope:'disposable-linux-socket-restriction',mechanism:'seccomp',
  positiveBefore:true,positiveAfter:true,noNewPrivilegesReadback:true,
  inetSocketRefused:true,inet6SocketRefused:true,unixSocketRefused:true,
  socketpairRefused:true,preexistingSocketConnectRefused:true,
  refusal:'EPERM',loopbackListenerUnreached:true,
  inheritedConnectedSocketsVerified:false,allNetworkDeniedVerified:false,
  readerIntegrated:false,operationsEnabled:false,realReadsPerformed:false
 });
 t.diagnostic('Native permission binding: '+JSON.stringify(bindExecutedResource('linuxSocketRestriction',r,script)));
 t.diagnostic('Linux socket restriction: '+JSON.stringify(r));
});
