// Fixed-schema ephemeral UI events; no file names, paths, messages or timestamps.
export const MAX_LOCAL_ACTIVITY=30;
const ids=['omsi','ets2','ats'];
const actions=['inspection-observed','inspection-unavailable','inspection-cancelled','reference-saved','reference-discarded'];
export function appendLocalActivity(previous,game,action){
 if(!ids.includes(game)||!actions.includes(action))return previous;
 return [...previous.slice(-(MAX_LOCAL_ACTIVITY-1)),Object.freeze({game,action})];
}
