# AWS AppRunner & Elastic Beanstalk Configuration

## Pour Amplify (Frontend)
```yaml
# amplify.yml (auto-généré par Amplify)
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd legal-rag-frontend
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: legal-rag-frontend/.next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Pour AppRunner (Backend)
```yaml
# apprunner.yaml (auto-détecté)
version: 1.0
runtime: python3.11
build:
  commands:
    build:
      - pip install --no-cache-dir -r requirements.txt
run:
  command: uvicorn src.server:app --host 0.0.0.0 --port 8000
  port: 8000
  env:
    - name: PYTHONUNBUFFERED
      value: "1"
```

## Pour Elastic Beanstalk (Backend + Frontend)
```bash
# Créer application EB:
eb init -p python-3.11 juridiction-senegal-rag --region us-east-1

# Créer environment:
eb create prod-env --instance-type t2.micro --scale 1

# Configurer variables d'env:
eb setenv GROQ_API_KEY=xxxx SUPABASE_URL=xxx ...

# Déployer:
eb deploy

# Voir logs:
eb logs --stream

# Voir status:
eb status
```

## Environnement à configurer partout:
```
GROQ_API_KEY=your_key
SUPABASE_URL=https://uaordlnuhjowjtdiknfh.supabase.co
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
ALLOWED_ORIGINS=your_frontend_url
REQUEST_TIMEOUT=60
MAX_WORKERS=1
PYTHONUNBUFFERED=1
NODE_ENV=production (frontend only)
NEXT_PUBLIC_API_URL=your_backend_url (frontend only)
```
