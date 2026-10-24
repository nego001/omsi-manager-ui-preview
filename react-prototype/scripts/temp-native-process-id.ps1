# TEST-ONLY Windows process-handle witness. Starts and owns exactly one disposable
# sleeping child process. Never looks up an arbitrary user-supplied PID.
# No connection to Electron/preload/IPC, games, mods, installers or backups.
param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Nonce,
 [Parameter(Mandatory=$true)][string]$Scenario
)
$ErrorActionPreference='Stop'
$child=$null
$witness=$null
try {
 if ($Nonce -cnotmatch '^[0-9a-f]{32}$') { throw 'invalid fixture marker' }
 if ($Scenario -cnotin @('alive','terminated','forged-pid','forged-creation','repeated')) {
  throw 'invalid test scenario'
 }
 $base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
 $canonical=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
 $name=[IO.Path]::GetFileName($canonical)
 if ([IO.Path]::GetDirectoryName($canonical) -ine $base -or
     $name -cnotmatch '^omsi-manager-recovery-fixture-[a-zA-Z0-9_-]+$') {
  throw 'outside temporary fixture scope'
 }
 $directory=Get-Item -LiteralPath $canonical -Force
 if (-not $directory.PSIsContainer -or
    ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'unsafe fixture directory'
 }
 $marker=Join-Path $canonical '.omsi-test-fixture-marker'
 $markerInfo=Get-Item -LiteralPath $marker -Force
 if ($markerInfo.PSIsContainer -or
    ($markerInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    $markerInfo.Length -ne 32 -or
    [IO.File]::ReadAllText($marker) -cne $Nonce) {
  throw 'fixture marker invalid'
 }
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public sealed class OmsiTestOwnedProcessWitness : IDisposable
{
 private SafeWaitHandle handle;
 private readonly uint observedPid;
 private readonly long observedCreation;
 private bool disposed;
 const uint QUERY_LIMITED_INFORMATION = 0x1000u;
 const uint SYNCHRONIZE = 0x00100000u;
 const uint WAIT_OBJECT_0 = 0u;
 const uint WAIT_TIMEOUT = 258u;
 [DllImport("kernel32.dll",SetLastError=true)]
 private static extern SafeWaitHandle OpenProcess(uint access,
   [MarshalAs(UnmanagedType.Bool)] bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)]
 private static extern uint GetProcessId(SafeWaitHandle process);
 [DllImport("kernel32.dll",SetLastError=true)]
 [return:MarshalAs(UnmanagedType.Bool)]
 private static extern bool GetProcessTimes(SafeWaitHandle process,
   out FILETIME created,out FILETIME exit,out FILETIME kernel,out FILETIME user);
 [DllImport("kernel32.dll",SetLastError=true)]
 private static extern uint WaitForSingleObject(SafeWaitHandle process,uint timeout);
 private static long ReadBirth(SafeWaitHandle h)
 {
  FILETIME created,exit,kernel,user;
  if(!GetProcessTimes(h,out created,out exit,out kernel,out user))
   throw new IOException("native process times unavailable");
  return ((long)(uint)created.dwHighDateTime<<32)|
   (long)(uint)created.dwLowDateTime;
 }
 public OmsiTestOwnedProcessWitness(int ownedChildPid)
 {
  if(ownedChildPid<=0)throw new IOException("invalid owned child");
  handle=OpenProcess(QUERY_LIMITED_INFORMATION|SYNCHRONIZE,false,ownedChildPid);
  if(handle==null||handle.IsInvalid)throw new IOException("cannot open owned child handle");
  observedPid=GetProcessId(handle);
  if(observedPid==0||observedPid!=(uint)ownedChildPid)
   throw new IOException("owned child identity mismatch");
  observedCreation=ReadBirth(handle);
 }
 public bool Recheck()
 {
  if(disposed)throw new ObjectDisposedException("witness");
  return GetProcessId(handle)==observedPid&&ReadBirth(handle)==observedCreation;
 }
 public bool ReportMatches(int claimedPid,long claimedBirth)
 {
  if(disposed)throw new ObjectDisposedException("witness");
  return claimedPid>0&&(uint)claimedPid==observedPid&&
   claimedBirth==observedCreation&&Recheck();
 }
 public long TestOnlyCreationValue {
  get { if(disposed)throw new ObjectDisposedException("witness");return observedCreation; }
 }
 public bool IsExited()
 {
  if(disposed)throw new ObjectDisposedException("witness");
  uint result=WaitForSingleObject(handle,0u);
  if(result==WAIT_OBJECT_0)return true;
  if(result==WAIT_TIMEOUT)return false;
  throw new IOException("native process wait unavailable");
 }
 public void Dispose()
 {
  if(!disposed){disposed=true;if(handle!=null)handle.Dispose();}
 }
}
'@ -ErrorAction Stop
 # Use an executable under the PowerShell installation, not a user-supplied PID
 # or executable path. No filesystem game access and no child stdout/stderr.
 $executable=Join-Path $PSHOME 'powershell.exe'
 $startInfo=New-Object System.Diagnostics.ProcessStartInfo
 $startInfo.FileName=$executable
 $startInfo.Arguments='-NoProfile -NonInteractive -Command "Start-Sleep -Seconds 30"'
 $startInfo.UseShellExecute=$false
 $startInfo.CreateNoWindow=$true
 $startInfo.WindowStyle=[System.Diagnostics.ProcessWindowStyle]::Hidden
 $child=[System.Diagnostics.Process]::Start($startInfo)
 if ($null -eq $child) { throw 'fixture child failed to start' }
 $witness=[OmsiTestOwnedProcessWitness]::new($child.Id)
 $initialStable=$witness.Recheck()
 $firstAlive=(-not $witness.IsExited())
 $secondStable=$witness.Recheck()
 $claimedMatches=$false
 $forgedRejected=$false
 $exitObserved=$false
 switch ($Scenario) {
  'alive' {
   $claimedMatches=$witness.ReportMatches($child.Id,$witness.TestOnlyCreationValue)
  }
  'repeated' {
   $claimedMatches=$witness.ReportMatches($child.Id,$witness.TestOnlyCreationValue)
  }
  'forged-pid' {
   $forgedRejected=(-not $witness.ReportMatches(($child.Id+1),$witness.TestOnlyCreationValue))
  }
  'forged-creation' {
   $forgedRejected=(-not $witness.ReportMatches($child.Id,($witness.TestOnlyCreationValue+1)))
  }
  'terminated' {
   $claimedMatches=$witness.ReportMatches($child.Id,$witness.TestOnlyCreationValue)
   $child.Kill()
   if (-not $child.WaitForExit(10000)) { throw 'fixture child did not exit' }
   $exitObserved=$witness.IsExited()
  }
 }
 if (-not $initialStable -or -not $secondStable -or -not $firstAlive) {
  throw 'native process witness unstable'
 }
 $report=[ordered]@{
  source='temporary-windows-native-process-fixture'
  scenario=$Scenario
  status=if($Scenario -ceq 'terminated'){'owned-child-exit-observed-untrusted'}else{'owned-child-alive-observed-untrusted'}
  nativeProcessHandleObserved=$true
  nativeCreationTimeObserved=$true
  nativeSameHandleRechecked=$secondStable
  nativeChildAliveInitially=$firstAlive
  nativeChildExitObserved=$exitObserved
  matchingTestClaimObserved=$claimedMatches
  forgedTestClaimRejected=$forgedRejected
  pidReuseActuallySimulated=$false
  externalProcessOwnershipVerified=$false
  nativeLockOwnershipVerified=$false
  processIdentityAuthorizedForRecovery=$false
  automaticCleanupAllowed=$false
  canInstall=$false
  canRecover=$false
  canDelete=$false
  operationsEnabled=$false
  filesModifiedInGames=0
 }
 [Console]::Out.WriteLine(($report | ConvertTo-Json -Compress -Depth 3))
 exit 0
} catch {
 [Console]::Error.WriteLine('Temporary native process identity fixture refused.')
 exit 3
} finally {
 if($null -ne $witness){$witness.Dispose()}
 if($null -ne $child){
  try{
   if(-not $child.HasExited){$child.Kill();[void]$child.WaitForExit(10000)}
  }catch{}
  $child.Dispose()
 }
}
