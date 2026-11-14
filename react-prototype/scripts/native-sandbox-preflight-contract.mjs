// CI-only validator for the opt-in native ELF diagnostic's fixed vocabulary.
// Never log, store, or return raw stdout; this does not verify sandboxing.
const HEADER='OMSI_MANAGER_SANDBOX_PREFLIGHT_V1';
const schema=Object.freeze([
 ['apparmorUsernsRestriction',new Set(['enabled','disabled','unknown','unavailable'])],
 ['unprivilegedUsernsSwitch',new Set(['enabled','disabled','unknown','unavailable'])],
 ['usernsCapacity',new Set(['positive','zero','unknown','unavailable'])],
 ['userNamespacePolicyHint',new Set(['restriction-indicated','no-obvious-restriction','undetermined'])],
 ['userNamespaceCreationVerified',new Set(['false'])],
 ['electronSandboxVerified',new Set(['false'])],
 ['hostSecurityPolicyChanged',new Set(['false'])],
 ['securityBypassApplied',new Set(['false'])],
 ['nextAction',new Set(['review-read-only-diagnostic-with-system-administrator'])]
]);
export function validateNativeSandboxPreflight(stdout){
 if(typeof stdout!=='string'||stdout.length>2048||stdout.length<40||
    !stdout.endsWith('\n')||stdout.includes('\r')||stdout.includes('\0'))
  throw Error('NATIVE_SANDBOX_PREFLIGHT_REFUSED');
 const lines=stdout.slice(0,-1).split('\n');
 if(lines.length!==schema.length+1||lines[0]!==HEADER)
  throw Error('NATIVE_SANDBOX_PREFLIGHT_REFUSED');
 const report=Object.create(null);
 for(let i=0;i<schema.length;i++){
  const [key,allowed]=schema[i];
  const line=lines[i+1];
  if(!line.startsWith(key+'='))throw Error('NATIVE_SANDBOX_PREFLIGHT_REFUSED');
  const value=line.slice(key.length+1);
  if(!allowed.has(value))throw Error('NATIVE_SANDBOX_PREFLIGHT_REFUSED');
  report[key]=value;
 }
 const restricted=report.apparmorUsernsRestriction==='enabled'||
  report.unprivilegedUsernsSwitch==='disabled'||report.usernsCapacity==='zero';
 const clear=report.apparmorUsernsRestriction==='disabled'&&
  report.unprivilegedUsernsSwitch==='enabled'&&report.usernsCapacity==='positive';
 const hint=restricted?'restriction-indicated':clear?'no-obvious-restriction':'undetermined';
 if(report.userNamespacePolicyHint!==hint)
  throw Error('NATIVE_SANDBOX_PREFLIGHT_REFUSED');
 // Return only enumerated strings and explicit false flags. The native output
 // cannot be used to infer that user namespace creation or sandbox worked.
 return Object.freeze({
  source:'packaged-native-elf-read-only',
  apparmorUsernsRestriction:report.apparmorUsernsRestriction,
  unprivilegedUsernsSwitch:report.unprivilegedUsernsSwitch,
  usernsCapacity:report.usernsCapacity,
  userNamespacePolicyHint:report.userNamespacePolicyHint,
  userNamespaceCreationVerified:false,
  electronSandboxVerified:false,
  hostSecurityPolicyChanged:false,
  securityBypassApplied:false,
  provesX11Window:false
 });
}
