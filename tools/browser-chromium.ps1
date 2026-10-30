function Start-ExportBrowser($Session) {
 $profile=$Session.Profile
 Start-BrowserProcess $Session "--headless=new --disable-gpu --no-first-run --no-default-browser-check --allow-file-access-from-files --remote-debugging-port=0 --user-data-dir=`"$profile`" about:blank"
 $portFile=Join-Path $profile 'DevToolsActivePort'
 Wait-BrowserFile $Session $portFile
 $port=[IO.File]::ReadAllLines($portFile)[0]
 $Session.Http=[Net.Http.HttpClient]::new();$Session.Http.Timeout=[TimeSpan]::FromSeconds(15)
 $targets=$Session.Http.GetStringAsync("http://127.0.0.1:$port/json/list").GetAwaiter().GetResult()|ConvertFrom-Json
 $target=$targets|Where-Object type -eq 'page'|Select-Object -First 1
 Connect-BrowserSocket $Session $target.webSocketDebuggerUrl
 Invoke-BrowserCommand $Session 'Page.enable' @{}|Out-Null
 Invoke-BrowserCommand $Session 'Emulation.setEmulatedMedia' @{media='print'}|Out-Null
}

function Open-ExportPage($Session, [string]$Url) {
 Invoke-BrowserCommand $Session 'Page.navigate' @{url=$Url}|Out-Null
}

function Evaluate-ExportPage($Session, [string]$Expression) {
 $reply=Invoke-BrowserCommand $Session 'Runtime.evaluate' @{expression=$Expression;awaitPromise=$true;returnByValue=$true}
 if($reply.exceptionDetails){throw ('Page script failed: '+($reply.exceptionDetails|ConvertTo-Json -Depth 10 -Compress))}
 return $reply.result.value
}

function Print-ExportPage($Session) {
 $reply=Invoke-BrowserCommand $Session 'Page.printToPDF' @{printBackground=$true;preferCSSPageSize=$true;displayHeaderFooter=$false;generateDocumentOutline=$true;generateTaggedPDF=$true}
 return $reply.data
}

function Close-ExportBrowser($Session) {
 Invoke-BrowserCommand $Session 'Browser.close' @{} 5000|Out-Null
}
