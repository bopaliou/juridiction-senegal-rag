# Script de vérification du système YoonAssist
Write-Host "=== Vérification du Système YoonAssist ===" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier le backend (port 8000)
Write-Host "1. Backend FastAPI (port 8000):" -ForegroundColor Yellow
$backend = netstat -ano | findstr ":8000.*LISTENING"
if ($backend) {
    Write-Host "   ✅ Backend en écoute" -ForegroundColor Green
    Write-Host "   $backend"
    
    # Tester l'endpoint health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
        Write-Host "   ✅ Endpoint /health répond (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Endpoint /health ne répond pas" -ForegroundColor Red
    }
    
    # Tester l'endpoint credits
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/credits/balance" -UseBasicParsing -TimeoutSec 5
        Write-Host "   ✅ Endpoint /credits/balance répond (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Endpoint /credits/balance ne répond pas" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Backend non démarré" -ForegroundColor Red
    Write-Host "   Pour démarrer: uvicorn src.server:app --reload" -ForegroundColor Yellow
}

Write-Host ""

# 2. Vérifier le frontend (port 3000)
Write-Host "2. Frontend Next.js (port 3000):" -ForegroundColor Yellow
$frontend = netstat -ano | findstr ":3000.*LISTENING"
if ($frontend) {
    Write-Host "   ✅ Frontend en écoute" -ForegroundColor Green
    Write-Host "   $frontend"
} else {
    Write-Host "   ❌ Frontend non démarré" -ForegroundColor Red
    Write-Host "   Pour démarrer: cd legal-rag-frontend && npm run dev" -ForegroundColor Yellow
}

Write-Host ""

# 3. Vérifier les variables d'environnement
Write-Host "3. Configuration (.env.local):" -ForegroundColor Yellow
$envFile = "legal-rag-frontend\.env.local"
if (Test-Path $envFile) {
    Write-Host "   ✅ Fichier .env.local existe" -ForegroundColor Green
    
    $content = Get-Content $envFile
    $apiUrl = $content | Select-String "NEXT_PUBLIC_API_URL" | Select-Object -First 1
    if ($apiUrl) {
        Write-Host "   $apiUrl" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  NEXT_PUBLIC_API_URL non défini" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Fichier .env.local manquant" -ForegroundColor Red
}

Write-Host ""

# 4. Résumé et recommandations
Write-Host "=== Résumé ===" -ForegroundColor Cyan
if ($backend -and $frontend) {
    Write-Host "✅ Les deux serveurs sont démarrés" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si vous avez toujours des erreurs:" -ForegroundColor Yellow
    Write-Host "1. Ouvrez http://localhost:3000/debug pour diagnostiquer" -ForegroundColor White
    Write-Host "2. Redémarrez Next.js: Ctrl+C puis 'npm run dev'" -ForegroundColor White
    Write-Host "3. Vérifiez la console du navigateur (F12)" -ForegroundColor White
} elseif ($backend) {
    Write-Host "⚠️  Backend OK, mais frontend non démarré" -ForegroundColor Yellow
    Write-Host "Démarrez le frontend: cd legal-rag-frontend && npm run dev" -ForegroundColor White
} elseif ($frontend) {
    Write-Host "⚠️  Frontend OK, mais backend non démarré" -ForegroundColor Yellow
    Write-Host "Démarrez le backend: uvicorn src.server:app --reload" -ForegroundColor White
} else {
    Write-Host "❌ Aucun serveur n'est démarré" -ForegroundColor Red
    Write-Host ""
    Write-Host "Démarrez les serveurs:" -ForegroundColor Yellow
    Write-Host "1. Backend: uvicorn src.server:app --reload" -ForegroundColor White
    Write-Host "2. Frontend: cd legal-rag-frontend && npm run dev" -ForegroundColor White
}

Write-Host ""
