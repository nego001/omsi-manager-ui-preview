export type InspectionGameId='omsi'|'ets2'|'ats';
export type InspectionGroup={
 key:string;name:string;found:boolean;count:number;limited:boolean;
 directories:number;files:number;packageCandidates:number;linksSkipped:number;others:number;
};
export type InspectionNotice={code:string;level:'info'|'attention';message:string};
export type FolderInspection=
 | {status:'ok';game:InspectionGameId;folderName:string;recognized:boolean;mode:'read-only';
    selectionMode:'parent-folder'|'direct-mod-folder';
    assessment:{scope:'directory-structure-only';compatibilityVerified:false;installationVerified:false;summary:string};
    limited:boolean;groups:InspectionGroup[];notices:InspectionNotice[];
    provenance?:{
     inspectionBackend:'node-directory-metadata';
     nativeDirectoryEnumeration:'not-connected'|'auxiliary-untrusted-observation';
     nativeIdentityAuthorizesOperations:false;
     atomicPathContainmentProven:false;
     abaRuledOut:false;
     gameFilesOpenedForContent:false;
     canInstall:false;canUninstall:false;canRecover:false;operationsEnabled:false;
    }}
 | {status:'cancelled'}
 | {status:'error';message:string};
declare global {
 interface Window {
  omsiPreview?: {
   mode:'read-only';
   runtime?:{operatingSystem:'windows'|'linux'|'unsupported';
    platformSelection:'automatic';gameOperations:'disabled'};
   capabilities:{readGameFiles:false;inspectDirectories?:boolean;installMods:false;uninstallMods:false;executeCommands:false};
   inspectGame?: (game:InspectionGameId)=>Promise<FolderInspection>;
  };
 }
}
export {};
