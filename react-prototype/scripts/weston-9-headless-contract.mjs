// Weston 9.0 (Ubuntu 22.04) headless compositor invocation.
// The older compositor accepts --use-pixman, not --renderer=pixman.
// This launches a disposable CI compositor; it cannot change host security.
export function weston9HeadlessArgs(socketName){
 if(typeof socketName!=='string'||!/^[a-z][a-z0-9-]{0,49}$/.test(socketName))
  throw Error('WESTON_HEADLESS_SOCKET_REFUSED');
 return Object.freeze([
  '--backend=headless-backend.so',
  '--socket='+socketName,
  '--idle-time=0',
  '--use-pixman'
 ]);
}
