# Script PowerShell pour demarrer le backend sans auto-reload
Write-Host "Demarrage du backend sans auto-reload..." -ForegroundColor Green

# Verifier que l'environnement virtuel est active
if (-not $env:VIRTUAL_ENV) {
    Write-Host "Activation de l'environnement virtuel..." -ForegroundColor Yellow
    & uv sync
}

# Demarrer le serveur sans --reload
Write-Host "Demarrage d'Uvicorn sans auto-reload..." -ForegroundColor Cyan
uv run uvicorn src.api.main:app --host 127.0.0.1 --port 8000

Write-Host "Backend demarre!" -ForegroundColor Green