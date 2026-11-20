'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {pathToFileURL}=require('node:url');

async function source(){
  const url=pathToFileURL(join(__dirname,'..','scripts','packaged-content-security.mjs')).href;
  return import(url);
}
test('packaged renderer allows only self-hosted scripts without inline or eval',async()=>{
  const {PACKAGED_CSP:csp}=await source();
  assert.match(csp,/(?:^|; )default-src 'none'(?:;|$)/);
  assert.match(csp,/(?:^|; )script-src 'self'(?:;|$)/);
  assert.doesNotMatch(csp,/script-src[^;]*unsafe-(inline|eval)/);
  assert.match(csp,/object-src 'none'/);
  assert.match(csp,/frame-src 'none'/);
  assert.match(csp,/worker-src 'none'/);
});
test('production renderer disallows arbitrary fetch and restricts remote images to game covers',async()=>{
  const {PACKAGED_CSP:csp}=await source();
  assert.match(csp,/connect-src 'none'/);
  assert.match(csp,/img-src 'self' data: https:\/\/shared\.fastly\.steamstatic\.com/);
  assert.doesNotMatch(csp,/img-src[^;]*https:\/\/\*/);
  assert.match(csp,/base-uri 'none'/);
  assert.match(csp,/form-action 'none'/);
});
test('React inline style attributes remain supported without relaxing script policy',async()=>{
  const {PACKAGED_CSP:csp}=await source();
  assert.match(csp,/style-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);
});
test('built CSP is injected first inside head and only once',async()=>{
  const {injectPackagedCSP:inject,CSP_META:meta}=await source();
  const src='<!doctype html><html><head><title>Safe</title></head><body><script src="./assets/app.js"></script></body></html>';
  const once=inject(src);
  assert.ok(once.startsWith('<!doctype html><html><head>'+meta));
  assert.equal(once.split(meta).length,2);
  assert.throws(()=>inject(once),/PACKAGED_CSP_BUILD_REFUSED/);
});
test('malformed head, duplicate head or pre-existing CSP fails the build',async()=>{
  const {injectPackagedCSP:inject}=await source();
  for(const value of [null,{},'', '<html></html>','<head><head></head>',
    '<head><meta http-equiv="Content-Security-Policy" content="default-src *"></head>']){
    assert.throws(()=>inject(value),/PACKAGED_CSP_BUILD_REFUSED/);
  }
});
test('CSP plugin applies only to built Vite artifacts, not local HMR',()=>{
  const vite=readFileSync(join(__dirname,'..','vite.config.ts'),'utf8');
  const html=readFileSync(join(__dirname,'..','index.html'),'utf8');
  assert.match(vite,/apply: 'build'/);
  assert.match(vite,/transformIndexHtml:\s*\(html\) => injectPackagedCSP\(html\)/);
  assert.doesNotMatch(html,/Content-Security-Policy/i);
});
test('production npm build verifies the resulting HTML before packaging',()=>{
  const pkg=JSON.parse(readFileSync(join(__dirname,'..','package.json'),'utf8'));
  assert.match(pkg.scripts.build,/vite build && node scripts\/verify-packaged-csp\.mjs/);
  const verifier=readFileSync(join(__dirname,'..','scripts','verify-packaged-csp.mjs'),'utf8');
  assert.match(verifier,/PACKAGED_CSP_ARTIFACT_REFUSED/);
  assert.match(verifier,/index\.html/);
});
