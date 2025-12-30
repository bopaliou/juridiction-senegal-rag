"""
Optimisations mémoire pour déploiement Render (512MB max)
"""

import os

# Désactiver les imports inutiles et réduire la mémoire
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# Réduire la verbosité TensorFlow/transformers
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TRANSFORMERS_CACHE"] = "/tmp/transformers_cache"

# Limiter les workers
os.environ["WEB_CONCURRENCY"] = "1"

# Désactiver optimisations coûteuses en mémoire
os.environ["SENTENCE_TRANSFORMERS_CACHE_FOLDER"] = "/tmp/st_cache"

print("✅ Optimisations mémoire activées")
