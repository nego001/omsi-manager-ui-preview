// Optional exact approved crops, provided by the pinned reference extraction script.
// No network fetch, no data URL, no simulated installation status.
const images=import.meta.glob('./art/negresco/*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const get=(name:string)=>images['./art/negresco/'+name+'.webp'];
export const approvedArt={hero:get('hero'),omsi:get('omsi'),ets2:get('ets2'),ats:get('ats'),mark:get('mark'),sidebarBus:get('sidebar-bus')};
