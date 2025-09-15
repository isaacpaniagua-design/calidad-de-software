$ErrorActionPreference = 'Stop'
$sessions = Get-ChildItem -Filter 'sesion*.html'
foreach($f in $sessions){
  $raw = Get-Content -Raw -Encoding UTF8 $f.FullName
  if($raw -notmatch 'js/back-home.js'){
    $raw = $raw -replace '</body>','  <script defer src="js/back-home.js"></script>`r`n  </body>'
  }
  if($raw -notmatch 'js/nav-inject.js'){
    $raw = $raw -replace '</body>','  <script defer src="js/nav-inject.js"></script>`r`n  </body>'
  }
  Set-Content -Encoding UTF8 -Path $f.FullName -Value $raw
}
"OK: fixed $($sessions.Count) session files"
