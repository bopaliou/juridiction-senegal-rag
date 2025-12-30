#!/usr/bin/env python3
"""
Script de test de performance pour identifier les goulots d'étranglement.
"""

import asyncio
import time
import requests
import json
from typing import Dict, Any

# Configuration
API_URL = "http://127.0.0.1:8000"
TEST_QUESTIONS = [
    "Qu'est-ce que le contrat de travail?",
    "Quelles sont les règles sur les congés payés?",
    "Comment calculer les heures supplémentaires?",
    "Qu'est-ce que le licenciement pour faute grave?",
    "Quels sont les droits du salarié en cas de maladie?"
]

def test_health_check():
    """Test du health check de l'API."""
    print("🔍 Test du health check...")
    start_time = time.time()
    
    try:
        response = requests.get(f"{API_URL}/health", timeout=10)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            print(f"✅ Health check OK ({elapsed:.2f}s)")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ Health check error ({elapsed:.2f}s): {e}")
        return False

def test_question_performance(question: str, token: str = None) -> Dict[str, Any]:
    """Test de performance pour une question."""
    print(f"\n🔍 Test: {question[:50]}...")
    
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    payload = {
        "question": question,
        "thread_id": "test_performance"
    }
    
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{API_URL}/ask",
            headers=headers,
            json=payload,
            timeout=300  # 5 minutes max
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            response_length = len(data.get("reponse", ""))
            sources_count = len(data.get("sources", []))
            
            print(f"✅ Succès ({elapsed:.2f}s)")
            print(f"   📝 Réponse: {response_length} caractères")
            print(f"   📚 Sources: {sources_count}")
            
            return {
                "success": True,
                "elapsed": elapsed,
                "response_length": response_length,
                "sources_count": sources_count,
                "status_code": response.status_code
            }
        else:
            print(f"❌ Erreur {response.status_code} ({elapsed:.2f}s)")
            try:
                error_data = response.json()
                print(f"   💬 Détail: {error_data.get('detail', 'Pas de détail')}")
            except:
                print(f"   💬 Réponse: {response.text[:100]}")
            
            return {
                "success": False,
                "elapsed": elapsed,
                "status_code": response.status_code,
                "error": response.text[:200]
            }
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"⏱️ Timeout ({elapsed:.2f}s)")
        return {
            "success": False,
            "elapsed": elapsed,
            "error": "Timeout"
        }
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ Exception ({elapsed:.2f}s): {e}")
        return {
            "success": False,
            "elapsed": elapsed,
            "error": str(e)
        }

def main():
    """Fonction principale de test."""
    print("🚀 Test de performance du backend")
    print("=" * 50)
    
    # Test du health check
    if not test_health_check():
        print("\n❌ Le backend n'est pas accessible. Vérifiez qu'il est démarré.")
        return
    
    # Tests de performance
    results = []
    
    print(f"\n🔍 Test de {len(TEST_QUESTIONS)} questions...")
    print("⚠️  Note: Ces tests utilisent des requêtes sans authentification")
    print("   Si l'authentification est requise, les tests échoueront avec 401")
    
    for i, question in enumerate(TEST_QUESTIONS, 1):
        print(f"\n--- Test {i}/{len(TEST_QUESTIONS)} ---")
        result = test_question_performance(question)
        results.append(result)
        
        # Pause entre les tests pour éviter le rate limiting
        if i < len(TEST_QUESTIONS):
            time.sleep(2)
    
    # Résumé des résultats
    print("\n" + "=" * 50)
    print("📊 RÉSUMÉ DES RÉSULTATS")
    print("=" * 50)
    
    successful_tests = [r for r in results if r["success"]]
    failed_tests = [r for r in results if not r["success"]]
    
    print(f"✅ Tests réussis: {len(successful_tests)}/{len(results)}")
    print(f"❌ Tests échoués: {len(failed_tests)}/{len(results)}")
    
    if successful_tests:
        avg_time = sum(r["elapsed"] for r in successful_tests) / len(successful_tests)
        min_time = min(r["elapsed"] for r in successful_tests)
        max_time = max(r["elapsed"] for r in successful_tests)
        
        print(f"\n⏱️  Temps de réponse:")
        print(f"   Moyenne: {avg_time:.2f}s")
        print(f"   Minimum: {min_time:.2f}s")
        print(f"   Maximum: {max_time:.2f}s")
        
        if max_time > 90:
            print(f"⚠️  Attention: Certaines requêtes dépassent 90s (timeout backend)")
        
        if avg_time > 30:
            print(f"⚠️  Attention: Temps de réponse moyen élevé (>{avg_time:.1f}s)")
    
    if failed_tests:
        print(f"\n❌ Erreurs rencontrées:")
        error_counts = {}
        for test in failed_tests:
            error = test.get("error", "Erreur inconnue")
            if "401" in str(test.get("status_code", "")):
                error = "Authentification requise (401)"
            error_counts[error] = error_counts.get(error, 0) + 1
        
        for error, count in error_counts.items():
            print(f"   {error}: {count} fois")
    
    print(f"\n💡 Conseils:")
    if any(r.get("elapsed", 0) > 60 for r in successful_tests):
        print("   - Considérez augmenter REQUEST_TIMEOUT dans .env")
    if len(failed_tests) > 0:
        print("   - Vérifiez les logs du backend pour plus de détails")
    if any("401" in str(r.get("status_code", "")) for r in failed_tests):
        print("   - L'authentification est requise pour ces endpoints")

if __name__ == "__main__":
    main()