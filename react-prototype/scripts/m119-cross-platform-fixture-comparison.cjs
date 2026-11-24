'use strict';
// Comparison of admitted fixture reports only. No CI authentication,
// no actual same-file chain, no production capability decision.
const {createUnifiedReview}=require('./m118-unified-native-diagnostic-review.cjs');
function compareFixturePlatforms(linuxInput,windowsInput){
 const linux=createUnifiedReview('linux',linuxInput),windows=createUnifiedReview('win32',windowsInput);
 const formatsAgree=linux.format.rows.length===windows.format.rows.length&&linux.format.rows.every((row,i)=>{
  const other=windows.format.rows[i];
  return row.role===other.role&&row.knownMarkers===other.knownMarkers&&row.references===other.references&&row.exact===other.exact&&row.absentFromVirtualFixture===other.absentFromVirtualFixture;
 });
 const differences=Object.freeze([
  'linux-dependency-partial-budget-only',
  'windows-dependency-hardlink-only',
  'linux-special-fifo-only',
  'windows-directory-instead-only',
  ...(windows.reader.unavailableCases?['windows-reader-fixture-unavailable']:[]),
  ...windows.dependencies.unavailableCases.map(k=>'windows-dependency-'+k+'-unavailable')
 ]);
 return Object.freeze({schema:'omsi-m119-cross-platform-fixture-comparison-v1',
  scope:'independently-supplied-synthetic-fixture-reports',formatsAgree,
  linux:Object.freeze({readerCases:linux.reader.fixtureCases,formatCases:linux.format.rows.length,dependencyCases:linux.dependencies.observedCases,gaps:linux.coverageGaps}),
  windows:Object.freeze({readerCases:windows.reader.fixtureCases,formatCases:windows.format.rows.length,dependencyCases:windows.dependencies.observedCases,gaps:windows.coverageGaps}),
  differences,fullParityVerified:false,ciProvenanceVerified:false,nativeConsentVerified:false,
  linkedSameFileIdentityVerified:false,contentReadAuthorized:false,operationsEnabled:false});
}
module.exports={compareFixturePlatforms};
