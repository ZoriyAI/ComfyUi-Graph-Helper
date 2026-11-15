<#
.SYNOPSIS
  NodeWise Studio: build the app from the project's own source and install it for the current Windows user.

.DESCRIPTION
  There is no signed Windows package yet (no code signing certificate), so this script builds the app on this
  computer from the source of a release tag and installs it for you alone, without administrator rights:
  %LOCALAPPDATA%\Programs\NodeWise Studio, a Start menu shortcut and an entry in Settings > Apps > Installed apps.
  It checks the system first, uses a fitting Node.js or a private copy checked against nodejs.org's checksums, and
  starts the installed app once with a throw-away profile to prove it works. Running it again upgrades in place and
  keeps your data. Every step, question and exit code: docs/wiki/start/Installing-On-Windows.md.

  Windows 10 22H2 or Windows 11, x64, Windows PowerShell 5.1 or PowerShell 7.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
  Installs or upgrades the latest release. "-ExecutionPolicy Bypass" applies to this one PowerShell process only.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1 -Uninstall
  Removes the app and its shortcuts; asks before removing your data (the default keeps it).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1 -DryRun
  Prints every step and changes nothing.
#>
# Write-Host on purpose: the messages are for the person at the console and must not mix with a function's output.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '', Justification = 'Console messages for the person installing')]
# WorkingDirectory and the other parameters of Invoke-Program are read inside the script block it hands on.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSReviewUnusedParameter', '', Justification = 'Read by script blocks through dynamic scope')]
[CmdletBinding()]
param(
  # A release tag such as v1.0.0 instead of the latest release.
  [string]$Version = '',
  # Build the main branch (newest, untested code).
  [switch]$Main,
  # Build from a folder that already holds the source (a checkout).
  [string]$Source = '',
  # Remove the app; asks before removing your data (default: keep it).
  [switch]$Uninstall,
  # With -Uninstall: also remove the data folder without asking.
  [switch]$PurgeData,
  # Also put a shortcut on the desktop.
  [switch]$DesktopShortcut,
  # Install Node.js for the whole computer (winget, else the official installer) instead of a private copy.
  [switch]$SystemNode,
  # Use a private copy of Node.js even when a fitting one is installed.
  [switch]$PrivateNode,
  # Answer yes to the questions about installing (never to removing your data).
  [switch]$Yes,
  # Print every step and change nothing.
  [switch]$DryRun,
  # Keep the build folder after a successful install.
  [switch]$KeepBuild,
  # Where to build (default %LOCALAPPDATA%\nodewise-studio-installer).
  [string]$BuildDir = '',
  # Where to write the log (default %TEMP%\nodewise-studio-install.log).
  [string]$LogPath = '',
  # Language of the messages: en or ru (default: the system's).
  [ValidateSet('', 'en', 'ru')]
  [string]$Language = '',
  # Test switch: on another system, print the Windows plan of -DryRun (CI and Linux checks of this script).
  [switch]$PretendWindows,
  # Show the options.
  [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# The progress bar makes Invoke-WebRequest many times slower in Windows PowerShell 5.1.
$ProgressPreference = 'SilentlyContinue'

# ----------------------------------------------------------------------------------------------------------------
# Fixed facts. The names match src/shared/productNames.ts and the address src/main/identity.ts PROJECT_URL
# (tests/unit/installScripts.test.ts compares them).
$Repository = 'ZoriyAI/nodewise-studio'
$AppId = 'nodewise-studio'
$DisplayName = 'NodeWise Studio'
# The hosts this script downloads from; any other address is refused (Get-Remote below).
$AllowedHosts = @('api.github.com', 'codeload.github.com', 'github.com', 'nodejs.org', 'registry.npmjs.org')
# Windows 10 22H2 is build 19045; Windows 11 and Windows Server 2022 and later are above it.
$MinWindowsBuild = 19045
$BuildSpaceMB = 3500
$InstallSpaceMB = 600

# Exit codes (the same numbers in install-macos.sh; listed in the wiki's troubleshooting).
$ExitOk = 0
$ExitUnexpected = 1
$ExitUsage = 2
$ExitSystem = 3
$ExitDisk = 4
$ExitNetwork = 5
$ExitPrerequisite = 6
$ExitDownload = 7
$ExitBuild = 8
$ExitInstall = 9
$ExitVerify = 10
$ExitRunning = 11
# 12 (cancelled) is install-macos.sh's answer to Ctrl+C; on Windows, PowerShell itself ends a script on Ctrl+C.
$ExitCancelled = 12
$ExitUnsupportedVersion = 13

$UsageText = @'
NodeWise Studio installer for Windows

  powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1 [options]

  -Version <tag>      build this release tag (for example v1.0.0) instead of the latest release
  -Main               build the main branch (newest, untested code)
  -Source <folder>    build from a folder that already holds the source (a checkout)
  -Uninstall          remove the app; asks before removing your data (default: keep it)
  -PurgeData          with -Uninstall: also remove your data folder without asking
  -DesktopShortcut    also put a shortcut on the desktop
  -SystemNode         install Node.js for the whole computer (winget) instead of a private copy
  -PrivateNode        use a private copy of Node.js even when a fitting one is installed
  -Yes                answer yes to the questions about installing (never to removing your data)
  -DryRun             print every step and change nothing
  -KeepBuild          keep the build folder after a successful install
  -BuildDir <folder>  where to build (default %LOCALAPPDATA%\nodewise-studio-installer)
  -LogPath <file>     where to write the log (default %TEMP%\nodewise-studio-install.log)
  -Language en|ru     language of the messages (default: the system's)
  -Help               this text

Exit codes: 0 done, 1 unexpected error, 2 wrong option, 3 system not supported, 4 not enough disk space,
5 no connection, 6 a required tool is missing or was not installed, 7 download or check failed, 8 build failed,
9 install step failed, 10 the installed app did not pass its check, 11 the app is running, 12 cancelled,
13 this version cannot be installed by this script.
'@

if ($Help) { Write-Host $UsageText; exit $ExitOk }

# ----------------------------------------------------------------------------------------------------------------
# Messages in both languages; {0}, {1} are filled by the caller.
$Messages = @{
  en = @{
    start = 'NodeWise Studio installer for Windows. Log: {0}'
    dry = 'Dry run: every step is printed, nothing is changed.'
    step = 'Step {0} of {1}: {2}'
    s_check = 'checking this computer'
    s_source = 'getting the source'
    s_tools = 'tools for the build'
    s_build = 'building the app (several minutes)'
    s_install = 'installing'
    s_verify = 'checking the installed app'
    usage = 'Wrong options: {0}. See: install-windows.ps1 -Help'
    not_windows = 'This script is for Windows. On Linux install the .deb, .rpm, AppImage or .tar.gz from the release page; on a Mac use install-macos.sh.'
    old_windows = 'Windows build {0} is too old: the app needs Windows 10 22H2 (build 19045) or Windows 11.'
    bad_arch = 'This processor ({0}) is not supported yet: the app is built for x64 Windows only.'
    old_powershell = 'PowerShell {0} is too old: Windows PowerShell 5.1 or PowerShell 7 is needed.'
    admin = 'Note: this PowerShell runs as administrator. That is not needed; the app is installed for your own user either way.'
    system = 'Windows build {0}, {1}, PowerShell {2}, free space for the build {3} MB, for the app {4} MB.'
    no_space = 'Not enough free space in {0}: {1} MB free, {2} MB needed. Free some space or choose another folder with -BuildDir.'
    proxy = 'A proxy is set in the environment ({0}); downloads go through it.'
    no_net = '{0} cannot be reached. Check the internet connection (or the proxy settings) and run the script again.'
    net_ok = 'Connection to GitHub, nodejs.org and the npm registry: fine.'
    running = 'NodeWise Studio is running ({0}). Close it and run the script again.'
    latest = 'Latest release: {0}.'
    no_latest = 'GitHub did not say which release is the latest. Name one: install-windows.ps1 -Version v1.0.0'
    source_from = 'Source: {0}'
    download_failed = 'The download of {0} failed. The log says why: {1}'
    not_ours = 'The downloaded source is not NodeWise Studio ({0}). Nothing was installed.'
    too_old_version = 'Version {0} cannot be installed with this script: only versions that ship install-windows.ps1 can. Choose a newer one with -Version.'
    node_found = 'Node.js {0} found at {1}; it is used for the build.'
    node_private = 'Node.js {0} is needed only for the build. A private copy goes into the build folder; Windows is not changed.'
    node_other = 'Node.js {0} is on this computer, but the build needs version {1}. Yours stays as it is.'
    ask_node = 'Install Node.js {0} for the whole computer (winget; Windows asks for permission)?'
    checksum_ok = 'Checksum of {0}: matches nodejs.org.'
    checksum_bad = 'The checksum of {0} does not match nodejs.org. The file was deleted; nothing was installed.'
    signature_bad = 'The Node.js installer is not signed by the Node.js project. It was deleted; nothing was installed.'
    prebuilt_ok = 'Database module: the ready-made file for {0} is used; nothing is compiled.'
    needs_compile = 'No ready-made database module for {0}: it must be compiled, which needs the Visual Studio C++ build tools and Python.'
    ask_build_tools = 'Install the Visual Studio C++ build tools and Python with winget (several GB; Windows asks for permission)?'
    declined = 'Nothing was installed: {0} is needed for the build. Run the script again when you are ready.'
    no_winget = 'winget (App Installer from the Microsoft Store) is missing, and {0} must be installed with it. Install App Installer and run the script again.'
    build_failed = 'The build failed at: {0}. The last lines of the log are above; the whole log: {1}'
    installing_to = 'Installing into {0}'
    upgrade = 'Replacing version {0} with {1}; your data stays where it is.'
    install_failed = 'Installing failed at: {0}. The previous version, if there was one, is unchanged. Log: {1}'
    verify_failed = 'The installed app did not pass its check ({0}). Log: {1}'
    finished = 'Done. NodeWise Studio {0} is installed.'
    dry_finished = 'Dry run finished: the steps above would install NodeWise Studio {0}. Nothing was changed.'
    where = 'App:          {0}'
    data = 'Your data:    {0}'
    how_start = 'Start it:     Start menu > NodeWise Studio{0}'
    how_start_desktop = ', or the shortcut on the desktop'
    how_remove = 'Remove it:    Settings > Apps > Installed apps > NodeWise Studio > Uninstall, or: {0}'
    log_at = 'Log:          {0}'
    nothing_installed = 'NodeWise Studio is not installed for this user.'
    removed = 'Removed: {0}'
    ask_data = 'Also remove your data (settings, keys, projects, conversations) in {0}?'
    data_kept = 'Your data is kept in {0} (to remove it later: -Uninstall -PurgeData).'
    uninstalled = 'NodeWise Studio is removed.'
    dry_uninstalled = 'Dry run finished: the steps above would remove NodeWise Studio. Nothing was changed.'
    unexpected = 'Something unexpected failed. The log says what: {0}'
    yes_no = '[y/N]'
  }
  ru = @{
    start = 'Установка NodeWise Studio для Windows. Журнал: {0}'
    dry = 'Пробный прогон: шаги только печатаются, ничего не меняется.'
    step = 'Шаг {0} из {1}: {2}'
    s_check = 'проверка компьютера'
    s_source = 'загрузка исходного кода'
    s_tools = 'инструменты для сборки'
    s_build = 'сборка приложения (несколько минут)'
    s_install = 'установка'
    s_verify = 'проверка установленного приложения'
    usage = 'Неверные параметры: {0}. Справка: install-windows.ps1 -Help'
    not_windows = 'Этот скрипт для Windows. На Linux установите .deb, .rpm, AppImage или .tar.gz со страницы выпуска; на Mac запустите install-macos.sh.'
    old_windows = 'Сборка Windows {0} слишком старая: приложению нужна Windows 10 22H2 (сборка 19045) или Windows 11.'
    bad_arch = 'Этот процессор ({0}) пока не поддерживается: приложение собирается только для Windows x64.'
    old_powershell = 'PowerShell {0} слишком старый: нужен Windows PowerShell 5.1 или PowerShell 7.'
    admin = 'Заметка: этот PowerShell запущен от имени администратора. Это не нужно; приложение в любом случае ставится для вашего пользователя.'
    system = 'Windows, сборка {0}, {1}, PowerShell {2}, свободно для сборки {3} МБ, для приложения {4} МБ.'
    no_space = 'Мало места в {0}: свободно {1} МБ, нужно {2} МБ. Освободите место или выберите другую папку через -BuildDir.'
    proxy = 'В окружении задан прокси ({0}); загрузки идут через него.'
    no_net = 'Нет связи с {0}. Проверьте подключение к интернету (или настройки прокси) и запустите скрипт снова.'
    net_ok = 'Связь с GitHub, nodejs.org и реестром npm есть.'
    running = 'NodeWise Studio запущено ({0}). Закройте его и запустите скрипт снова.'
    latest = 'Последний выпуск: {0}.'
    no_latest = 'GitHub не ответил, какой выпуск последний. Укажите его сами: install-windows.ps1 -Version v1.0.0'
    source_from = 'Исходный код: {0}'
    download_failed = 'Не удалось скачать {0}. Причина в журнале: {1}'
    not_ours = 'Скачанный код не похож на NodeWise Studio ({0}). Ничего не установлено.'
    too_old_version = 'Версию {0} этим скриптом не установить: только версии, в которых есть install-windows.ps1. Выберите более новую через -Version.'
    node_found = 'Найден Node.js {0} ({1}); сборка пойдёт с ним.'
    node_private = 'Node.js {0} нужен только для сборки. Его отдельная копия ляжет в папку сборки; Windows не меняется.'
    node_other = 'На компьютере есть Node.js {0}, а сборке нужна версия {1}. Ваш Node.js останется как есть.'
    ask_node = 'Установить Node.js {0} для всего компьютера (через winget; Windows спросит разрешение)?'
    checksum_ok = 'Контрольная сумма {0} совпадает с nodejs.org.'
    checksum_bad = 'Контрольная сумма {0} не совпадает с nodejs.org. Файл удалён, ничего не установлено.'
    signature_bad = 'Установщик Node.js не подписан проектом Node.js. Он удалён, ничего не установлено.'
    prebuilt_ok = 'Модуль базы данных: используется готовый файл для {0}, компилировать ничего не нужно.'
    needs_compile = 'Нет готового модуля базы данных для {0}: его нужно скомпилировать, а для этого нужны инструменты сборки C++ из Visual Studio и Python.'
    ask_build_tools = 'Установить инструменты сборки C++ из Visual Studio и Python через winget (несколько ГБ; Windows спросит разрешение)?'
    declined = 'Ничего не установлено: для сборки нужен {0}. Запустите скрипт снова, когда будете готовы.'
    no_winget = 'Нет winget («Установщик приложений» из Microsoft Store), а {0} ставится через него. Установите «Установщик приложений» и запустите скрипт снова.'
    build_failed = 'Сборка остановилась на шаге: {0}. Последние строки журнала выше; весь журнал: {1}'
    installing_to = 'Установка в {0}'
    upgrade = 'Версия {0} заменяется на {1}; ваши данные остаются на месте.'
    install_failed = 'Установка остановилась на шаге: {0}. Прежняя версия, если была, не тронута. Журнал: {1}'
    verify_failed = 'Установленное приложение не прошло проверку ({0}). Журнал: {1}'
    finished = 'Готово. NodeWise Studio {0} установлено.'
    dry_finished = 'Пробный прогон закончен: шаги выше установили бы NodeWise Studio {0}. Ничего не изменено.'
    where = 'Приложение:   {0}'
    data = 'Ваши данные:  {0}'
    how_start = 'Запуск:       меню «Пуск» > NodeWise Studio{0}'
    how_start_desktop = ' или ярлык на рабочем столе'
    how_remove = 'Удаление:     Параметры > Приложения > Установленные приложения > NodeWise Studio > Удалить, или: {0}'
    log_at = 'Журнал:       {0}'
    nothing_installed = 'NodeWise Studio не установлено для этого пользователя.'
    removed = 'Удалено: {0}'
    ask_data = 'Удалить и ваши данные (настройки, ключи, проекты, разговоры) в {0}?'
    data_kept = 'Ваши данные остались в {0} (удалить позже: -Uninstall -PurgeData).'
    uninstalled = 'NodeWise Studio удалено.'
    dry_uninstalled = 'Пробный прогон закончен: шаги выше удалили бы NodeWise Studio. Ничего не изменено.'
    unexpected = 'Что-то пошло не так. Подробности в журнале: {0}'
    yes_no = '[д/Н]'
  }
}

$UiLanguage = 'en'
if ($Language) {
  $UiLanguage = $Language
} elseif ([System.Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ru') {
  $UiLanguage = 'ru'
}

# One message in the chosen language, with its placeholders filled.
function Get-Text {
  param([string]$Key, [object[]]$Values = @())
  $template = $Messages[$UiLanguage][$Key]
  if (-not $template) { $template = $Key }
  if ($Values.Count -gt 0) { return ($template -f $Values) }
  return $template
}

# ----------------------------------------------------------------------------------------------------------------
# Where things go. -PretendWindows (a dry run on another system) stands in for the Windows folders.
$IsWindowsSystem = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if (-not $IsWindowsSystem -and -not $PretendWindows) {
  Write-Host (Get-Text 'not_windows')
  exit $ExitSystem
}
if ($PretendWindows -and -not $DryRun) {
  Write-Host (Get-Text 'usage' @('-PretendWindows works only with -DryRun'))
  exit $ExitUsage
}
function Get-Folder {
  param([string]$Name, [string]$Fallback)
  $value = [System.Environment]::GetEnvironmentVariable($Name)
  if ($value) { return $value }
  return (Join-Path $HOME $Fallback)
}
$LocalAppData = Get-Folder 'LOCALAPPDATA' 'AppData/Local'
$RoamingAppData = Get-Folder 'APPDATA' 'AppData/Roaming'
$TempDir = [System.IO.Path]::GetTempPath()
$InstallDir = Join-Path (Join-Path $LocalAppData 'Programs') $DisplayName
$DataDir = Join-Path $RoamingAppData $AppId
if (-not $BuildDir) { $BuildDir = Join-Path $LocalAppData "$AppId-installer" }
$WorkDir = Join-Path $BuildDir 'work'
if ($IsWindowsSystem) {
  $StartMenuDir = [System.Environment]::GetFolderPath('Programs')
  $DesktopDir = [System.Environment]::GetFolderPath('Desktop')
} else {
  $StartMenuDir = Join-Path $RoamingAppData 'Microsoft/Windows/Start Menu/Programs'
  $DesktopDir = Join-Path $HOME 'Desktop'
}
$StartMenuLink = Join-Path $StartMenuDir "$DisplayName.lnk"
$DesktopLink = Join-Path $DesktopDir "$DisplayName.lnk"
$UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppId"
$AppExe = Join-Path $InstallDir "$AppId.exe"
$KeptScript = Join-Path $InstallDir 'install-windows.ps1'

# ----------------------------------------------------------------------------------------------------------------
# The log: everything, commands' output included. The screen gets short lines.
if (-not $LogPath) {
  $LogPath = Join-Path $TempDir 'nodewise-studio-install.log'
  if ($DryRun) { $LogPath = Join-Path $TempDir 'nodewise-studio-install-dry-run.log' }
}
$logFolder = Split-Path -Parent $LogPath
if ($logFolder -and -not (Test-Path -LiteralPath $logFolder)) { New-Item -ItemType Directory -Path $logFolder -Force | Out-Null }
Set-Content -LiteralPath $LogPath -Value '' -Encoding UTF8

function Add-LogLine {
  param([string]$Text)
  Add-Content -LiteralPath $LogPath -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Text) -Encoding UTF8
}

# A message on the screen and in the log.
function Show-Message {
  param([string]$Key, [object[]]$Values = @())
  $text = Get-Text $Key $Values
  Write-Host $text
  Add-LogLine $text
}

$script:StepNumber = 0
$StepCount = 6
function Show-Step {
  param([string]$Key)
  $script:StepNumber++
  Show-Message 'step' @($script:StepNumber, $StepCount, (Get-Text $Key))
}

# What a failure in the steps that follow means: its exit code and message.
$script:FailCode = $ExitUnexpected
$script:FailKey = 'unexpected'
$script:CurrentAction = ''
function Use-Phase {
  param([int]$Code, [string]$Key)
  $script:FailCode = $Code
  $script:FailKey = $Key
}

# Say why and leave with this exit code.
function Exit-Install {
  param([int]$Code, [string]$Key, [object[]]$Values = @())
  $text = Get-Text $Key $Values
  Write-Host $text -ForegroundColor Yellow
  Add-LogLine ("FAILED({0}) {1}" -f $Code, $text)
  if ($Code -ne $ExitOk) { Write-Host (Get-Text 'log_at' @($LogPath)) }
  Add-LogLine "EXIT $Code"
  exit $Code
}

# A yes/no question, asked once; -Yes answers yes; a dry run only says it would ask; no console answers no.
function Confirm-Choice {
  param([string]$Key, [object[]]$Values = @())
  $question = Get-Text $Key $Values
  Add-LogLine "ASK $question"
  if ($Yes) { Add-LogLine 'ANSWER yes (-Yes)'; return $true }
  if ($DryRun) { Write-Host "  DRY-RUN would ask: $question"; return $true }
  if (-not [System.Environment]::UserInteractive -or [Console]::IsInputRedirected) { Add-LogLine 'ANSWER no (no console)'; return $false }
  $answer = Read-Host ('{0} {1}' -f $question, (Get-Text 'yes_no'))
  Add-LogLine "ANSWER $answer"
  return ($answer -match '^(y|yes|д|да)$')
}

# Runs an action that changes something; in a dry run it is only printed.
function Invoke-Action {
  param([string]$Description, [scriptblock]$Action, [string]$Shown = '')
  $script:CurrentAction = $Description
  if ($DryRun) {
    $line = '  DRY-RUN {0}' -f $Description
    if ($Shown) { $line = '{0}: {1}' -f $line, $Shown }
    Write-Host $line
    Add-LogLine $line
    return
  }
  Add-LogLine "RUN $Description"
  & $Action
}

# Runs a program with its output in the log; a non-zero exit code stops the install with the current phase's code.
function Invoke-Program {
  param([string]$Description, [string]$FilePath, [string[]]$Arguments = @(), [string]$WorkingDirectory = '')
  $shown = '"{0}" {1}' -f $FilePath, (($Arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' ')
  Invoke-Action $Description {
    Add-LogLine "  $shown"
    $saved = $ErrorActionPreference
    # Native programs write progress to stderr; under 'Stop' Windows PowerShell 5.1 would take that for an error.
    $ErrorActionPreference = 'Continue'
    if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory }
    try {
      & $FilePath @Arguments 2>&1 | ForEach-Object { "$_" } | Add-Content -LiteralPath $LogPath -Encoding UTF8
      $code = $LASTEXITCODE
    } finally {
      if ($WorkingDirectory) { Pop-Location }
      $ErrorActionPreference = $saved
    }
    Add-LogLine "  exit code $code"
    if ($code -ne 0) { throw "$Description exited with $code" }
  } $shown
}

# A proxy address without its user and password, for the log and the screen.
function Hide-ProxyUser {
  param([string]$Address)
  return ($Address -replace '(://)[^@/]*@', '$1***@')
}

# The environment's HTTPS proxy, honoured by every download here; npm reads the same variables itself.
$ProxyAddress = ''
foreach ($name in @('HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy')) {
  $value = [System.Environment]::GetEnvironmentVariable($name)
  if ($value -and -not $ProxyAddress) { $ProxyAddress = $value }
}

# Windows PowerShell 5.1 may still offer old TLS versions first; GitHub and nodejs.org need TLS 1.2. This process only.
if ($PSVersionTable.PSVersion.Major -lt 6) {
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
}

# Options shared by every web request: no browser engine, the proxy when one is set.
function Get-WebOption {
  param([string]$Url)
  $options = @{ Uri = $Url; UseBasicParsing = $true; MaximumRedirection = 5; TimeoutSec = 600 }
  if ($ProxyAddress) { $options['Proxy'] = $ProxyAddress }
  $uri = [System.Uri]$Url
  # A GitHub token in the environment (CI) lifts the API's limit for anonymous calls; it goes to the API host only.
  if ($uri.Host -eq 'api.github.com' -and $env:GITHUB_TOKEN) { $options['Headers'] = @{ Authorization = "Bearer $($env:GITHUB_TOKEN)" } }
  return $options
}

# An HTTPS download from one of the allowed hosts only, retried three times.
function Get-Remote {
  param([string]$Url, [string]$OutFile)
  $uri = [System.Uri]$Url
  if ($uri.Scheme -ne 'https') { throw "refused: not HTTPS: $Url" }
  if ($AllowedHosts -notcontains $uri.Host) { throw "refused: host $($uri.Host)" }
  Add-LogLine "GET $Url"
  $options = Get-WebOption $Url
  $options['OutFile'] = $OutFile
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      Invoke-WebRequest @options | Out-Null
      return
    } catch {
      Add-LogLine ("  attempt {0} failed: {1}" -f $attempt, $_.Exception.Message)
      if ($attempt -eq 3) { throw }
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

# Whether HTTPS to this address answers at all (any HTTP status counts as an answer).
function Test-Reachable {
  param([string]$Url)
  $options = Get-WebOption $Url
  $options['Method'] = 'Head'
  $options['TimeoutSec'] = 30
  try {
    Invoke-WebRequest @options | Out-Null
    return $true
  } catch {
    $response = $null
    if ($_.Exception.PSObject.Properties['Response']) { $response = $_.Exception.Response }
    Add-LogLine ("  {0}: {1}" -f $Url, $_.Exception.Message)
    return ($null -ne $response)
  }
}

# The tag github.com/<repository>/releases/latest leads to: the fallback when the API answers nothing.
function Get-LatestTagFromPage {
  $options = Get-WebOption "https://github.com/$Repository/releases/latest"
  $options['Method'] = 'Head'
  try {
    $response = Invoke-WebRequest @options
    $final = ''
    if ($response.BaseResponse.PSObject.Properties['ResponseUri']) { $final = [string]$response.BaseResponse.ResponseUri }
    elseif ($response.BaseResponse.PSObject.Properties['RequestMessage']) { $final = [string]$response.BaseResponse.RequestMessage.RequestUri }
    Add-LogLine "  latest release page: $final"
    if ($final -match '/releases/tag/([^/?#]+)$') { return $Matches[1] }
  } catch {
    Add-LogLine "  latest release page: $($_.Exception.Message)"
  }
  return ''
}

# Free megabytes on the drive that holds this path (or would hold it).
function Get-FreeMB {
  param([string]$Path)
  if (-not $IsWindowsSystem) { return 99999 }
  $drive = New-Object System.IO.DriveInfo ([System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($Path)))
  return [int][math]::Floor($drive.AvailableFreeSpace / 1MB)
}

# The major number of a version such as v22.11.0.
function Get-Major {
  param([string]$Text)
  if ($Text -match '^v?(\d+)') { return [int]$Matches[1] }
  return -1
}

# The installed app's processes (by their path), if any run.
function Get-RunningApp {
  if (-not $IsWindowsSystem) { return $null }
  return (Get-Process -ErrorAction SilentlyContinue | Where-Object {
      $path = $null
      try { $path = $_.Path } catch { $path = $null }
      $path -and $path.StartsWith($InstallDir, [System.StringComparison]::OrdinalIgnoreCase)
    } | Select-Object -First 1)
}

# Removes a folder or file; Windows may hold a file for a moment after a program exits, so it tries again.
function Invoke-Removal {
  param([string]$Path)
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force
      return
    } catch {
      Add-LogLine "  remove $Path, attempt ${attempt}: $($_.Exception.Message)"
      if ($attempt -eq 5) { throw }
      Start-Sleep -Seconds 2
    }
  }
}

# Unpacks a .zip with .NET (fast, and safe for any letters in the path).
function Expand-Zip {
  param([string]$ZipFile, [string]$Destination)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipFile, $Destination)
}

# ----------------------------------------------------------------------------------------------------------------
Show-Message 'start' @($LogPath)
if ($DryRun) { Show-Message 'dry' }
Add-LogLine ("exit codes: ok=$ExitOk cancelled=$ExitCancelled (see -Help)")
Add-LogLine ("args: Version={0} Main={1} Source={2} Uninstall={3} Yes={4} SystemNode={5} PrivateNode={6} DesktopShortcut={7} Language={8} PowerShell={9}" -f $Version, $Main, $Source, $Uninstall, $Yes, $SystemNode, $PrivateNode, $DesktopShortcut, $UiLanguage, $PSVersionTable.PSVersion)
Add-LogLine "install=$InstallDir data=$DataDir build=$BuildDir"

$problems = @()
if ($Main -and $Version) { $problems += '-Main and -Version exclude each other' }
if ($Source -and ($Main -or $Version)) { $problems += '-Source excludes -Main and -Version' }
if ($PurgeData -and -not $Uninstall) { $problems += '-PurgeData works only with -Uninstall' }
if ($SystemNode -and $PrivateNode) { $problems += '-SystemNode and -PrivateNode exclude each other' }
if ($Version -and $Version -notmatch '^v?\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$') { $problems += "-Version takes a release tag such as v1.0.0, not $Version" }
if ($problems.Count -gt 0) { Exit-Install $ExitUsage 'usage' @($problems -join '; ') }

if ($PSVersionTable.PSVersion -lt [version]'5.1') { Exit-Install $ExitSystem 'old_powershell' @($PSVersionTable.PSVersion) }
if ($IsWindowsSystem) {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object System.Security.Principal.WindowsPrincipal $identity
  # The app needs no rights. An elevated window still installs for this same user, so it is only a note.
  if ($principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) { Show-Message 'admin' }
}

try {
  # --------------------------------------------------------------------------------------------------------------
  # -Uninstall: app folder, shortcuts, the Installed apps entry, the build folder; the data only when the person agrees.
  if ($Uninstall) {
    # Started from the copy inside the app folder (the Installed apps entry): run a copy from the temp folder, so
    # the folder can be removed while the script runs.
    if (-not $DryRun -and $PSCommandPath -and $PSCommandPath.StartsWith($InstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
      $copy = Join-Path $TempDir 'nodewise-studio-uninstall.ps1'
      Copy-Item -LiteralPath $PSCommandPath -Destination $copy -Force
      $forward = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $copy, '-Uninstall', '-LogPath', $LogPath)
      if ($PurgeData) { $forward += '-PurgeData' }
      if ($Yes) { $forward += '-Yes' }
      if ($Language) { $forward += @('-Language', $Language) }
      & (Get-Process -Id $PID).Path @forward
      exit $LASTEXITCODE
    }
    $running = Get-RunningApp
    if ($running) { Exit-Install $ExitRunning 'running' @($running.Path) }
    Use-Phase $ExitInstall 'install_failed'
    $found = $false
    foreach ($item in @($InstallDir, $StartMenuLink, $DesktopLink)) {
      if (Test-Path -LiteralPath $item) {
        $found = $true
        Invoke-Action "remove $item" { Invoke-Removal $item }
        Show-Message 'removed' @($item)
      }
    }
    if ($IsWindowsSystem -and (Test-Path -LiteralPath $UninstallKey)) {
      Invoke-Action 'remove the Installed apps entry' { Remove-Item -LiteralPath $UninstallKey -Recurse -Force }
    }
    if (-not $found) { Show-Message 'nothing_installed' }
    if (Test-Path -LiteralPath $BuildDir) { Invoke-Action "remove the build folder $BuildDir" { Invoke-Removal $BuildDir } }
    if (Test-Path -LiteralPath $DataDir) {
      $removeData = $false
      if ($PurgeData) { $removeData = $true }
      # Asked even when -Yes answered the other questions: removing data is never the default.
      elseif (-not $DryRun -and -not $Yes) {
        $removeData = Confirm-Choice 'ask_data' @($DataDir)
      }
      if ($removeData) {
        Invoke-Action "remove the data folder $DataDir" { Invoke-Removal $DataDir }
        Show-Message 'removed' @($DataDir)
      } else {
        Show-Message 'data_kept' @($DataDir)
      }
    }
    if ($DryRun) { Show-Message 'dry_uninstalled' } else { Show-Message 'uninstalled' }
    Add-LogLine "EXIT $ExitOk"
    exit $ExitOk
  }

  # --------------------------------------------------------------------------------------------------------------
  # Step 1: this computer.
  Show-Step 's_check'
  Use-Phase $ExitSystem 'unexpected'
  if ($IsWindowsSystem) {
    $build = [System.Environment]::OSVersion.Version.Build
    $arch = $env:PROCESSOR_ARCHITECTURE
    # A 32-bit PowerShell on 64-bit Windows reports x86 here and the real processor in PROCESSOR_ARCHITEW6432.
    if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
  } else {
    $build = 22631
    $arch = 'AMD64'
  }
  if ($arch -ne 'AMD64') { Exit-Install $ExitSystem 'bad_arch' @($arch) }
  if ($build -lt $MinWindowsBuild) { Exit-Install $ExitSystem 'old_windows' @($build) }
  $buildFree = Get-FreeMB $BuildDir
  $installFree = Get-FreeMB $InstallDir
  Show-Message 'system' @($build, 'x64', $PSVersionTable.PSVersion, $buildFree, $installFree)
  if ($buildFree -lt $BuildSpaceMB) { Exit-Install $ExitDisk 'no_space' @($BuildDir, $buildFree, $BuildSpaceMB) }
  if ($installFree -lt $InstallSpaceMB) { Exit-Install $ExitDisk 'no_space' @($InstallDir, $installFree, $InstallSpaceMB) }
  if ($ProxyAddress) { Show-Message 'proxy' @(Hide-ProxyUser $ProxyAddress) }
  foreach ($site in @('https://github.com', 'https://api.github.com', 'https://registry.npmjs.org', 'https://nodejs.org')) {
    if (-not (Test-Reachable $site)) { Exit-Install $ExitNetwork 'no_net' @($site) }
  }
  Show-Message 'net_ok'
  $running = Get-RunningApp
  if ($running) { Exit-Install $ExitRunning 'running' @($running.Path) }

  # --------------------------------------------------------------------------------------------------------------
  # Step 2: the source, into a private build folder.
  Show-Step 's_source'
  Use-Phase $ExitDownload 'unexpected'
  $SourceDir = Join-Path $WorkDir 'src'
  $Tag = ''
  $SourceLabel = ''
  if (-not $DryRun) {
    Invoke-Removal $WorkDir
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
  }
  if ($Source) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source 'package.json'))) { Exit-Install $ExitUsage 'not_ours' @("-Source $Source has no package.json") }
    $Source = (Resolve-Path -LiteralPath $Source).ProviderPath
    $SourceLabel = "folder $Source"
    Show-Message 'source_from' @($SourceLabel)
    # A copy without what a checkout may hold from earlier builds, so the build starts clean.
    Invoke-Action 'copy the source folder' {
      $output = & robocopy.exe $Source $SourceDir /E /XD node_modules out dist .git /NFL /NDL /NJH /NJS /NP /R:2 /W:2
      $output | Add-Content -LiteralPath $LogPath -Encoding UTF8
      # robocopy: 0 to 7 mean success (files copied or nothing to copy), 8 and above a failure.
      if ($LASTEXITCODE -ge 8) { throw "robocopy exited with $LASTEXITCODE" }
    } ('robocopy "{0}" "{1}" /E /XD node_modules out dist .git' -f $Source, $SourceDir)
    $CheckDir = $Source
  } else {
    if ($Main) {
      $Ref = 'heads/main'
      $Tag = 'main'
    } elseif ($Version) {
      $Tag = $Version
      if (-not $Tag.StartsWith('v')) { $Tag = "v$Tag" }
      $Ref = "tags/$Tag"
    } else {
      try {
        $options = Get-WebOption "https://api.github.com/repos/$Repository/releases/latest"
        Add-LogLine "GET $($options['Uri'])"
        $release = Invoke-RestMethod @options
        if ($release.PSObject.Properties['tag_name']) { $Tag = [string]$release.tag_name }
      } catch {
        Add-LogLine "  the API named no latest release: $($_.Exception.Message)"
      }
      if (-not $Tag) { $Tag = Get-LatestTagFromPage }
      if ($Tag -notmatch '^v\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$') { Exit-Install $ExitDownload 'no_latest' }
      Show-Message 'latest' @($Tag)
      $Ref = "tags/$Tag"
    }
    $ArchiveUrl = "https://codeload.github.com/$Repository/zip/refs/$Ref"
    $SourceLabel = "$Repository $Tag"
    Show-Message 'source_from' @($ArchiveUrl)
    $Archive = Join-Path $WorkDir 'source.zip'
    $Unpacked = Join-Path $WorkDir 'unpacked'
    Invoke-Action 'download the source archive' {
      try { Get-Remote $ArchiveUrl $Archive } catch { Exit-Install $ExitDownload 'download_failed' @($ArchiveUrl, $LogPath) }
      Add-LogLine ("source archive sha256 {0} bytes {1}" -f (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash, (Get-Item -LiteralPath $Archive).Length)
    } $ArchiveUrl
    Invoke-Action 'unpack it' {
      Expand-Zip $Archive $Unpacked
      $top = @(Get-ChildItem -LiteralPath $Unpacked)
      # GitHub names the archive's one top folder after the repository: a first check that this is the project.
      $expected = ($Repository -split '/')[1] + '-'
      if ($top.Count -ne 1 -or -not $top[0].Name.StartsWith($expected)) { Exit-Install $ExitDownload 'not_ours' @("top folder $(($top | ForEach-Object Name) -join ', ')") }
      Move-Item -LiteralPath $top[0].FullName -Destination $SourceDir
      Remove-Item -LiteralPath $Archive, $Unpacked -Recurse -Force
    } $Archive
    $CheckDir = $SourceDir
  }

  # The project it must be: its package names, and (for a tag) the version the tag names.
  $NodeMajor = 22
  if (-not $DryRun -or $Source) {
    $package = Get-Content -LiteralPath (Join-Path $CheckDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $PackageVersion = [string]$package.version
    Add-LogLine ("package name={0} productName={1} version={2}" -f $package.name, $package.productName, $PackageVersion)
    if ($package.name -ne $AppId -or $package.productName -ne $DisplayName) { Exit-Install $ExitDownload 'not_ours' @("package.json name=$($package.name)") }
    if ($Tag -and $Tag -ne 'main' -and "v$PackageVersion" -ne $Tag) { Exit-Install $ExitDownload 'not_ours' @("tag $Tag, package version $PackageVersion") }
    if (-not (Test-Path -LiteralPath (Join-Path $CheckDir 'scripts\install\install-windows.ps1'))) {
      $named = $Tag
      if (-not $named) { $named = $PackageVersion }
      Exit-Install $ExitUnsupportedVersion 'too_old_version' @($named)
    }
    $nvmrc = Join-Path $CheckDir '.nvmrc'
    if (Test-Path -LiteralPath $nvmrc) { $NodeMajor = Get-Major ((Get-Content -LiteralPath $nvmrc -Raw).Trim()) }
    elseif ($package.PSObject.Properties['engines'] -and $package.engines.node -match '>=\s*(\d+)') { $NodeMajor = [int]$Matches[1] }
  } else {
    $PackageVersion = $Tag.TrimStart('v')
    Add-LogLine 'dry run: the Node.js version comes from the downloaded .nvmrc; 22 is assumed for the plan'
  }
  if ($NodeMajor -lt 1) { Exit-Install $ExitDownload 'not_ours' @('no .nvmrc and no engines.node') }
  Add-LogLine "node major required: $NodeMajor"

  # --------------------------------------------------------------------------------------------------------------
  # Step 3: Node.js of the required major version: one already here, else a private copy (or, with -SystemNode,
  # winget for the whole computer). Git is not needed: the source comes as a zip, and every package npm installs
  # comes from the npm registry (tests/unit/installScripts.test.ts keeps it so).
  Show-Step 's_tools'
  Use-Phase $ExitPrerequisite 'declined'
  $PrivateNodeDir = Join-Path $BuildDir 'node'
  $NodeExe = ''
  $candidates = @()
  $onPath = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($onPath) { $candidates += $onPath.Source }
  $candidates += (Join-Path $PrivateNodeDir 'node.exe')
  if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'nodejs\node.exe') }
  foreach ($root in @($env:NVM_HOME, $env:FNM_DIR, (Join-Path $RoamingAppData 'fnm'))) {
    if ($root -and (Test-Path -LiteralPath $root)) {
      $candidates += @(Get-ChildItem -Path (Join-Path $root "v$NodeMajor.*") -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'node.exe' })
      $candidates += @(Get-ChildItem -Path (Join-Path $root "node-versions\v$NodeMajor.*") -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'installation\node.exe' })
    }
  }
  foreach ($candidate in $candidates) {
    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) { continue }
    if ($PrivateNode -and $candidate -ne (Join-Path $PrivateNodeDir 'node.exe')) { continue }
    $found = ''
    try { $found = (& $candidate --version) 2>$null } catch { $found = '' }
    Add-LogLine "node candidate $candidate $found"
    if ((Get-Major $found) -eq $NodeMajor) { $NodeExe = $candidate; break }
  }
  if ($NodeExe) {
    Show-Message 'node_found' @((& $NodeExe --version), $NodeExe)
  } else {
    if ($onPath) {
      $other = (& $onPath.Source --version)
      if ((Get-Major $other) -ne $NodeMajor) { Show-Message 'node_other' @($other, $NodeMajor) }
    }
    $NodeDist = "https://nodejs.org/dist/latest-v$NodeMajor.x"
    $Sums = Join-Path $BuildDir 'SHASUMS256.txt'
    # A file from nodejs.org, kept only when its SHA-256 matches the project's SHASUMS256.txt.
    $getVerified = {
      param([string]$Pattern)
      $line = @(Get-Content -LiteralPath $Sums | Where-Object { $_ -match "^[0-9a-f]{64}\s+($Pattern)$" } | Select-Object -First 1)
      if ($line.Count -eq 0) { Exit-Install $ExitDownload 'download_failed' @("$NodeDist/$Pattern", $LogPath) }
      $parts = $line[0] -split '\s+'
      $name = $parts[1]
      $file = Join-Path $BuildDir $name
      try { Get-Remote "$NodeDist/$name" $file } catch { Exit-Install $ExitDownload 'download_failed' @("$NodeDist/$name", $LogPath) }
      $got = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
      Add-LogLine "sha256 $name want=$($parts[0]) got=$got"
      if ($got -ne $parts[0]) { Remove-Item -LiteralPath $file -Force; Exit-Install $ExitDownload 'checksum_bad' @($name) }
      Show-Message 'checksum_ok' @($name)
      return $file
    }
    if ($SystemNode) {
      if (-not (Confirm-Choice 'ask_node' @($NodeMajor))) { Exit-Install $ExitPrerequisite 'declined' @("Node.js $NodeMajor") }
      $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
      if ($winget) {
        Invoke-Program "install Node.js $NodeMajor with winget" $winget.Source @('install', '--id', "OpenJS.NodeJS.$NodeMajor", '--exact', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
      } else {
        # Without winget: the official installer, checked against nodejs.org's checksum and its Authenticode signature.
        Invoke-Action "download the Node.js $NodeMajor installer and check it" {
          New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
          try { Get-Remote "$NodeDist/SHASUMS256.txt" $Sums } catch { Exit-Install $ExitDownload 'download_failed' @("$NodeDist/SHASUMS256.txt", $LogPath) }
          $script:NodeMsi = & $getVerified 'node-v[0-9.]+-x64\.msi'
          $signature = Get-AuthenticodeSignature -LiteralPath $script:NodeMsi
          Add-LogLine "msi signature: $($signature.Status) $($signature.SignerCertificate.Subject)"
          if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'OpenJS Foundation|Node\.js Foundation') {
            Remove-Item -LiteralPath $script:NodeMsi -Force
            Exit-Install $ExitDownload 'signature_bad'
          }
        } "$NodeDist/node-v$NodeMajor.x-x64.msi"
        if (-not $DryRun) { Invoke-Program "install Node.js $NodeMajor" 'msiexec.exe' @('/i', $script:NodeMsi, '/passive', '/norestart') }
      }
      $NodeExe = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    } else {
      Show-Message 'node_private' @($NodeMajor)
      Invoke-Action "download Node.js $NodeMajor for x64, check its checksum and unpack it into the build folder" {
        New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
        try { Get-Remote "$NodeDist/SHASUMS256.txt" $Sums } catch { Exit-Install $ExitDownload 'download_failed' @("$NodeDist/SHASUMS256.txt", $LogPath) }
        $zip = & $getVerified 'node-v[0-9.]+-win-x64\.zip'
        Invoke-Removal $PrivateNodeDir
        $unpackTo = Join-Path $BuildDir 'node-unpack'
        Invoke-Removal $unpackTo
        Expand-Zip $zip $unpackTo
        Move-Item -LiteralPath (@(Get-ChildItem -LiteralPath $unpackTo -Directory)[0].FullName) -Destination $PrivateNodeDir
        Remove-Item -LiteralPath $unpackTo, $zip -Recurse -Force
      } "$NodeDist/node-v$NodeMajor.x-win-x64.zip"
      $NodeExe = Join-Path $PrivateNodeDir 'node.exe'
    }
    if (-not $DryRun -and (Test-Path -LiteralPath $Sums)) { Remove-Item -LiteralPath $Sums -Force }
  }
  $NodeDir = Split-Path -Parent $NodeExe
  $NpmCli = Join-Path $NodeDir 'node_modules\npm\bin\npm-cli.js'
  $NpxCli = Join-Path $NodeDir 'node_modules\npm\bin\npx-cli.js'
  Add-LogLine "node for the build: $NodeExe"

  # --------------------------------------------------------------------------------------------------------------
  # Step 4: npm ci, the build, the native module, and the app folder made by Electron Forge.
  Show-Step 's_build'
  Use-Phase $ExitBuild 'build_failed'
  # This process only: the build's own programs find this Node.js first; nothing is written to the user's settings.
  $env:PATH = "$NodeDir;$env:PATH"
  $env:npm_config_fund = 'false'
  $env:npm_config_audit = 'false'
  $env:npm_config_update_notifier = 'false'
  # Electron's download (@electron/get) uses the proxy only when asked to.
  if ($ProxyAddress) { $env:ELECTRON_GET_USE_PROXY = '1'; $env:GLOBAL_AGENT_HTTPS_PROXY = $ProxyAddress }
  Invoke-Program 'npm ci' $NodeExe @($NpmCli, 'ci') $SourceDir
  Invoke-Program 'npm run build' $NodeExe @($NpmCli, 'run', 'build') $SourceDir
  $Prebuild = Join-Path $SourceDir 'node_modules\better-sqlite3\prebuilds\win32-x64.node'
  if ($DryRun -or (Test-Path -LiteralPath $Prebuild)) {
    Show-Message 'prebuilt_ok' @('win32-x64')
  } else {
    # Not expected on x64 Windows (better-sqlite3 ships win32-x64); kept so a future version without a ready module
    # still builds. Not tried on a runner.
    Show-Message 'needs_compile' @('win32-x64')
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    $haveCompiler = (Test-Path -LiteralPath $vswhere) -and [bool](& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
    $havePython = [bool](Get-Command python.exe -ErrorAction SilentlyContinue) -or [bool](Get-Command py.exe -ErrorAction SilentlyContinue)
    if (-not ($haveCompiler -and $havePython)) {
      Use-Phase $ExitPrerequisite 'declined'
      $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
      if (-not $winget) { Exit-Install $ExitPrerequisite 'no_winget' @('Visual Studio Build Tools') }
      if (-not (Confirm-Choice 'ask_build_tools')) { Exit-Install $ExitPrerequisite 'declined' @('Visual Studio Build Tools') }
      if (-not $haveCompiler) {
        Invoke-Program 'install the Visual Studio C++ build tools' $winget.Source @('install', '--id', 'Microsoft.VisualStudio.2022.BuildTools', '--exact', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements', '--override', '--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended')
      }
      if (-not $havePython) {
        Invoke-Program 'install Python' $winget.Source @('install', '--id', 'Python.Python.3.12', '--exact', '--source', 'winget', '--scope', 'user', '--accept-package-agreements', '--accept-source-agreements')
      }
      Use-Phase $ExitBuild 'build_failed'
    }
    Invoke-Program 'compile the database module for Electron' $NodeExe @($NpxCli, '--no-install', 'electron-rebuild', '--force', '--only', 'better-sqlite3', '--arch', 'x64') $SourceDir
    Invoke-Action 'put the compiled module where the package expects it' { Copy-Item -LiteralPath (Join-Path $SourceDir 'node_modules\better-sqlite3\build\Release\better_sqlite3.node') -Destination $Prebuild -Force }
  }
  Invoke-Program 'package the app with Electron Forge' $NodeExe @($NpxCli, '--no-install', 'electron-forge', 'package', '--platform', 'win32', '--arch', 'x64') $SourceDir
  $BuiltApp = Join-Path (Join-Path $SourceDir 'out') "$DisplayName-win32-x64"
  if (-not $DryRun -and -not (Test-Path -LiteralPath (Join-Path $BuiltApp "$AppId.exe"))) { Exit-Install $ExitBuild 'build_failed' @("no app at $BuiltApp", $LogPath) }

  # --------------------------------------------------------------------------------------------------------------
  # Step 5: install. A new copy is prepared beside the old one, then swapped in, so a failure leaves the old version
  # as it was. The data folder is elsewhere and never touched here.
  Show-Step 's_install'
  Use-Phase $ExitInstall 'install_failed'
  Show-Message 'installing_to' @($InstallDir)
  $OldVersion = ''
  if (Test-Path -LiteralPath $AppExe) {
    $OldVersion = (Get-Item -LiteralPath $AppExe).VersionInfo.ProductVersion
    if (-not $OldVersion) { $OldVersion = '?' }
    Show-Message 'upgrade' @($OldVersion, $PackageVersion)
  }
  $Staged = "$InstallDir.new"
  $Previous = "$InstallDir.old"
  Invoke-Action 'copy the app beside the installed one' {
    Invoke-Removal $Staged
    New-Item -ItemType Directory -Path (Split-Path -Parent $InstallDir) -Force | Out-Null
    Copy-Item -LiteralPath $BuiltApp -Destination $Staged -Recurse -Force
    # The installer stays with the app: the Installed apps entry runs it to remove the app.
    if ($PSCommandPath) { Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $Staged 'install-windows.ps1') -Force }
  } $Staged
  Invoke-Action 'swap the new app in' {
    Invoke-Removal $Previous
    if (Test-Path -LiteralPath $InstallDir) { Rename-Item -LiteralPath $InstallDir -NewName (Split-Path -Leaf $Previous) }
    Rename-Item -LiteralPath $Staged -NewName (Split-Path -Leaf $InstallDir)
    Invoke-Removal $Previous
  } $InstallDir
  Invoke-Action 'Start menu shortcut' {
    $shell = New-Object -ComObject WScript.Shell
    $links = @($StartMenuLink)
    if ($DesktopShortcut) { $links += $DesktopLink }
    foreach ($link in $links) {
      New-Item -ItemType Directory -Path (Split-Path -Parent $link) -Force | Out-Null
      $shortcut = $shell.CreateShortcut($link)
      $shortcut.TargetPath = $AppExe
      $shortcut.WorkingDirectory = $InstallDir
      $shortcut.IconLocation = "$AppExe,0"
      $shortcut.Description = $DisplayName
      $shortcut.Save()
      Add-LogLine "  shortcut $link"
    }
  } $StartMenuLink
  # The Installed apps entry (per user, HKCU): its Uninstall button runs this script's copy with -Uninstall.
  Invoke-Action 'the entry in Settings > Apps > Installed apps' {
    $hostExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $command = '"{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}" -Uninstall' -f $hostExe, $KeptScript
    $sizeKB = [int]((Get-ChildItem -LiteralPath $InstallDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1KB)
    New-Item -Path $UninstallKey -Force | Out-Null
    $values = @{
      DisplayName = $DisplayName; DisplayVersion = $PackageVersion; Publisher = "$DisplayName (built from source)"
      InstallLocation = $InstallDir; DisplayIcon = "$AppExe,0"; UninstallString = $command
      QuietUninstallString = "$command -Yes"; InstallDate = (Get-Date -Format 'yyyyMMdd')
      URLInfoAbout = "https://github.com/$Repository"
    }
    foreach ($name in $values.Keys) { New-ItemProperty -Path $UninstallKey -Name $name -Value $values[$name] -PropertyType String -Force | Out-Null }
    foreach ($name in @('NoModify', 'NoRepair')) { New-ItemProperty -Path $UninstallKey -Name $name -Value 1 -PropertyType DWord -Force | Out-Null }
    New-ItemProperty -Path $UninstallKey -Name 'EstimatedSize' -Value $sizeKB -PropertyType DWord -Force | Out-Null
  } $UninstallKey

  # --------------------------------------------------------------------------------------------------------------
  # Step 6: the installed app answers and opens, as the Linux package checks require (scripts/smoke-installed-app.js).
  Show-Step 's_verify'
  Use-Phase $ExitVerify 'verify_failed'
  if (-not $DryRun) {
    # Read through a pipe: a window app started from a console has no output of its own to print to.
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $AppExe
    $info.Arguments = '--version'
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.CreateNoWindow = $true
    $process = [System.Diagnostics.Process]::Start($info)
    $printed = $process.StandardOutput.ReadToEnd().Trim()
    $errors = $process.StandardError.ReadToEnd().Trim()
    if (-not $process.WaitForExit(60000)) { $process.Kill(); $printed = '(no answer within 60 s)' }
    Add-LogLine "--version printed: $printed"
    if ($errors) { Add-LogLine "--version errors: $errors" }
    if ($printed -ne "$DisplayName $PackageVersion") { Exit-Install $ExitVerify 'verify_failed' @("--version: $printed", $LogPath) }
  }
  Invoke-Program 'start the app once with a throw-away profile and check its window' $NodeExe @((Join-Path $SourceDir 'scripts\smoke-installed-app.js'), '--app', $AppExe, '--expect-version', $PackageVersion) $SourceDir

  if (-not $KeepBuild) { Invoke-Action 'remove the build folder' { Invoke-Removal $WorkDir } $WorkDir }

  if ($DryRun) { Show-Message 'dry_finished' @($PackageVersion) } else { Show-Message 'finished' @($PackageVersion) }
  Show-Message 'where' @($InstallDir)
  Show-Message 'data' @($DataDir)
  $desktopNote = ''
  if ($DesktopShortcut) { $desktopNote = Get-Text 'how_start_desktop' }
  Show-Message 'how_start' @($desktopNote)
  Show-Message 'how_remove' @("powershell -NoProfile -ExecutionPolicy Bypass -File `"$KeptScript`" -Uninstall")
  Show-Message 'log_at' @($LogPath)
  Add-LogLine "EXIT $ExitOk"
  exit $ExitOk
} catch {
  # A command failed (or threw) without Exit-Install: say which phase failed and leave with that phase's code.
  Add-LogLine ("FAILED during: {0}" -f $script:CurrentAction)
  Add-LogLine ($_ | Out-String)
  Add-LogLine $_.ScriptStackTrace
  Write-Host '--- last lines of the log ---'
  Get-Content -LiteralPath $LogPath -Tail 25 | ForEach-Object { Write-Host $_ }
  if ($script:FailKey -in @('build_failed', 'install_failed', 'verify_failed')) {
    Exit-Install $script:FailCode $script:FailKey @($script:CurrentAction, $LogPath)
  }
  Exit-Install $script:FailCode $script:FailKey @($LogPath)
}
