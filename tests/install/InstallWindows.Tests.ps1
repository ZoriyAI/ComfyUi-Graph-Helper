# Pester tests of scripts/install/install-windows.ps1, the Windows installer people run from a release. They run the
# script as a person would, in a fresh PowerShell process, and check what it says and what it leaves behind: wrong
# options stop with exit code 2, another system is refused with 3, and a dry run prints every step and changes
# nothing. On Linux and macOS the dry run uses -PretendWindows. Run by .github/workflows/install-scripts.yml:
#   Invoke-Pester -Path tests/install -Output Detailed
# OnWindowsAtDiscovery is read by -Skip below, where the analyzer does not see it.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseDeclaredVarsMoreThanAssignments', '', Justification = 'Read by -Skip at discovery')]
param()

# -Skip is decided while Pester discovers the tests, before BeforeAll runs, so the system is known here too.
BeforeDiscovery {
  $OnWindowsAtDiscovery = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
}

BeforeAll {
  $script:Installer = Join-Path $PSScriptRoot '..\..\scripts\install\install-windows.ps1'
  $script:Shell = (Get-Process -Id $PID).Path
  $script:OnWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

  # Runs the installer in its own process; returns the exit code and everything it printed.
  function Invoke-Installer {
    param([string[]]$Arguments, [hashtable]$Environment = @{})
    $saved = @{}
    foreach ($name in $Environment.Keys) {
      $saved[$name] = [System.Environment]::GetEnvironmentVariable($name)
      [System.Environment]::SetEnvironmentVariable($name, $Environment[$name])
    }
    try {
      $output = & $script:Shell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $script:Installer @Arguments 2>&1 | Out-String
      return @{ Code = $LASTEXITCODE; Output = $output }
    } finally {
      foreach ($name in $saved.Keys) { [System.Environment]::SetEnvironmentVariable($name, $saved[$name]) }
    }
  }
}

Describe 'install-windows.ps1' {
  It 'is saved as UTF-8 with a byte order mark, so Windows PowerShell 5.1 reads the Russian messages' {
    $bytes = [System.IO.File]::ReadAllBytes($script:Installer)
    $bytes[0..2] | Should -Be @(0xEF, 0xBB, 0xBF)
  }

  It 'parses without errors' {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($script:Installer, [ref]$tokens, [ref]$errors) | Out-Null
    $errors | Should -BeNullOrEmpty
  }

  It 'prints its options and the exit codes with -Help' {
    $result = Invoke-Installer @('-Help')
    $result.Code | Should -Be 0
    $result.Output | Should -Match '-Uninstall'
    $result.Output | Should -Match '13 this version cannot be installed'
  }

  It 'stops with exit code 2 on options that exclude each other' {
    $flags = @('-DryRun', '-Main', '-Version', 'v1.0.0')
    if (-not $script:OnWindows) { $flags += '-PretendWindows' }
    $result = Invoke-Installer $flags
    $result.Code | Should -Be 2
    $result.Output | Should -Match 'exclude each other'
  }

  It 'refuses another system with exit code 3' -Skip:$OnWindowsAtDiscovery {
    $result = Invoke-Installer @('-DryRun')
    $result.Code | Should -Be 3
    $result.Output | Should -Match 'This script is for Windows'
  }

  It 'speaks Russian with -Language ru' -Skip:$OnWindowsAtDiscovery {
    $result = Invoke-Installer @('-DryRun', '-Language', 'ru')
    $result.Output | Should -Match 'Этот скрипт для Windows'
  }

  It 'prints the whole plan in a dry run and changes nothing' {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ('nodewise dry ' + [guid]::NewGuid().ToString('N').Substring(0, 6) + ' wín')
    New-Item -ItemType Directory -Path $root | Out-Null
    $local = Join-Path $root 'AppData/Local'
    $roaming = Join-Path $root 'AppData/Roaming'
    try {
      $flags = @('-DryRun', '-Source', (Join-Path $PSScriptRoot '..\..'), '-BuildDir', (Join-Path $root 'build'))
      if (-not $script:OnWindows) { $flags += '-PretendWindows' }
      $result = Invoke-Installer $flags @{ LOCALAPPDATA = $local; APPDATA = $roaming; HOME = $root }
      $result.Code | Should -Be 0
      foreach ($step in 1..6) { $result.Output | Should -Match "Step $step of 6" }
      $result.Output | Should -Match 'DRY-RUN npm ci'
      $result.Output | Should -Match 'DRY-RUN package the app with Electron Forge'
      $result.Output | Should -Match 'DRY-RUN swap the new app in'
      $result.Output | Should -Match 'Dry run finished'
      (Join-Path $local 'Programs/NodeWise Studio') | Should -Not -Exist
      (Join-Path $root 'build') | Should -Not -Exist
    } finally {
      Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}
