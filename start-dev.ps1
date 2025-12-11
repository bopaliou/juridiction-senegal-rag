# Script de démarrage pour le développement local YoonAssist AI
Write-Host "🚀 Démarrage de YoonAssist AI en mode développement local" -ForegroundColor Green
Write-Host ""

# Fonction pour démarrer un service en arrière-plan
function Start-Service {
    param([string]$Name, [string]$Command, [string]$WorkingDir = $null)

    Write-Host "📦 Démarrage de $Name..." -ForegroundColor Yellow

    $job = Start-Job -ScriptBlock {
        param($cmd, $dir)
        if ($dir) { Set-Location $dir }
        Invoke-Expression $cmd
    } -ArgumentList $Command, $WorkingDir

    Start-Sleep -Seconds 2
    Write-Host "✅ $Name démarré (Job ID: $($job.Id))" -ForegroundColor Green
    return $job
}

# Démarrer le backend
$backendJob = Start-Service -Name "Backend API" -Command "uv run uvicorn server:app --reload" -WorkingDir "src"

# Attendre que le backend soit prêt
Write-Host "⏳ Attente du démarrage du backend..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Démarrer le frontend
$frontendJob = Start-Service -Name "Frontend Next.js" -Command "npm run dev" -WorkingDir "legal-rag-frontend"

Write-Host ""
Write-Host "🎉 Services démarrés !" -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Backend: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "📊 Health Check: http://127.0.0.1:8000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Pour arrêter tous les services, fermez ce terminal ou utilisez Ctrl+C" -ForegroundColor Gray

# Garder le script ouvert pour maintenir les jobs
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "🛑 Arrêt des services..." -ForegroundColor Red
    Stop-Job -Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
}
