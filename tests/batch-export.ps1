# Integration tests; each invocation uses a child PowerShell process to verify exit codes.
param([string]$Browser='msedge')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('mdpdf-batch-test-'+[Guid]::NewGuid().ToString('N'))
$notes=Join-Path $scratch 'notes #100%'
$nested=Join-Path $notes 'sub'
[IO.Directory]::CreateDirectory($nested)|Out-Null
$utf8=[Text.UTF8Encoding]::new($false)
$top=Join-Path $notes 'top.md'
$child=Join-Path $nested 'top.md'
foreach($directory in @($notes,$nested)){
 [IO.File]::WriteAllText((Join-Path $directory 'top.md'),"# Notes`n`n![Local image](test.svg)",$utf8)
 Copy-Item -LiteralPath "$PSScriptRoot\test.svg" -Destination (Join-Path $directory 'test.svg')
}
[IO.File]::WriteAllText((Join-Path $notes 'ignored.txt'),'Not selected by folder input.',$utf8)
$harness=Join-Path $scratch 'invoke.ps1'
[IO.File]::WriteAllText($harness,@'
param([string]$ExportScript,[string]$ArgumentsFile)
$ErrorActionPreference='Stop'
$options=Import-Clixml -LiteralPath $ArgumentsFile
$global:LASTEXITCODE=0
& $ExportScript @options
exit $LASTEXITCODE
'@,$utf8)
$runner=(Get-Process -Id $PID).Path
$script:testNumber=0
function Invoke-Case([hashtable]$Options,[int]$ExpectedExit,[string]$Summary=''){
 $script:testNumber++
 $Options.Browser=$Browser
 $argumentsFile=Join-Path $scratch "arguments-$script:testNumber.xml"
 $log=Join-Path $scratch "case-$script:testNumber.log"
 $Options|Export-Clixml -LiteralPath $argumentsFile
 $ErrorActionPreference='Continue'
 & $runner -NoProfile -File $harness -ExportScript "$root\export.ps1" -ArgumentsFile $argumentsFile *> $log
 $code=$LASTEXITCODE
 $ErrorActionPreference='Stop'
 $text=Get-Content -LiteralPath $log -Raw
 if($code -ne $ExpectedExit -or ($Summary -and !$text.Contains($Summary))){throw "Case $script:testNumber failed (exit $code): $text"}
}
function Assert-Pdf([string]$Path){
 $bytes=[IO.File]::ReadAllBytes($Path)
 if($bytes.Length -lt 1000 -or [Text.Encoding]::ASCII.GetString($bytes,0,5) -ne '%PDF-'){throw "Invalid PDF: $Path"}
}

# Single-file compatibility, including the JSON result as the last output line.
$single=Join-Path $scratch 'single.pdf'
Invoke-Case @{InputFile=$top;OutputFile=$single} 0
Assert-Pdf $single
$singleLog=Get-Content -LiteralPath (Join-Path $scratch 'case-1.log')
if(!($singleLog[-1]|ConvertFrom-Json).ok){throw 'Single-file JSON output changed'}

# Multiple literal paths, de-duplication, and default output beside each source.
Invoke-Case @{InputFile=@($top,$top,$child);Theme='newsprint'} 0 '2 succeeded, 1 skipped, 0 failed'
Assert-Pdf ([IO.Path]::ChangeExtension($top,'.pdf'))
Assert-Pdf ([IO.Path]::ChangeExtension($child,'.pdf'))

# Folder depth, relative output structure, and local image resolution.
$shallow=Join-Path $scratch 'shallow'
Invoke-Case @{InputFile=$notes;OutputDirectory=$shallow} 0 '1 succeeded, 0 skipped, 0 failed'
Assert-Pdf (Join-Path $shallow 'top.pdf')
if(Test-Path -LiteralPath (Join-Path $shallow 'sub/top.pdf')){throw 'Unexpected recursion'}
$recursive=Join-Path $scratch 'recursive'
Invoke-Case @{InputFile=$notes;OutputDirectory=$recursive;Recurse=$true} 0 '2 succeeded, 0 skipped, 0 failed'
Assert-Pdf (Join-Path $recursive 'top.pdf')
Assert-Pdf (Join-Path $recursive 'sub/top.pdf')
$before=(Get-FileHash -LiteralPath (Join-Path $recursive 'top.pdf')).Hash
Invoke-Case @{InputFile=$notes;OutputDirectory=$recursive;Recurse=$true} 0 '0 succeeded, 2 skipped, 0 failed'
if((Get-FileHash -LiteralPath (Join-Path $recursive 'top.pdf')).Hash -ne $before){throw 'Skipped PDF was modified'}
Invoke-Case @{InputFile=$notes;OutputDirectory=$recursive;Recurse=$true;Overwrite=$true} 0 '2 succeeded, 0 skipped, 0 failed'
Invoke-Case @{InputFile=$top;OutputFile=$single} 1

# An invalid document must preserve old output and not prevent the next export.
$broken=Join-Path $scratch 'broken.md'
[IO.File]::WriteAllText($broken,'$\definitelyInvalidCommand$',$utf8)
$partial=Join-Path $scratch 'partial'
[IO.Directory]::CreateDirectory($partial)|Out-Null
$old=Join-Path $partial 'broken.pdf'
[IO.File]::WriteAllText($old,'PREVIOUS_PDF',$utf8)
Invoke-Case @{InputFile=@($broken,$top);OutputDirectory=$partial;Overwrite=$true} 1 '1 succeeded, 0 skipped, 1 failed'
Assert-Pdf (Join-Path $partial 'top.pdf')
if([IO.File]::ReadAllText($old) -ne 'PREVIOUS_PDF'){throw 'Failed rendering replaced the previous PDF'}
Invoke-Case @{InputFile=@((Join-Path $scratch 'missing.md'),$top);OutputDirectory=(Join-Path $scratch 'missing')} 1 '1 succeeded, 0 skipped, 1 failed'

# Plan all destinations before writing; -Overwrite never resolves batch collisions.
$collision=Join-Path $scratch 'collision'
Invoke-Case @{InputFile=@($top,$child);OutputDirectory=$collision;Overwrite=$true} 1 '0 succeeded, 0 skipped, 2 failed'
if(Test-Path -LiteralPath (Join-Path $collision 'top.pdf')){throw 'Conflicting output was written'}
Invoke-Case @{InputFile=$notes;OutputFile=(Join-Path $scratch 'invalid.pdf')} 1
Invoke-Case @{InputFile=@($top,$child);OutputFile=(Join-Path $scratch 'invalid.pdf')} 1
Invoke-Case @{InputFile=$top;OutputFile=$single;OutputDirectory=$recursive} 1
$empty=Join-Path $scratch 'empty'
[IO.Directory]::CreateDirectory($empty)|Out-Null
Invoke-Case @{InputFile=$empty;Recurse=$true} 0 '0 succeeded, 1 skipped, 0 failed'
Write-Output "Batch export tests passed ($script:testNumber cases). Outputs: $scratch"
