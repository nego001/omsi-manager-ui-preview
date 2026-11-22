import assert from 'node:assert/strict';
import {PACKAGED_CSP} from './packaged-content-security.mjs';

// Runtime-only verification: this function is invoked in the actual packaged
// Windows and Linux Electron renderer, with Chromium sandbox enabled.
// Playwright evaluate() itself is privileged instrumentation, not CSP proof;
// the dynamically inserted DOM script, Function constructor and fetch are
// subject to normal renderer CSP enforcement.
export async function verifyPackagedCSPRuntime(page) {
  const evidence=await page.evaluate(async()=>{
    const policy=document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute('content')??null;
    // Inject only inert, synthetic JavaScript which assigns a test marker.
    // A properly enforced script-src rejects this DOM <script> insertion.
    const marker='__omsi_m61_synthetic_inline_marker__';
    const script=document.createElement('script');
    script.textContent='globalThis.__omsi_m61_synthetic_inline_marker__=true;';
    document.head.append(script);
    script.remove();
    const inlineScriptExecuted=globalThis[marker]===true;
    delete globalThis[marker];
    // A CSP without unsafe-eval must block dynamically compiled scripts.
    let dynamicScriptExecuted=false;
    try { dynamicScriptExecuted=Function('return 37')()===37; } catch {}
    // connect-src 'none' must reject even a harmless data: URL, without
    // making a real network request or referring to any private path.
    let dataFetchAllowed=false;
    try {
      const result=await fetch('data:text/plain,omsi-m61-synthetic');
      dataFetchAllowed=result.ok;
    } catch {}
    return {policy,inlineScriptExecuted,dynamicScriptExecuted,dataFetchAllowed};
  });
  // No path, endpoint, username, credentials or raw exception is returned.
  assert.deepEqual(evidence,{
    policy:PACKAGED_CSP,
    inlineScriptExecuted:false,
    dynamicScriptExecuted:false,
    dataFetchAllowed:false
  },'PACKAGED_CSP_RUNTIME_NOT_ENFORCED');
  console.log('PACKAGED_CSP_RUNTIME_VERIFIED');
}
