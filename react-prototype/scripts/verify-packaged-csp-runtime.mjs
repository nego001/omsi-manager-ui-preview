import assert from 'node:assert/strict';
import {PACKAGED_CSP} from './packaged-content-security.mjs';

// Runtime-only verification: this function is invoked in the actual packaged
// Windows and Linux Electron renderer, with Chromium sandbox enabled.
// Playwright evaluate() is privileged instrumentation; directly invoking
// Function() or eval() from that context can bypass Chromium's ordinary
// CSP checks. Probe only browser-managed script injection and resource fetch;
// static source policy separately forbids unsafe-eval.
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
    // connect-src 'none' must reject even a harmless data: URL, without
    // making a real network request or referring to any private path.
    let dataFetchAllowed=false;
    try {
      const result=await fetch('data:text/plain,omsi-m61-synthetic');
      dataFetchAllowed=result.ok;
    } catch {}
    return {policy,inlineScriptExecuted,dataFetchAllowed};
  });
  // No path, endpoint, username, credentials or raw exception is returned.
  assert.deepEqual(evidence,{
    policy:PACKAGED_CSP,
    inlineScriptExecuted:false,
    dataFetchAllowed:false
  },'PACKAGED_CSP_RUNTIME_NOT_ENFORCED');
  console.log('PACKAGED_CSP_RUNTIME_VERIFIED');
}
