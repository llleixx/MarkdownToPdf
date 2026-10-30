# Shared process and JSON-over-WebSocket transport. Drivers implement only browser operations.
function Start-BrowserProcess($Session, [string]$Arguments) {
 $psi=[Diagnostics.ProcessStartInfo]::new()
 $psi.FileName=$Session.Browser;$psi.Arguments=$Arguments
 $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardError=$true;$psi.RedirectStandardOutput=$true
 $psi.EnvironmentVariables.Remove('__COMPAT_LAYER')
 $Session.Process=[Diagnostics.Process]::Start($psi)
 $Session.Stderr=$Session.Process.StandardError.ReadToEndAsync()
 $Session.Stdout=$Session.Process.StandardOutput.ReadToEndAsync()
}

function Wait-BrowserFile($Session, [string]$Path) {
 $deadline=[DateTime]::UtcNow.AddSeconds(30)
 while(!(Test-Path -LiteralPath $Path)) {
  if($Session.Process.HasExited -and $Session.Process.ExitCode -ne 0){throw ('Browser exited during startup: '+$Session.Stderr.GetAwaiter().GetResult())}
  if([DateTime]::UtcNow -gt $deadline){throw "Browser startup timed out: $($Session.Browser)"}
  Start-Sleep -Milliseconds 100
 }
}

function Connect-BrowserSocket($Session, [string]$Url) {
 $Session.Socket=[Net.WebSockets.ClientWebSocket]::new()
 $cts=[Threading.CancellationTokenSource]::new(15000)
 try{$Session.Socket.ConnectAsync([Uri]$Url,$cts.Token).GetAwaiter().GetResult()|Out-Null}
 finally{$cts.Dispose()}
}

function Invoke-BrowserCommand($Session, [string]$Method, $Parameters, [int]$TimeoutMs=120000) {
 $Session.Sequence++;$id=$Session.Sequence
 $json=@{id=$id;method=$Method;params=$Parameters}|ConvertTo-Json -Depth 30 -Compress
 $bytes=[Text.Encoding]::UTF8.GetBytes($json)
 $cts=[Threading.CancellationTokenSource]::new($TimeoutMs)
 try {
  $Session.Socket.SendAsync([ArraySegment[byte]]::new($bytes),[Net.WebSockets.WebSocketMessageType]::Text,$true,$cts.Token).GetAwaiter().GetResult()|Out-Null
  do {
   $stream=[IO.MemoryStream]::new();$buffer=New-Object byte[] 65536
   try {
    do {
     $r=$Session.Socket.ReceiveAsync([ArraySegment[byte]]::new($buffer),$cts.Token).GetAwaiter().GetResult()
     if($r.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close){throw 'Browser connection closed'}
     $stream.Write($buffer,0,$r.Count)
    } while(!$r.EndOfMessage)
    $reply=[Text.Encoding]::UTF8.GetString($stream.ToArray())|ConvertFrom-Json
   } finally {$stream.Dispose()}
   # Both protocols interleave events with command replies.
  } while($reply.id -ne $id)
  if($reply.error){throw "$Method failed: $($reply.error) $($reply.message)"}
  return $reply.result
 } finally {$cts.Dispose()}
}

function Stop-BrowserProcess($Session) {
 if($Session.Socket){$Session.Socket.Dispose()}
 if($Session.Http){$Session.Http.Dispose()}
 if($Session.Process) {
  if(!$Session.Process.HasExited -and !$Session.Process.WaitForExit(5000)) {
   $Session.Process.Kill();$Session.Process.WaitForExit(5000)|Out-Null
  }
  $Session.Process.Dispose()
 }
}
