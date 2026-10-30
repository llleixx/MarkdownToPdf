function Start-ExportBrowser($Session) {
 $profile=$Session.Profile
 [IO.Directory]::CreateDirectory($profile)|Out-Null
 # This is a disposable profile, never the user's Firefox profile.
 [IO.File]::WriteAllText((Join-Path $profile 'user.js'), 'user_pref("browser.shell.checkDefaultBrowser", false);')
 Start-BrowserProcess $Session "--headless --no-remote --profile `"$profile`" --remote-debugging-port 0 about:blank"
 $portFile=Join-Path $profile 'WebDriverBiDiServer.json'
 Wait-BrowserFile $Session $portFile
 $endpoint=[IO.File]::ReadAllText($portFile)|ConvertFrom-Json
 Connect-BrowserSocket $Session "ws://127.0.0.1:$($endpoint.ws_port)/session"
 Invoke-BrowserCommand $Session 'session.new' @{capabilities=@{}}|Out-Null
 $tree=Invoke-BrowserCommand $Session 'browsingContext.getTree' @{}
 $Session.Context=$tree.contexts[0].context
}

function Open-ExportPage($Session, [string]$Url) {
 Invoke-BrowserCommand $Session 'browsingContext.navigate' @{context=$Session.Context;url=$Url;wait='complete'}|Out-Null
}

function Evaluate-ExportPage($Session, [string]$Expression) {
 $reply=Invoke-BrowserCommand $Session 'script.evaluate' @{expression=$Expression;target=@{context=$Session.Context};awaitPromise=$true}
 if($reply.type -eq 'exception'){throw ('Page script failed: '+$reply.exceptionDetails.text)}
 # The shared workflow evaluates only booleans and JSON strings, avoiding a
 # second recursive decoder for BiDi's typed object representation.
 return $reply.result.value
}

function Print-ExportPage($Session) {
 # Firefox's print command ignores CSS paper size. Read the unnamed @page rule
 # through CSSOM, so shared/user CSS remains the single source of paper settings.
 $paperJson=Evaluate-ExportPage $Session @'
JSON.stringify((() => {
 const settings = document.createElement('div').style;
 let paperSize = '';
 let sizePriority = '';
 function visit(rules) {
  for (const rule of rules) {
   if (rule.type === CSSRule.PAGE_RULE && !rule.selectorText) {
    for (const name of ['size','margin-top','margin-bottom','margin-left','margin-right']) {
     const value = rule.style.getPropertyValue(name);
     const priority = rule.style.getPropertyPriority(name);
     if (name === 'size') {
      if (value && (priority || !sizePriority)) {paperSize=value;sizePriority=priority;}
     } else if (value && (priority || !settings.getPropertyPriority(name))) settings.setProperty(name,value,priority);
    }
   } else if (rule.type === CSSRule.IMPORT_RULE) visit(rule.styleSheet.cssRules);
   else if (rule.type === CSSRule.MEDIA_RULE && matchMedia(rule.conditionText.replace(/print/g,'screen')).matches) visit(rule.cssRules);
  }
 }
 for (const sheet of document.styleSheets) visit(sheet.cssRules);
 const probe = document.createElement('div');
 probe.style.cssText = 'position:absolute;visibility:hidden;padding:0;border:0';
 document.body.append(probe);
 function cm(value) {
  probe.style.width = value;
  return probe.getBoundingClientRect().width * 2.54 / 96;
 }
 try {
  const size = paperSize.toLowerCase().split(/\s+/);
  const named = {a3:[29.7,42],a4:[21,29.7],a5:[14.8,21],letter:[21.59,27.94],legal:[21.59,35.56],ledger:[27.94,43.18]};
  let page = named[size[0]] || (['auto','landscape','portrait'].includes(size[0]) ? named.a4 : null);
  if (!page) page = [cm(size[0]),cm(size[1] || size[0])];
  if (size.includes('landscape')) page = [Math.max(...page),Math.min(...page)];
  if (size.includes('portrait')) page = [Math.min(...page),Math.max(...page)];
  const margin = Object.fromEntries(['top','bottom','left','right'].map(side => [side,cm(settings.getPropertyValue('margin-'+side) || '0px')]));
  return {page:{width:page[0],height:page[1]},margin};
 } finally {probe.remove();}
})())
'@
 $paper=$paperJson|ConvertFrom-Json
 $reply=Invoke-BrowserCommand $Session 'browsingContext.print' @{
  context=$Session.Context;background=$true;shrinkToFit=$false
  page=$paper.page;margin=$paper.margin
 }
 return $reply.data
}

function Close-ExportBrowser($Session) {
 Invoke-BrowserCommand $Session 'browser.close' @{} 5000|Out-Null
}
