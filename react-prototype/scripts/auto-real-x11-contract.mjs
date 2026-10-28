// Parse X11's read-only window metadata, not screenshots or game folders.
// xwininfo is run only within CI's own isolated Xvfb display.
const id=/^0x[0-9a-f]{1,16}$/i;
export function findPreviewWindow(tree){
 if(typeof tree!=='string'||tree.length>65536)throw Error('X11_WINDOW_NOT_VERIFIED');
 const matches=[];
 for(const line of tree.split(/\r?\n/)){
  if(!line.includes('"OMSI Manager'))continue;
  const found=line.match(/\b(0x[0-9a-f]{1,16})\s+"OMSI Manager[^"]*"\s*:/i);
  if(found&&id.test(found[1]))matches.push(found[1]);
 }
 if(matches.length!==1)throw Error('X11_WINDOW_NOT_VERIFIED');
 return matches[0];
}
export function verifyMappedWindow(details){
 if(typeof details!=='string'||details.length>16384||
  !/\bMap State:\s*IsViewable\b/.test(details))throw Error('X11_WINDOW_NOT_VERIFIED');
 const width=details.match(/\bWidth:\s*(\d{1,5})\b/);
 const height=details.match(/\bHeight:\s*(\d{1,5})\b/);
 if(!width||!height||Number(width[1])<800||Number(height[1])<500)
  throw Error('X11_WINDOW_NOT_VERIFIED');
 return Object.freeze({mapped:true,usableWindow:true});
}
export function verifyNativeCommandLine(command,backend){
 if(!Buffer.isBuffer(command)||!['x11','wayland'].includes(backend)||
  command.length===0||command.length>65536)throw Error('NATIVE_AUTO_PROCESS_NOT_VERIFIED');
 const args=command.toString('utf8').split('\0').filter(Boolean);
 if(!args[0]?.endsWith('/OMSI-Manager-Preview')||
  !args.includes('--ozone-platform='+backend)||
  args.includes('--no-sandbox')||args.includes('--disable-web-security')||
  args.includes('--disable-features=VizDisplayCompositor'))
  throw Error('NATIVE_AUTO_PROCESS_NOT_VERIFIED');
 return true;
}

export function verifyNativeWindowOwner(xpropOutput,expectedPid){
 // The X11 title alone is forgeable; demand a single exact _NET_WM_PID
 // that matches the process launched by this CI worker. This is evidence,
 // not cryptographic authentication of X11 clients or their window state.
 if(typeof xpropOutput!=='string'||xpropOutput.length>512||
    !Number.isSafeInteger(expectedPid)||expectedPid<=0||
    expectedPid>2147483647)
  throw Error('X11_WINDOW_OWNER_NOT_VERIFIED');
 const matched=xpropOutput.match(/^_NET_WM_PID\(CARDINAL\) = ([1-9][0-9]{0,9})\r?\n?$/);
 if(!matched||Number(matched[1])!==expectedPid)
  throw Error('X11_WINDOW_OWNER_NOT_VERIFIED');
 return true;
}

export function verifyNativeDesktopResults(results){
 // A successful GNOME X11 probe cannot silently stand in for KDE.
 // Both are profile labels in the CI-owned Xvfb, not real compositors.
 if(!Array.isArray(results)||results.length!==2||
   results[0]?.desktop!=='GNOME'||results[1]?.desktop!=='KDE'||
   results.some(value=>value===null||typeof value!=='object'||
    typeof value.mapped!=='boolean'||typeof value.failed!=='boolean'||
    typeof value.windowOwned!=='boolean'||typeof value.nativeProcess!=='boolean'||
    !value.nativeProcess||!value.windowOwned||!value.mapped||value.failed))
  throw Error('AUTO_X11_NATIVE_GUI_NOT_VERIFIED');
 return true;
}
