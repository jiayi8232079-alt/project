# Run this script in an elevated PowerShell window.
# It repairs VirtualBox Host-Only networking and restores 192.168.56.101 behavior.
# Usage:
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   & "c:\000_OPC\器件资料\scripts\fix-ubuntu1-vbox-network.ps1"

$ErrorActionPreference = "Stop"
# Avoid treating native command stderr as terminating PowerShell errors.
$PSNativeCommandUseErrorActionPreference = $false
$vbox = "${env:ProgramFiles}\Oracle\VirtualBox\VBoxManage.exe"
$vm = "Ubuntu1"
$ifname = "VirtualBox Host-Only Ethernet Adapter"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Please run PowerShell as Administrator, then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host "1) Powering off VM $vm ..."
$vmState = (& $vbox showvminfo $vm --machinereadable 2>$null | Select-String 'VMState=' | ForEach-Object { $_.ToString() })
if ($vmState -match 'VMState="running"') {
    & $vbox controlvm $vm acpipowerbutton | Out-Null
    $deadline = (Get-Date).AddSeconds(30)
    do {
        Start-Sleep -Seconds 2
        $vmState = (& $vbox showvminfo $vm --machinereadable 2>$null | Select-String 'VMState=' | ForEach-Object { $_.ToString() })
    } while ((Get-Date) -lt $deadline -and $vmState -notmatch 'VMState="poweroff"')
}
if ($vmState -match 'VMState="running"') {
    & $vbox controlvm $vm poweroff 2>$null | Out-Null
    Start-Sleep -Seconds 6
}

Write-Host "2) Disabling potentially conflicting Windows bridge bindings ..."
$ho = Get-NetAdapter | Where-Object { $_.InterfaceDescription -like "*VirtualBox Host-Only*" } | Select-Object -First 1
if ($ho) {
    Disable-NetAdapterBinding -Name $ho.Name -ComponentID "ms_l2bridge" -Confirm:$false -ErrorAction SilentlyContinue
    Disable-NetAdapterBinding -Name $ho.Name -ComponentID "oracle_VBoxNetLwf" -Confirm:$false -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Enable-NetAdapterBinding -Name $ho.Name -ComponentID "oracle_VBoxNetLwf" -Confirm:$false
}

Write-Host "3) Reinstalling VirtualBox network filter driver ..."
$inf = "${env:ProgramFiles}\Oracle\VirtualBox\drivers\network\netlwf\VBoxNetLwf.inf"
if (Test-Path $inf) { pnputil /add-driver $inf /install }

Write-Host "4) Recreating Host-Only adapter (192.168.56.1) ..."
# VBoxManage may print progress to stderr even on success.
# Temporarily relax PowerShell error handling for this noisy command.
$prevErr = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $vbox hostonlyif remove $ifname *>$null
Start-Sleep -Seconds 2
& $vbox hostonlyif create *>$null
& $vbox hostonlyif ipconfig $ifname --ip 192.168.56.1 --netmask 255.255.255.0 *>$null

& $vbox dhcpserver remove --ifname $ifname *>$null
& $vbox dhcpserver add --ifname $ifname --ip 192.168.56.100 --netmask 255.255.255.0 `
    --lowerip 192.168.56.101 --upperip 192.168.56.254 --enable *>$null
$ErrorActionPreference = $prevErr

# Validate host-only adapter exists after recreation.
$hostOnlyOk = & $vbox list hostonlyifs 2>$null | Select-String -SimpleMatch $ifname
if (-not $hostOnlyOk) {
    throw "Host-Only adapter was not recreated successfully."
}

Write-Host "5) Switching VM NIC back to Host-Only ..."
$prevErr = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $vbox modifyvm $vm --nic1 hostonly --hostonlyadapter1 $ifname --cableconnected1 on `
    --boot1 disk --boot2 none --boot3 none --boot4 none *>$null
$ErrorActionPreference = $prevErr

Write-Host "6) Detaching ISO from IDE optical drive ..."
$prevErr = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $vbox storageattach $vm --storagectl "IDE" --port 0 --device 0 --medium none *>$null
$ErrorActionPreference = $prevErr

Write-Host "7) Starting VM ..."
& $vbox startvm $vm --type gui *>$null

# If Host-Only still fails on this host, fallback to NAT network net56.
$vmInfo = & $vbox showvminfo $vm 2>$null
$startOk = $vmInfo | Select-String -SimpleMatch "State:                       running"
if (-not $startOk) {
    Write-Host "Host-Only start failed. Falling back to NAT network net56 ..." -ForegroundColor Yellow
    & $vbox modifyvm $vm --nic1 natnetwork --nat-network1 net56 --cableconnected1 on *>$null
    & $vbox natnetwork add --netname net56 --network "192.168.56.0/24" --enable --dhcp on *>$null
    & $vbox dhcpserver modify --network=net56 --lower-ip=192.168.56.101 --enable *>$null
    & $vbox dhcpserver modify --network=net56 --vm=$vm --nic=1 --fixed-address=192.168.56.101 *>$null
    & $vbox startvm $vm --type gui *>$null
}

Write-Host ""
Write-Host "Done. After login in guest OS, run: ping 192.168.56.1" -ForegroundColor Green
Write-Host "If it still fails, there may be a Hyper-V/WSL conflict. Run as admin:" -ForegroundColor Yellow
Write-Host "  bcdedit /set hypervisorlaunchtype off" -ForegroundColor Yellow
Write-Host "Then reboot Windows and run this script again." -ForegroundColor Yellow
