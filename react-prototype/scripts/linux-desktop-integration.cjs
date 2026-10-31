'use strict';
// Explicit, testable user-only desktop shortcut management for the unsigned
// Linux read-only preview. No sudo, shell, autostart or persistent service.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const os=require('node:os');

const NAME='org.omsi_manager.Preview.desktop';
const MARKER='X-OMSI-Manager-ReadOnly-Preview=true';
const REFUSAL='Linux desktop integration refused';
const deny=()=>{throw Error(REFUSAL);};

function hasUnsafePathChars(value){
 // ASCII control characters and desktop-entry/field-code metacharacters.
 const forbidden=[34,36,37,92,96]; // quote, dollar, percent, backslash, backtick
 return [...value].some(c=>{
  const n=c.charCodeAt(0);
  return n<32||n===127||forbidden.includes(n);
 });
}
function launcherIn(packageDir){
 if(process.platform!=='linux'||!path.isAbsolute(packageDir))deny();
 const launcher=path.join(packageDir,'OMSI-Manager-Auto');
 // Restrict the portable location instead of trying to implement every
 // desktop-spec quoting corner case. Spaces and accents are supported.
 if(hasUnsafePathChars(launcher))deny();
 return launcher;
}
function makeEntry(launcher){
 if(typeof launcher!=='string'||!path.isAbsolute(launcher)||
    hasUnsafePathChars(launcher))deny();
 return [
  '[Desktop Entry]',
  'Type=Application',
  'Name=OMSI Manager Preview',
  'Name[pt_BR]=OMSI Manager (prévia somente leitura)',
  'Comment=Read-only OMSI folder preview; no installation or modification',
  'Comment[pt_BR]=Prévia de pastas OMSI sem instalação ou alteração de mods',
  'Exec="'+launcher+'"',
  'Terminal=false',
  'Icon=applications-games',
  'Categories=Game;Utility;',
  'StartupNotify=true',
  MARKER,
  ''
 ].join('\n');
}
async function checkedPath(file,kind){
 try{
  const s=await fs.lstat(file);
  if(s.isSymbolicLink()||
     (kind==='directory'&&!s.isDirectory())||
     (kind==='file'&&(!s.isFile()||s.nlink!==1)))deny();
  return s;
 }catch(error){
  if(error?.code==='ENOENT')return null;
  throw error;
 }
}
function appDir(env){
 const home=env.HOME||os.homedir();
 if(!path.isAbsolute(home))deny();
 // The caller may use XDG_DATA_HOME, per the desktop standard. It must be
 // absolute, with no control bytes, and cannot be a filesystem root.
 const base=env.XDG_DATA_HOME||path.join(home,'.local','share');
 if(!path.isAbsolute(base)||base===path.parse(base).root||
    /[\u0000-\u001f\u007f]/u.test(base))deny();
 return path.join(base,'applications');
}
async function install({packageDir,env=process.env}){
 if(process.platform!=='linux'||process.getuid?.()===0)deny();
 const launcher=launcherIn(packageDir);
 const exec=await fs.realpath(launcher);
 if(exec!==launcher)deny(); // no launcher symlink redirection
 const st=await fs.stat(launcher);
 if(!st.isFile()||(st.mode&0o111)===0)deny();
 // The menu must point to the native ELF, not a shell or a symlink.
 const magic=(await fs.readFile(launcher)).subarray(0,4);
 if(magic.length!==4||!magic.equals(Buffer.from([0x7f,0x45,0x4c,0x46])))deny();
 const applications=appDir(env);
 const base=path.dirname(applications);
 await fs.mkdir(base,{recursive:true,mode:0o700});
 if(!(await checkedPath(base,'directory')))deny();
 await fs.mkdir(applications,{mode:0o700}).catch(e=>{
  if(e.code!=='EEXIST')throw e;
 });
 if(!(await checkedPath(applications,'directory')))deny();
 const target=path.join(applications,NAME);
 const expected=makeEntry(launcher);
 const existing=await checkedPath(target,'file');
 if(existing){
  const read=await fs.readFile(target,'utf8');
  if(read!==expected)deny(); // never overwrite another app's desktop file
  return {result:'already-installed',target};
 }
 const handle=await fs.open(target,constants.O_WRONLY|constants.O_CREAT|
   constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{
  await handle.writeFile(expected,'utf8');
  await handle.sync();
 }finally{await handle.close();}
 return {result:'installed',target};
}
async function remove({packageDir,env=process.env}){
 if(process.platform!=='linux'||process.getuid?.()===0)deny();
 const applications=appDir(env);
 if(!(await checkedPath(applications,'directory')))
  return {result:'not-installed'};
 const target=path.join(applications,NAME);
 if(!(await checkedPath(target,'file')))
  return {result:'not-installed'};
 const expected=makeEntry(launcherIn(packageDir));
 const existing=await fs.readFile(target,'utf8');
 const legacy=makeEntry(path.join(packageDir,'OMSI-Manager-Preview.sh'));
 if(existing!==expected&&existing!==legacy)deny();
 // An exact legacy entry from this very package is also removable.
 // Installation never silently rewrites a previous shortcut.
 await fs.unlink(target);
 return {result:'removed'};
}
async function main(argv=process.argv.slice(2)){
 if(argv.length!==1||!['install','remove'].includes(argv[0]))deny();
 const packageDir=path.dirname(path.resolve(process.argv[1]));
 const result=await (argv[0]==='install'?install:remove)({packageDir});
 process.stdout.write('OMSI desktop shortcut: '+result.result+'\n');
}
if(require.main===module){
 main().catch(()=>{
  process.stderr.write(REFUSAL+'\n');
  process.exitCode=3;
 });
}
module.exports={NAME,MARKER,makeEntry,appDir,install,remove,launcherIn};
