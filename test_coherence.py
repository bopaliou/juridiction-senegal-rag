"""
Script de test pour vérifier la cohérence entre réponses et sources
"""

import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agent import agent_app


def test_coherence(question: str):
    """Teste la cohérence pour une question donnée."""
    print(f"\n{'='*80}")
    print(f"QUESTION: {question}")
    print(f"{'='*80}\n")
    
    # Invoquer l'agent
    result = agent_app.invoke({
        "question": question,
        "messages": []
    })
    
    # Afficher la réponse
    print("RÉPONSE:")
    print("-" * 80)
    print(result.get("answer", "Pas de réponse"))
    print()
    
    # Afficher les sources
    sources = result.get("sources", [])
    print(f"\nSOURCES CITÉES ({len(sources)}):")
    print("-" * 80)
    
    if not sources:
        print("Aucune source citée")
    else:
        import json
        for idx, source_json in enumerate(sources, 1):
            try:
                source = json.loads(source_json)
                print(f"\n{idx}. {source.get('title', 'Sans titre')}")
                if source.get('article'):
                    print(f"   Article: {source['article']}")
                if source.get('breadcrumb'):
                    print(f"   Section: {source['breadcrumb']}")
                content = source.get('content', '')[:200]
                print(f"   Contenu: {content}...")
            except:
                print(f"{idx}. [Erreur de parsing]")
    
    # Vérification basique de cohérence
    print("\n" + "="*80)
    print("ANALYSE DE COHÉRENCE:")
    print("="*80)
    
    answer = result.get("answer", "").lower()
    
    # Vérifier si la réponse dit "ne dispose pas" mais des sources sont affichées
    if "ne dispose pas" in answer or "pas d'information" in answer:
        if sources:
            print("⚠️  INCOHÉRENCE: La réponse dit 'ne dispose pas' mais des sources sont citées!")
        else:
            print("✅ COHÉRENT: Pas d'info + pas de sources")
    else:
        if not sources:
            print("⚠️  INCOHÉRENCE: La réponse semble informative mais aucune source citée!")
        else:
            print(f"✅ COHÉRENT: Réponse + {len(sources)} source(s)")
            
            # Vérifier si les termes de la réponse apparaissent dans les sources
            import json
            all_source_content = ""
            for source_json in sources:
                try:
                    source = json.loads(source_json)
                    all_source_content += source.get('content', '').lower()
                except:
                    pass
            
            # Extraire les mots clés de la réponse (plus de 5 lettres)
            answer_words = [w for w in answer.split() if len(w) > 5]
            matching_words = [w for w in answer_words if w in all_source_content]
            
            if answer_words:
                coherence_ratio = len(matching_words) / len(answer_words)
                print(f"   Mots clés correspondants: {len(matching_words)}/{len(answer_words)} ({coherence_ratio*100:.0f}%)")
                
                if coherence_ratio < 0.3:
                    print("   ⚠️  ATTENTION: Faible correspondance entre réponse et sources!")
    
    print()


if __name__ == "__main__":
    # Tests avec différents types de questions
    test_questions = [
        "Combien de jours de congé ai-je droit par an ?",
        "Quel est le salaire minimum au Sénégal ?",
        "Comment faire cuire un gâteau ?",  # Question hors-sujet
        "À quel âge puis-je partir à la retraite ?",
        "Quelles sont les sanctions pour vol ?",
    ]
    
    for q in test_questions:
        test_coherence(q)
        input("\nAppuyez sur Entrée pour continuer...")
