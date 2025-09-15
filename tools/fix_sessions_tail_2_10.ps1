$ErrorActionPreference = 'Stop'
$targets = 2..10 | ForEach-Object { "sesion$_.html" }
foreach($f in $targets){
  if (!(Test-Path $f)) { continue }
  $raw = Get-Content -Raw -Encoding UTF8 $f
  # remove existing include lines and closing tags to rebuild
  $raw = ($raw -split "`r?`n") | Where-Object { $_ -notmatch 'back-home\.js' -and $_ -notmatch 'nav-inject\.js' -and $_ -notmatch '^\s*</body>\s*$' -and $_ -notmatch '^\s*</html>\s*$' } | ForEach-Object { $_ }
  $newline = [Environment]::NewLine
  $rebuilt = ($raw -join $newline) + $newline + '  <script defer src="js/back-home.js"></script>' + $newline + '  <script defer src="js/nav-inject.js"></script>' + $newline + '  </body>' + $newline + '</html>' + $newline
  [IO.File]::WriteAllText((Resolve-Path $f), $rebuilt, [Text.UTF8Encoding]::new($false))
  Write-Output "tail fixed $f"
}
