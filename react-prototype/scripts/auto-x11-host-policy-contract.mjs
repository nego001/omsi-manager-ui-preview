// Pure, synthetic, fail-closed helpers for the CI-only X11 host probe.
// Never serialize an AppArmor profile name, pathname, UID or source text.
export function categorizeApparmorModule(value){
 if(value===null||value===undefined)return 'unavailable';
 if(typeof value!=='string'||value.length>16)return 'unknown';
 const normalized=value.trim();
 if(normalized==='Y')return 'enabled';
 if(normalized==='N')return 'disabled';
 return 'unknown';
}

export function categorizeApparmorProfile(value){
 if(value===null||value===undefined)return 'unavailable';
 if(typeof value!=='string'||value.length>512)return 'unknown';
 const profile=value.trim();
 if(profile==='unconfined')return 'unconfined';
 // The profile string is untrusted and may contain identifying filesystem
 // paths; only its coarse enforcement category reaches the JSON report.
 if(/\(enforce\)$/.test(profile))return 'confined-enforce';
 if(/\(complain\)$/.test(profile))return 'confined-complain';
 return 'unknown';
}

export function categorizeUnshareFailure(error){
 // Do not return raw stderr, error messages, command paths or identifiers.
 // A permission-denied result does not prove AppArmor caused the denial.
 if(!error||typeof error!=='object')return 'other-failure';
 if(error.code==='ENOENT')return 'tool-unavailable';
 if(error.killed===true||error.code==='ETIMEDOUT'||error.signal==='SIGTERM')
  return 'timeout';
 if(error.code==='EPERM'||error.code==='EACCES')
  return 'permission-denied';
 const stderr=typeof error.stderr==='string'?error.stderr.slice(0,2048):'';
 if(/\b(?:Operation not permitted|Permission denied)\b/i.test(stderr))
  return 'permission-denied';
 if(/\b(?:Function not implemented|Invalid argument|not supported)\b/i.test(stderr))
  return 'unsupported';
 return 'other-failure';
}
