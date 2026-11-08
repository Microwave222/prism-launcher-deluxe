# Prism Launcher Deluxe — установка (Windows 10/11)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ElectronVersion = '33.2.1'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $env:LOCALAPPDATA 'PrismLauncherDeluxe'
$exeName = 'Prism Launcher Deluxe.exe'
try { Stop-Transcript | Out-Null } catch { }
Start-Transcript -Path (Join-Path $src 'install-log.txt') -Force | Out-Null
trap {
    Write-Host ''
    Write-Host ('  ОШИБКА: ' + $_.Exception.Message) -ForegroundColor Red
    try { Stop-Transcript | Out-Null } catch { }
    Read-Host '  Нажмите Enter, чтобы закрыть'
    exit 1
}

Write-Host ''
Write-Host '  Prism Launcher Deluxe — установка' -ForegroundColor Cyan
Write-Host ''

Get-Process -Name 'Prism Launcher Deluxe' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$marker = Join-Path $dest 'runtime.txt'
$haveRuntime = (Test-Path $marker) -and ((Get-Content $marker -Raw).Trim() -eq $ElectronVersion) -and (Test-Path (Join-Path $dest $exeName))
if (-not $haveRuntime) {
    $zip = Join-Path $env:TEMP "electron-v$ElectronVersion-win32-x64.zip"
    if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 50MB) {
        Write-Host '  [1/3] Скачиваю движок (около 110 МБ)...'
        $urls = @(
            "https://github.com/electron/electron/releases/download/v$ElectronVersion/electron-v$ElectronVersion-win32-x64.zip",
            "https://registry.npmmirror.com/-/binary/electron/v$ElectronVersion/electron-v$ElectronVersion-win32-x64.zip",
            "https://cdn.npmmirror.com/binaries/electron/v$ElectronVersion/electron-v$ElectronVersion-win32-x64.zip"
        )
        $ok = $false
        foreach ($url in $urls) {
            Write-Host "        источник: $url"
            Remove-Item $zip -Force -ErrorAction SilentlyContinue
            & curl.exe -L --fail --retry 2 --connect-timeout 20 -o $zip $url
            if ($LASTEXITCODE -ne 0) {
                try { Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 600 } catch { Write-Host ('        не удалось: ' + $_.Exception.Message) -ForegroundColor Yellow }
            }
            if ((Test-Path $zip) -and (Get-Item $zip).Length -gt 50MB) { $ok = $true; break }
            Write-Host '        не получилось, пробую другой источник...' -ForegroundColor Yellow
        }
        if (-not $ok) { throw 'Не удалось скачать движок ни с одного источника. Проверьте интернет / VPN.' }
    } else { Write-Host '  [1/3] Движок уже скачан' }
    Write-Host '  [2/3] Распаковываю...'
    Get-ChildItem $dest -Exclude 'userdata' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive -Path $zip -DestinationPath $dest -Force
    Rename-Item (Join-Path $dest 'electron.exe') $exeName -Force
    Remove-Item (Join-Path $dest 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
    Set-Content -Path $marker -Value $ElectronVersion
} else { Write-Host '  [1/3] Движок уже установлен'; Write-Host '  [2/3] Пропускаю распаковку' }

Write-Host '  [3/3] Копирую лаунчер...'
$app = Join-Path $dest 'resources\app'
if (Test-Path $app) { Remove-Item $app -Recurse -Force }
New-Item -ItemType Directory -Force -Path $app | Out-Null
foreach ($item in 'package.json', 'main.js', 'preload.js', 'features.js', 'renderer', 'assets') {
    Copy-Item (Join-Path $src $item) -Destination $app -Recurse -Force
}

$exe = Join-Path $dest $exeName
$ico = Join-Path $app 'assets\icon.ico'
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in [Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs')) {
    $lnk = $shell.CreateShortcut((Join-Path $dir 'Prism Launcher Deluxe.lnk'))
    $lnk.TargetPath = $exe
    $lnk.WorkingDirectory = $dest
    $lnk.IconLocation = "$ico,0"
    $lnk.Description = 'Prism Launcher Deluxe'
    $lnk.Save()
}

Write-Host ''
Write-Host '  Готово! Ярлык «Prism Launcher Deluxe» на рабочем столе.' -ForegroundColor Green
Start-Process -FilePath $exe -WorkingDirectory $dest
try { Stop-Transcript | Out-Null } catch { }
Start-Sleep -Seconds 3
