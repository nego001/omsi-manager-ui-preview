// Compare the same three *read-only* categories at the start and end of a
// native smoke session. Matching categories do not prove that all AppArmor
// profiles, host policy or Electron sandbox state remained unchanged.
const refuse=()=>{throw Error('AUTO_X11_HOST_CATEGORIES_NOT_STABLE');};
const switches=new Set(['enabled','disabled']);
const namespace=new Set(['allowed','permission-denied']);
const fields=['apparmorRestriction','apparmorModuleState','userNamespaceProbe'];
function canonical(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.keys(value).length!==fields.length||
  !fields.every(k=>Object.hasOwn(value,k)))refuse();
 const {apparmorRestriction,apparmorModuleState,userNamespaceProbe}=value;
 if(!switches.has(apparmorRestriction)||!switches.has(apparmorModuleState)||
  !namespace.has(userNamespaceProbe))refuse();
 return {apparmorRestriction,apparmorModuleState,userNamespaceProbe};
}
export function verifyStableX11HostCategories(before,after){
 const first=canonical(before),second=canonical(after);
 if(fields.some(field=>first[field]!==second[field]))refuse();
 return Object.freeze({
  schema:'AUTO_X11_HOST_CATEGORIES_STABILITY_V1',
  checkedCategories:3,
  repeatedCategoriesMatched:true,
  namespaceProbeRepeated:true,
  apparmorCausalityProven:false,
  entireHostPolicyUnchangedProven:false,
  electronSandboxCertified:false,
  realDesktopCertified:false,
  hostPolicyModifiedByChecker:false,
  bypassUsedByChecker:false,
  evidenceOnly:true
 });
}
