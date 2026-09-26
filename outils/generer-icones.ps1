# Genere les icones de l'app (icones/icone-*.png) depuis outils/icones.html, dans Edge sans fenetre.
# Usage : powershell -NoProfile -ExecutionPolicy Bypass -File outils\generer-icones.ps1 [-Combinaison wada-n155] [-Port 8766]
# (fichier en ASCII : Windows PowerShell 5.1 lit les scripts sans BOM en ANSI)
param(
    [string]$Combinaison = '',
    [int]$Port = 8766
)

$ErrorActionPreference = 'Stop'
$racine = Split-Path -Parent $PSScriptRoot
$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Output 'Edge introuvable'; exit 2 }

$tmp = Join-Path $env:TEMP "garde-robe-icones-$Port"
New-Item -ItemType Directory -Force $tmp | Out-Null
$domFichier = Join-Path $tmp 'dom.html'
if (Test-Path $domFichier) { Remove-Item $domFichier -Force }

$serveur = Start-Process -FilePath 'python' -ArgumentList "outils\serveur.py $Port" -WorkingDirectory $racine -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $tmp 'serveur.out') -RedirectStandardError (Join-Path $tmp 'serveur.err')
try {
    $base = "http://127.0.0.1:$Port/"
    $pret = $false
    for ($i = 0; $i -lt 50 -and -not $pret; $i++) {
        try { Invoke-WebRequest $base -UseBasicParsing -TimeoutSec 1 | Out-Null; $pret = $true }
        catch { Start-Sleep -Milliseconds 100 }
    }
    if (-not $pret) { Write-Output 'Serveur local injoignable'; exit 2 }
    $url = $base + 'outils/icones.html'
    if ($Combinaison) { $url += '?combinaison=' + $Combinaison }
    $arguments = "--headless=new --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=`"$(Join-Path $tmp 'profil-edge')`" --virtual-time-budget=30000 --dump-dom $url"
    $navigateur = Start-Process -FilePath $edge -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $domFichier -RedirectStandardError (Join-Path $tmp 'edge.err')
    if (-not $navigateur.WaitForExit(120000)) { Stop-Process -Id $navigateur.Id -Force; Write-Output 'Delai depasse'; exit 2 }
}
finally {
    Stop-Process -Id $serveur.Id -Force -ErrorAction SilentlyContinue
}

$dom = Get-Content $domFichier -Raw -Encoding UTF8
$bloc = [regex]::Match($dom, '(?s)<pre id="sortie">(.*?)</pre>')
if (-not $bloc.Success -or -not $bloc.Groups[1].Value) { Write-Output 'Aucune icone dans la page'; exit 2 }
$sortie = [System.Net.WebUtility]::HtmlDecode($bloc.Groups[1].Value) | ConvertFrom-Json
$dossier = Join-Path $racine 'icones'
New-Item -ItemType Directory -Force $dossier | Out-Null
foreach ($fichier in $sortie.fichiers.PSObject.Properties) {
    $octets = [Convert]::FromBase64String(($fichier.Value -replace '^data:image/png;base64,', ''))
    [IO.File]::WriteAllBytes((Join-Path $dossier $fichier.Name), $octets)
    Write-Output ("{0} : {1} octets" -f $fichier.Name, $octets.Length)
}
Write-Output ("Combinaison : " + $sortie.combinaison)
