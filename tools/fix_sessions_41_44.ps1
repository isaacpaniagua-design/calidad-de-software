$ErrorActionPreference = 'Stop'
$targets = 41..44 | ForEach-Object { "sesion$_.html" }
foreach($f in $targets){
  if (!(Test-Path $f)) { Write-Output "skip $f (no existe)"; continue }
  $raw = Get-Content -Raw -Encoding UTF8 $f
  $lines = $raw -split "`r?`n"
  $clean = $lines | Where-Object { $_ -notmatch 'back-home\.js' -and $_ -notmatch 'nav-inject\.js' -and ($_ -notmatch '^\s*</body>\s*$') -and ($_ -notmatch '^\s*</html>\s*$') }
  $nl = [Environment]::NewLine
  $rebuilt = ($clean -join $nl) + $nl + '  <script defer src="js/back-home.js"></script>' + $nl + '  <script defer src="js/nav-inject.js"></script>' + $nl + '  </body>' + $nl + '</html>' + $nl
  [IO.File]::WriteAllText((Resolve-Path $f), $rebuilt, [Text.UTF8Encoding]::new($false))
  Write-Output "fixed $f"
}
