// Read-only aggregation of untrusted size metadata, not installed disk usage.
import type {CatalogMod} from './catalog';
import {declaredSizeBytes} from './declared-size-sort';

type SizeEntry=Pick<CatalogMod,'size'>;
export type DeclaredSizeSummary={known:number;unknown:number;subtotal:string};
const units:ReadonlyArray<readonly [string,bigint]>=[
 ['TB',1000n**4n],['GB',1000n**3n],['MB',1000n**2n],['KB',1000n]
];
function formatSubtotal(bytes:bigint):string{
 if(bytes===0n)return '0 B';
 for(const [unit,divisor] of units){
  if(bytes<divisor)continue;
  // BigInt prevents precision loss when aggregate exceeds MAX_SAFE_INTEGER.
  const hundredths=(bytes*100n+divisor/2n)/divisor;
  const whole=(hundredths/100n).toLocaleString('pt-BR');
  const fraction=(hundredths%100n).toString().padStart(2,'0').replace(/0+$/,'');
  return '≈ '+whole+(fraction?','+fraction:'')+' '+unit;
 }
 return bytes.toLocaleString('pt-BR')+' B';
}
export function summarizeDeclaredSizes(items:ReadonlyArray<SizeEntry>):DeclaredSizeSummary{
 let sum=0n,known=0;
 for(const item of items){
  const bytes=declaredSizeBytes(item.size);
  if(bytes===null)continue;
  sum+=BigInt(bytes);
  known++;
 }
 return {known,unknown:items.length-known,subtotal:formatSubtotal(sum)};
}
