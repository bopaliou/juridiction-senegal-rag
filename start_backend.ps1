# Script de démarrage du backend FastAPI
Write-Host "Démarrage du backend YoonAssist..." -ForegroundColor Green

# Activer l'environnement virtuel
& .\.venv\Scripts\Activate.ps1

# Démarrer uvicorn
Write-Host "Lancement d'uvicorn sur http://0.0.0.0:8000" -ForegroundColor Cyan
python -m uvicorn src.server:app --reload --host 0.0.0.0 --port 8000
