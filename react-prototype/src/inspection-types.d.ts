export type InspectionGameId='omsi'|'ets2'|'ats';
export type FolderInspection =
 | {status:'ok';game:InspectionGameId;folderName:string;recognized:boolean;mode:'read-only';limited:boolean;groups:Array<{key:string;name:string;found:boolean;count:number;limited:boolean}>}
 | {status:'cancelled'}
 | {status:'error';message:string};
declare global {
 interface Window {
  omsiPreview?: {
   mode:'read-only';
   capabilities:{readGameFiles:false;inspectDirectories?:boolean;installMods:false;uninstallMods:false;executeCommands:false};
   inspectGame?: (game:InspectionGameId)=>Promise<FolderInspection>;
  };
 }
}
export {};
