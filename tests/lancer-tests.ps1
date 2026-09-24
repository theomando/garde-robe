# Lance tests/tests.html dans Edge sans fenetre et renvoie un code de sortie.
#   0 : tous les tests passent ; 1 : au moins un echec ; 2 : pas de resultat (page cassee, delai, serveur).
# Usage : powershell -NoProfile -ExecutionPolicy Bypass -File tests\lancer-tests.ps1 [-ControleEchec] [-Port 8765]
# (fichier en ASCII : Windows PowerShell 5.1 lit les scripts sans BOM en ANSI)
param(
    [switch]$ControleEchec,
    [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$racine = Split-Path -Parent $PSScriptRoot
$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Output 'Edge introuvable'; exit 2 }

$tmp = Join-Path $env:TEMP 'garde-robe-tests'
New-Item -ItemType Directory -Force $tmp | Out-Null
$domFichier = Join-Path $tmp 'dom.html'
if (Test-Path $domFichier) { Remove-Item $domFichier -Force }

$code = 0
$serveur = Start-Process -FilePath 'python' -ArgumentList "outils\serveur.py $Port" -WorkingDirectory $racine -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $tmp 'serveur.out') -RedirectStandardError (Join-Path $tmp 'serveur.err')
try {
    $base = "http://127.0.0.1:$Port/"
    $pret = $false
    for ($i = 0; $i -lt 50 -and -not $pret; $i++) {
        try { Invoke-WebRequest $base -UseBasicParsing -TimeoutSec 1 | Out-Null; $pret = $true }
        catch { Start-Sleep -Milliseconds 100 }
    }
    if (-not $pret) {
        Write-Output 'Serveur local injoignable'
        $code = 2
    }
    else {
        $url = $base + 'tests/tests.html'
        if ($ControleEchec) { $url += '?controle-echec' }
        $profil = Join-Path $tmp 'profil-edge'
        $arguments = "--headless=new --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=`"$profil`" --virtual-time-budget=60000 --dump-dom $url"
        $navigateur = Start-Process -FilePath $edge -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $domFichier -RedirectStandardError (Join-Path $tmp 'edge.err')
        if (-not $navigateur.WaitForExit(120000)) {
            Stop-Process -Id $navigateur.Id -Force
            Write-Output 'Delai depasse'
            $code = 2
        }
    }
}
finally {
    Stop-Process -Id $serveur.Id -Force -ErrorAction SilentlyContinue
}
if ($code -ne 0) { exit $code }

$dom = Get-Content $domFichier -Raw -Encoding UTF8
$bloc = [regex]::Match($dom, '(?s)<pre id="resultat">(.*?)</pre>')
if (-not $bloc.Success) { Write-Output 'Aucun resultat dans la page'; exit 2 }
$texte = [System.Net.WebUtility]::HtmlDecode($bloc.Groups[1].Value)
$texte -split "`n" | ForEach-Object { Write-Output $_ }
$bilan = [regex]::Match($texte, 'RESULTAT (\d+)/(\d+)')
if (-not $bilan.Success) { exit 2 }
if ($bilan.Groups[1].Value -eq $bilan.Groups[2].Value -and [int]$bilan.Groups[2].Value -gt 0) { exit 0 }
exit 1
