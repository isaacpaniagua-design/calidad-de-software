$ErrorActionPreference = 'Stop'
$targets = 2..10 | ForEach-Object { "sesion$_.html" }
foreach($f in $targets){
  if (!(Test-Path $f)) { Write-Output "skip $f (no existe)"; continue }
  $lines = Get-Content -Encoding UTF8 -Path $f
  # localizar </body>
  $bodyIdx = ($lines | Select-String -Pattern '</body>' | Select-Object -First 1).LineNumber
  if (-not $bodyIdx) { Write-Output "skip $f (sin </body>)"; continue }
  $i = $bodyIdx - 1
  # eliminar includes corruptos o duplicados previos
  $clean = @()
  foreach($ln in $lines){
    if ($ln -match 'back-home\.js' -or $ln -match 'nav-inject\.js') { continue }
    $clean += $ln
  }
  # reinsertar includes correctos antes de </body>
  $before = $clean[0..($i-1)]
  $after = $clean[$i..($clean.Length-1)]
  $inject = @(
    '  <script defer src="js/back-home.js"></script>',
    '  <script defer src="js/nav-inject.js"></script>'
  )
  $new = @()
  $new += $before
  $new += $inject
  $new += $after
  Set-Content -Encoding UTF8 -Path $f -Value $new
  Write-Output "fixed $f"
}
