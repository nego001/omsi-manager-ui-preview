import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('docs/NEGRESCO-TOOLS-ASSET-MANIFEST.json',root),'utf8'));
let failed=0;
for(const [name,{sha256}] of Object.entries(manifest.regions)){
 let data;
 try{data=readFileSync(new URL('src/art/negresco/'+name+'.webp',root));}
 catch{console.error('MISSING '+name+'.webp');failed++;continue}
 const actual=createHash('sha256').update(data).digest('hex');
 if(actual!==sha256){console.error('MISMATCH '+name+'.webp');failed++;continue}
 console.log('OK '+name+'.webp');
}
if(failed){console.error('BLOCKED_APPROVED_ART: '+failed+' missing or modified asset(s).');process.exitCode=1;}
else console.log('APPROVED_ART_VERIFIED: 6/6; visual parity still requires screenshot and user acceptance.');
