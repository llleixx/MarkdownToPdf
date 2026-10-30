<#
.SYNOPSIS
Export Markdown using an installed Chromium browser or Firefox.
.PARAMETER Browser
Executable path, or firefox/chrome/msedge. If omitted, prefer Edge/Chrome,
then Firefox. Each export uses an isolated temporary browser profile.
.EXAMPLE
.\export.ps1 -InputFile .\notes.md -Browser firefox
#>
param([Parameter(Mandatory=$true)][string]$InputFile,[string]$OutputFile,[string]$Browser,[ValidateSet('original','github','night','newsprint','pixyll','whitey')][string]$Theme='github',[string]$CssFile)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
$InputFile=(Resolve-Path -LiteralPath $InputFile).Path
if(!$OutputFile){$OutputFile=[IO.Path]::ChangeExtension($InputFile,'.pdf')}
$OutputFile=$ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputFile)
if($OutputFile -eq $InputFile){throw 'OutputFile must differ from InputFile.'}
if([IO.Directory]::Exists($OutputFile)){throw "OutputFile is a directory: $OutputFile"}
$outputDirectory=[IO.Path]::GetDirectoryName($OutputFile)
try{
 [IO.Directory]::CreateDirectory($outputDirectory)|Out-Null
 # Check write access before starting the browser; the probe deletes on close.
 $probePath=Join-Path $outputDirectory ('.mdpdf-check-'+[Guid]::NewGuid().ToString('N')+'.tmp')
 $probe=[IO.FileStream]::new($probePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None,1,[IO.FileOptions]::DeleteOnClose)
 $probe.Dispose()
}catch{throw "Cannot prepare output directory '$outputDirectory': $($_.Exception.Message)"}
# Preserve the existing Chromium preference, with Firefox as an automatic fallback.
$knownBrowsers=@("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Google\Chrome\Application\chrome.exe","$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe","$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Mozilla Firefox\firefox.exe","${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe","$env:LOCALAPPDATA\Mozilla Firefox\firefox.exe")
if(!$Browser){$Browser=$knownBrowsers|Where-Object{Test-Path -LiteralPath $_}|Select-Object -First 1}
elseif($Browser -in @('firefox','chrome','msedge')) {
 $browserName=$Browser+'.exe'
 $Browser=$knownBrowsers|Where-Object{[IO.Path]::GetFileName($_) -eq $browserName -and (Test-Path -LiteralPath $_)}|Select-Object -First 1
 if(!$Browser){$Browser=(Get-Command $browserName -ErrorAction SilentlyContinue).Source}
}
if(!$Browser){throw 'Edge/Chrome/Firefox not found; supply -Browser with its executable path.'}
$Browser=(Resolve-Path -LiteralPath $Browser).Path
$engine=if([IO.Path]::GetFileName($Browser) -match 'firefox' -or [Diagnostics.FileVersionInfo]::GetVersionInfo($Browser).ProductName -match 'Firefox'){'firefox'}else{'chromium'}
. "$PSScriptRoot\tools\browser-common.ps1"
. "$PSScriptRoot\tools\browser-$engine.ps1"
$tmp=Join-Path ([IO.Path]::GetTempPath()) ('mdpdf-'+[Guid]::NewGuid().ToString('N'));New-Item -ItemType Directory $tmp|Out-Null
$session=@{Browser=$Browser;Profile=(Join-Path $tmp 'profile');Sequence=0}
$pendingPdf=$null
function FileUri([string]$p){return ([Uri]::new($p)).AbsoluteUri}
try{
 $base=FileUri ([IO.Path]::GetDirectoryName($InputFile)+'\')
 $source=[IO.File]::ReadAllText($InputFile)
 # JSON escapes prevent a Markdown closing-script tag from escaping its data container.
 $sourceJson=ConvertTo-Json -InputObject $source -Compress
 $sourceJson=$sourceJson.Replace('<','\u003c').Replace('>','\u003e').Replace('&','\u0026')
 $vendor=Join-Path $PSScriptRoot 'vendor'
 $katexc=FileUri "$vendor\katex\dist\katex.min.css";$katexj=FileUri "$vendor\katex\dist\katex.min.js";$mdj=FileUri "$vendor\markdown-it.min.js";$render=FileUri "$PSScriptRoot\render.js";$extensions=FileUri "$vendor\markdown-extensions\extensions.min.js"
 $purifyj=FileUri "$vendor\dompurify\purify.min.js"
 $mermaidj=FileUri "$vendor\mermaid\mermaid.min.js"
 $texmathj=FileUri "$vendor\markdown-it-texmath\texmath.js"
 if($Theme -eq 'original'){$Theme='github'} # Backward-compatible alias
 $themePath=Join-Path $PSScriptRoot "themes\$Theme.css"
 if(!(Test-Path -LiteralPath $themePath)){throw "Missing theme: $themePath"}
 $themeLinks='<link rel="stylesheet" href="'+(FileUri $themePath)+'">'
 $themeLinks+='<link rel="stylesheet" href="'+(FileUri "$PSScriptRoot\themes\print-common.css")+'">'
 if($CssFile){
  $CssFile=(Resolve-Path -LiteralPath $CssFile).Path
  if([IO.Path]::GetExtension($CssFile) -ne '.css'){throw 'CssFile must be a CSS file'}
  $themeLinks+='<link rel="stylesheet" href="'+(FileUri $CssFile)+'">'
 }
 $html=@"
<!doctype html><html><head><meta charset="utf-8"><base href="$base"><link rel="stylesheet" href="$katexc">$themeLinks</head><body class="typora-export"><main id="write"></main><script id="source" type="application/json"></script><script>document.getElementById('source').textContent=$sourceJson;</script><script src="$mdj"></script><script src="$katexj"></script><script src="$texmathj"></script><script src="$extensions"></script><script src="$mermaidj"></script><script src="$purifyj"></script><script src="$render"></script><script>window.renderDone=renderMarkdown(document.getElementById('write'),document.getElementById('source').textContent);</script></body></html>
"@
 $htmlPath=Join-Path $tmp 'document.html';[IO.File]::WriteAllText($htmlPath,$html,[Text.UTF8Encoding]::new($false))
 Start-ExportBrowser $session
 Open-ExportPage $session (FileUri $htmlPath)
 $deadline=[DateTime]::UtcNow.AddSeconds(30)
 do {
  $ready=Evaluate-ExportPage $session "typeof window.renderDone !== 'undefined'"
  if($ready){break}
  if([DateTime]::UtcNow -gt $deadline){throw 'Renderer did not initialize'}
  Start-Sleep -Milliseconds 100
 } while($true)
 $result=(Evaluate-ExportPage $session 'window.renderDone.then(result => JSON.stringify(result))')|ConvertFrom-Json
 if(!$result.ok){throw ('Rendering failed: '+$result.error)}
 $pdf=Print-ExportPage $session
 # Finish writing beside the destination before replacing an existing PDF.
 $pendingPdf=Join-Path ([IO.Path]::GetDirectoryName($OutputFile)) ('.mdpdf-'+[Guid]::NewGuid().ToString('N')+'.tmp')
 [IO.File]::WriteAllBytes($pendingPdf,[Convert]::FromBase64String($pdf))
 if([IO.File]::Exists($OutputFile)){[IO.File]::Replace($pendingPdf,$OutputFile,[NullString]::Value)}else{[IO.File]::Move($pendingPdf,$OutputFile)}
 Write-Output "Exported: $OutputFile"
 Write-Output ($result|ConvertTo-Json -Compress)
}finally{
 if($pendingPdf -and [IO.File]::Exists($pendingPdf)){Remove-Item -LiteralPath $pendingPdf -Force -ErrorAction SilentlyContinue}
 if($session.Socket -and $session.Socket.State -eq [Net.WebSockets.WebSocketState]::Open){try{Close-ExportBrowser $session}catch{}}
 Stop-BrowserProcess $session
 # Validate the generated directory before recursive cleanup.
 $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
 $resolvedTmp=[IO.Path]::GetFullPath($tmp)
 if($resolvedTmp.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and ([IO.Path]::GetFileName($resolvedTmp) -match '^mdpdf-[0-9a-f]{32}$') -and (Test-Path -LiteralPath $resolvedTmp)){Remove-Item -LiteralPath $resolvedTmp -Recurse -Force -ErrorAction SilentlyContinue}
}
