// Data-only CI triage for a potential administrator-reviewed AppArmor rule.
// No profile generation/loading, filesystem writes, sysctl, privileged operation,
// sandbox change, or verification claim. All outputs use fixed enums and flags.
const allowedPolicy=new Set(['enabled','disabled','unknown','unavailable']);
export function assessApparmorAdminReview(input={}){
 // Refuse malformed callers without throwing, leaking or making policy claims.
 const {apparmorRestriction,apparmorModuleState,namespaceProbe,triage}=input&&typeof input==='object'?input:{};
 const policy=allowedPolicy.has(apparmorRestriction)?apparmorRestriction:'unknown';
 const moduleState=allowedPolicy.has(apparmorModuleState)?apparmorModuleState:'unknown';
 const probe=namespaceProbe==='permission-denied'||namespaceProbe==='allowed'||
  namespaceProbe==='unavailable'?namespaceProbe:'unknown';
 const realWindow=triage?.schema==='AUTO_X11_NATIVE_TRIAGE_V1'&&
  triage?.classification==='native-auto-window-mapped'&&
  triage?.autoSignal==='none'&&triage?.nativeAutoWindowVerified===true&&triage?.autoMapped===true&&
  triage?.x11BaselineMapped===true;
 const suspected=triage?.schema==='AUTO_X11_NATIVE_TRIAGE_V1'&&
  triage?.classification==='shared-electron-sandbox-startup-suspected'&&
  triage?.x11BaselineMapped===true&&triage?.autoMapped===false&&
  triage?.directMapped===false&&triage?.directControlUnavailable===false&&
  triage?.nativeAutoWindowVerified===false&&
  triage?.autoSignal==='SIGTRAP'&&triage?.directSignal==='SIGTRAP';
 let status='insufficient-evidence';
 if(realWindow)status='native-window-observed-no-policy-change-indicated';
 else if(suspected&&policy==='enabled'&&moduleState==='enabled'&&probe==='permission-denied')
  status='request-administrator-review-of-app-specific-userns-policy';
 else if(suspected&&policy==='enabled'&&probe==='allowed')
  status='investigate-startup-with-userns-probe-allowed';
 else if(suspected&&policy==='disabled')
  status='investigate-startup-without-obvious-apparmor-namespace-restriction';
 return Object.freeze({
  schema:'AUTO_X11_APPARMOR_ADMIN_REVIEW_V1',
  apparmorRestriction:policy,apparmorModuleState:moduleState,userNamespaceProbe:probe,status,
  administratorApprovalRequired:status==='request-administrator-review-of-app-specific-userns-policy',
  apparmorCausalityProven:false,
  actualElectronSandboxCertified:false,
  profileCreated:false,profileLoaded:false,hostPolicyChanged:false,
  sandboxBypassApplied:false,realDesktopCertified:false
 });
}
