// Deliberately narrow numeric dotted versions: no SemVer aliases, prereleases or
// attempt to infer game versions from installed files.
const NUMERIC_VERSION=/^\d{1,4}(?:\.\d{1,4}){0,3}$/;
export function parseNumericVersion(value:unknown):number[]|null{
 if(typeof value!=='string'||!NUMERIC_VERSION.test(value))return null;
 const parts=value.split('.').map(Number);
 while(parts.length<4)parts.push(0);
 return parts;
}
export function compareNumericVersions(left:string,right:string):number|null{
 const a=parseNumericVersion(left);
 const b=parseNumericVersion(right);
 if(!a||!b)return null;
 for(let i=0;i<4;i++){
  if(a[i]!==b[i])return a[i]<b[i]?-1:1;
 }
 return 0;
}
export function validNumericVersion(value:unknown):value is string{
 return parseNumericVersion(value)!==null;
}
