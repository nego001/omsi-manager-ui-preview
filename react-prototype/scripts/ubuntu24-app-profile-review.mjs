// Data-only CI triage for a potential administrator-reviewed AppArmor rule.
// No profile generation/loading, filesystem writes, sysctl, privileged operation,
// sandbox change, or verification claim. All outputs use fixed enums and flags.
const allowedPolicy=new Set(['enabled','disabled','unknown','unavailable']);
export function assessApparmorAdminReview({apparmorRestriction,triage}={}){
 const policy=allowedPolicy.has(apparmorRestriction)?apparmorRestriction:'unknown';
 const realWindow=triage?.schema==='AUTO_X11_NATIVE_TRIAGE_V1'&&
  triage?.nativeAutoWindowVerified===true&&triage?.autoMapped===true&&
  triage?.x11BaselineMapped===true;
 const suspected=triage?.schema==='AUTO_X11_NATIVE_TRIAGE_V1'&&
  triage?.classification==='shared-electron-sandbox-startup-suspected'&&
  triage?.x11BaselineMapped===true&&triage?.autoMapped===false&&
  triage?.directMapped===false&&triage?.directControlUnavailable===false&&
  triage?.autoSignal==='SIGTRAP'&&triage?.directSignal==='SIGTRAP';
 let status='insufficient-evidence';
 if(realWindow)status='native-window-observed-no-policy-change-indicated';
 else if(suspected&&policy==='enabled')
  status='request-administrator-review-of-app-specific-userns-policy';
 else if(suspected&&policy==='disabled')
  status='investigate-startup-without-obvious-apparmor-namespace-restriction';
 return Object.freeze({
  schema:'AUTO_X11_APPARMOR_ADMIN_REVIEW_V1',
  apparmorRestriction:policy,status,
  administratorApprovalRequired:status==='request-administrator-review-of-app-specific-userns-policy',
  apparmorCausalityProven:false,
  actualElectronSandboxCertified:false,
  profileCreated:false,profileLoaded:false,hostPolicyChanged:false,
  sandboxBypassApplied:false,realDesktopCertified:false
 });
}
