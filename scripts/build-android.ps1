param([ValidateSet('apk','aab')][string]$Format = 'apk')
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$bundledJava = 'C:\Program Files\Android\Android Studio\jbr'
$cachedJava17 = Get-ChildItem (Join-Path $env:USERPROFILE '.gradle\jdks') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '-17-' -and (Test-Path (Join-Path $_.FullName 'bin\java.exe')) } | Select-Object -First 1
if (-not $env:JAVA_HOME -and $cachedJava17) { $env:JAVA_HOME = $cachedJava17.FullName }
if (-not $env:JAVA_HOME -and (Test-Path "$bundledJava\bin\java.exe")) { $env:JAVA_HOME = $bundledJava }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw 'Configura JAVA_HOME con un JDK compatible.' }
if (-not (Test-Path $env:ANDROID_HOME)) { throw 'Configura ANDROID_HOME con la ubicacion del SDK Android.' }
$env:NODE_ENV = 'production'
Push-Location (Join-Path $projectDirectory 'android')
try {
  $buildTask = if ($Format -eq 'apk') { 'assembleRelease' } else { 'bundleRelease' }
  $localGradle = Join-Path $projectDirectory '.tools\gradle-9.3.1\bin\gradle.bat'
  $gradle = if (Test-Path $localGradle) { $localGradle } else { '.\gradlew.bat' }
  & $gradle $buildTask --console=plain '-PreactNativeArchitectures=arm64-v8a,x86_64'
  if ($LASTEXITCODE -ne 0) { throw "Fallo Gradle ($LASTEXITCODE)." }
  $source = if ($Format -eq 'apk') { 'app\build\outputs\apk\release\app-release.apk' } else { 'app\build\outputs\bundle\release\app-release.aab' }
  $outputDirectory = Join-Path $projectDirectory 'artifacts'
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  $outputFile = Join-Path $outputDirectory "guia-medica-monagas-pruebas.$Format"
  Copy-Item -LiteralPath $source -Destination $outputFile
  Write-Output "Archivo generado: $outputFile"
  Write-Output 'Firma de desarrollo: para Google Play configura una clave de publicacion propia o EAS Build.'
} finally { Pop-Location }
