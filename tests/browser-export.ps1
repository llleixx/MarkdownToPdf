# Integration smoke test for either driver. Supply an installed browser executable.
# Example: powershell -File tests/browser-export.ps1 -Browser 'C:\Program Files\Mozilla Firefox\firefox.exe'
param([Parameter(Mandatory=$true)][string]$Browser)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$outputDirectory=Join-Path ([IO.Path]::GetTempPath()) ('mdpdf-test-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($outputDirectory)|Out-Null
$runner=(Get-Process -Id $PID).Path
foreach($case in @(
 @{Name='html';Images=1;Formulas=2;Diagrams=0},
 @{Name='math';Images=0;Formulas=10;Diagrams=0},
 @{Name='extensions';Images=0;Formulas=3;Diagrams=0},
 @{Name='diagrams';Images=0;Formulas=1;Diagrams=2}
)) {
 $output=Join-Path $outputDirectory ($case.Name+'.pdf')
 $lines=& $runner -NoProfile -File "$root\export.ps1" -InputFile "$PSScriptRoot\$($case.Name).md" -OutputFile $output -Browser $Browser
 if($LASTEXITCODE){throw "Export failed: $($case.Name)"}
 $result=$lines[-1]|ConvertFrom-Json
 if(!$result.ok -or $result.images -ne $case.Images -or $result.formulas -ne $case.Formulas -or $result.diagrams -ne $case.Diagrams){throw "Unexpected rendering result: $($case.Name)"}
 $bytes=[IO.File]::ReadAllBytes($output)
 if($bytes.Length -lt 1000 -or [Text.Encoding]::ASCII.GetString($bytes,0,5) -ne '%PDF-'){throw "Invalid PDF: $output"}
}
Write-Output "Browser export tests passed. PDFs: $outputDirectory"
