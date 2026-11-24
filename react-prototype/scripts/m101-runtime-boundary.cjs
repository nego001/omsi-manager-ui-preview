'use strict';
// Build/test-only. Verifies bounded archive inventory and static Electron
// imports, not an authenticity, sandbox or arbitrary-code safety proof.
const path=require('node:path');
const fs=require('node:fs/promises');
const ts=require('typescript');
const asar=require('@electron/asar');
const runtime=Object.freeze([
 'custom-omsi-discovery','document-epoch-gate','game-inspection','inspection-executor',
 'inspection-grant','inspection-report-projection','launch-argument-guard','main',
 'native-directory-choice','omsi-steam-locator','omsi-structure-hints','preload',
 'preview-mode-policy','security-policy','steam-build-reader','steam-candidate-store',
 'steam-discovery','truck-mod-locator'
].map(name=>name+'.cjs'));
const allowed=new Set(runtime);
const builtins=new Set(['electron','node:path','node:url','node:fs','node:fs/promises','node:crypto']);
const refuse=()=>{throw Error('M101_RUNTIME_BOUNDARY_REFUSED');};
function checkElectronSource(name,source){
 if(!allowed.has(name)||typeof source!=='string'||source.length>524288)refuse();
 const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(ast.parseDiagnostics.length)refuse();
 const imports=[];
 function visit(node){
  if(ts.isIdentifier(node)&&node.text==='require'){
   const parent=node.parent;
   if(!ts.isCallExpression(parent)||parent.expression!==node||parent.arguments.length!==1||
      !ts.isStringLiteral(parent.arguments[0]))refuse();
   const spec=parent.arguments[0].text;
   if(!builtins.has(spec)&&!(spec.startsWith('./')&&allowed.has(spec.slice(2))))refuse();
   imports.push(spec);
  }
  if(ts.isImportDeclaration(node)||ts.isImportEqualsDeclaration(node)||
     ts.isExportDeclaration(node)&&node.moduleSpecifier||
     ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)refuse();
  if(ts.isPropertyAccessExpression(node)&&['require','createRequire','_load'].includes(node.name.text))refuse();
  ts.forEachChild(node,visit);
 }
 visit(ast);return imports;
}
function checkInventory(entries){
 if(!Array.isArray(entries)||entries.length>100000)refuse();
 const seen=new Set();
 for(const raw of entries){
  if(typeof raw!=='string'||raw.length>1024)refuse();
  const name=raw.replace(/\\/g,'/').replace(/^\//,'');
  const parts=name.split('/');
  if(!name||parts.some(p=>!p||p==='.'||p==='..'||p.includes('\0'))||seen.has(name))refuse();
  seen.add(name);
  if(['scripts','native-lab','native-launcher','tests','examples','test-results','playwright-report','release','.github','.git'].includes(parts[0]))refuse();
  if(parts[0]==='electron'&&parts.length>1&&(parts.length!==2||!allowed.has(parts[1])))refuse();
 }
 for(const name of runtime)if(!seen.has('electron/'+name))refuse();
 if(!seen.has('dist/index.html')||!seen.has('package.json'))refuse();
}
async function auditRuntimeSource(root){
 const directory=path.join(root,'electron');
 const entries=await fs.readdir(directory,{withFileTypes:true});
 for(const entry of entries){
  if(!entry.isFile()||(!allowed.has(entry.name)&&!entry.name.endsWith('.test.cjs')))refuse();
 }
 for(const name of runtime)checkElectronSource(name,await fs.readFile(path.join(directory,name),'utf8'));
 return {electronModulesChecked:runtime.length};
}
function auditPackagedRuntime(archive){
 const entries=asar.listPackage(archive);
 checkInventory(entries);
 const config=JSON.parse(asar.extractFile(archive,'package.json').toString('utf8'));
 if(config.main!=='electron/main.cjs')refuse();
 for(const name of runtime)checkElectronSource(name,asar.extractFile(archive,'electron/'+name).toString('utf8'));
 return Object.freeze({schema:'omsi-m101-packaged-boundary-v1',electronModulesChecked:runtime.length,
  archiveInventoryChecked:true,staticImportsChecked:true,labDirectoriesExcluded:true,electronTestsExcluded:true,
  packageSignatureVerified:false,fullCodeSafetyProven:false,sandboxCertified:false,operationsEnabled:false});
}
module.exports={runtime,checkElectronSource,checkInventory,auditRuntimeSource,auditPackagedRuntime};
