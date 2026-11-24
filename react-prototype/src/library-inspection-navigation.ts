// Visual navigation only; no selection, inspection or file capability.
const headings={
 local:'local-inventory-heading',
 metadata:'local-config-metadata-heading',
 demonstration:'omsi-dependency-demo-heading'
} as const;
export type InspectionPanel=keyof typeof headings;
export function focusInspectionPanel(panel:InspectionPanel){
 const heading=document.getElementById(headings[panel]);
 if(!heading)return;
 heading.focus({preventScroll:true});
 heading.scrollIntoView({block:'start',behavior:'auto'});
}
