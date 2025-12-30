# Script PowerShell pour redémarrer les services avec la nouvelle configuration

Write-Host "🔄 Redémarrage des services avec nouvelle configuration timeout..." -ForegroundColor Cyan

# Arrêter les processus existants
Write-Host "🛑 Arrêt des services existants..." -ForegroundColor Yellow

# Tuer les processus Python (backend)
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" -or $_.CommandLine -like "*fastapi*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Tuer les processus Node.js (frontend)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "⏳ Attente de 3 secondes..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Démarrer le backend
Write-Host "🚀 Démarrage du backend..." -ForegroundColor Green
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$PWD'; .\start_backend.ps1" -WindowStyle Normal

Write-Host "⏳ Attente de 5 secondes pour le démarrage du backend..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Démarrer le frontend
Write-Host "🚀 Démarrage du frontend..." -ForegroundColor Green
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$PWD\legal-rag-frontend'; npm run dev" -WindowStyle Normal

Write-Host "✅ Services redémarrés avec la nouvelle configuration!" -ForegroundColor Green
Write-Host "📝 Changements appliqués:" -ForegroundColor Cyan
Write-Host "   - Backend timeout: 300 secondes (5 minutes)" -ForegroundColor White
Write-Host "   - Frontend timeout: 300 secondes (5 minutes)" -ForegroundColor White
Write-Host "   - Meilleure gestion des erreurs" -ForegroundColor White

Write-Host "`n🔍 Pour tester les performances:" -ForegroundColor Cyan
Write-Host "   python test_backend_performance.py" -ForegroundColor White

Write-Host "`n🌐 URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "   Backend:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "   API Docs: http://127.0.0.1:8000/docs" -ForegroundColor White