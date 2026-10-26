# Test-only SID/NTFS access lab on disposable GitHub-hosted Windows runner.
# Never install a service, alter real user accounts or access OMSI paths.
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or
    $env:OMSI_SYNTHETIC_HOSTED_RUNNER -ne 'github-hosted' -or
    -not $IsWindows -or
    -not (Test-Path -LiteralPath $env:RUNNER_TEMP -PathType Container)) {
    throw 'Synthetic Windows principal lab refused outside hosted Windows CI'
}
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Synthetic Windows principal lab requires elevated ephemeral runner'
}
$token = [Guid]::NewGuid().ToString('N').Substring(0,11)
$serviceName = "omsis$token"
$otherName = "omsiu$token"
$root = Join-Path $env:RUNNER_TEMP ("omsi-win-principal-lab-" + [Guid]::NewGuid().ToString('N'))
$made = @()
try {
    $passwordA = 'M8!' + [Guid]::NewGuid().ToString('N') + 'z'
    $passwordB = 'M9!' + [Guid]::NewGuid().ToString('N') + 'z'
    $service = New-LocalUser -Name $serviceName -Password (
        ConvertTo-SecureString $passwordA -AsPlainText -Force) -AccountNeverExpires
    $made += $serviceName
    $other = New-LocalUser -Name $otherName -Password (
        ConvertTo-SecureString $passwordB -AsPlainText -Force) -AccountNeverExpires
    $made += $otherName
    if ($service.SID.Value -eq $other.SID.Value) { throw 'Distinct SIDs required' }
    Write-Output 'PASS_WINDOWS_DISTINCT_LOCAL_SIDS'

    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $private = Join-Path $root 'service-private'
    New-Item -ItemType Directory -Path $private | Out-Null
    # Strip inherited permissions and grant service Read/Execute, SYSTEM
    # and builtin Administrators full control only. No Everyone/Users ACE.
    $permissions = @(
        ('*' + $service.SID.Value + ':(OI)(CI)RX'),
        '*S-1-5-18:(OI)(CI)F',
        '*S-1-5-32-544:(OI)(CI)F'
    )
    & icacls.exe $private '/inheritance:r' '/grant:r' @permissions | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Setting private NTFS DACL failed' }
    $canary = Join-Path $private 'synthetic-only-canary.bin'
    [IO.File]::WriteAllBytes($canary, [Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;
public static class WinSyntheticPrincipalAccess {
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern bool LogonUser(string username, string domain,
        string password, int logonType, int provider, out SafeAccessTokenHandle token);
    public static bool CanRead(string name, string domain, string password, string path) {
        SafeAccessTokenHandle token;
        if(!LogonUser(name,domain,password,2,0,out token))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        using(token) {
            return WindowsIdentity.RunImpersonated(token, () => {
                try {
                    using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,
                        FileShare.Read)) {
                        return file.Length==32 && file.ReadByte()>=0;
                    }
                } catch (UnauthorizedAccessException) {return false;}
                  catch (IOException e) when ((uint)e.HResult==0x80070005) {return false;}
            });
        }
    }
}
'@
    $serviceRead = [WinSyntheticPrincipalAccess]::CanRead(
        $serviceName,$env:COMPUTERNAME,$passwordA,$canary)
    $otherRead = [WinSyntheticPrincipalAccess]::CanRead(
        $otherName,$env:COMPUTERNAME,$passwordB,$canary)
    if (-not $serviceRead -or $otherRead) {
        throw 'NTFS service-only file access denial failed'
    }
    Write-Output 'PASS_WINDOWS_IMPERSONATED_NTFS_SERVICE_ONLY_ACCESS'
    # This scenario deliberately does not start a service/named pipe.
    # File DACL denial does not prove authenticated IPC on Windows.
    Write-Output 'PASS_WINDOWS_NO_SERVICE_INSTALL'
} finally {
    if (Test-Path -LiteralPath $root) {
        # Restore the lab folder for cleanup as the hosted runner admin.
        & icacls.exe $root '/grant' '*S-1-5-32-544:(OI)(CI)F' '/T' | Out-Null
        Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    }
    foreach ($name in $made) {
        Remove-LocalUser -Name $name -ErrorAction Stop
    }
}
