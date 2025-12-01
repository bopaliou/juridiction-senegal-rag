"""
Middlewares de sécurité et de performance pour FastAPI.
"""
import time
import asyncio
from fastapi import Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from src.security import rate_limit_check, get_client_id

# Timeout pour les requêtes (en secondes)
REQUEST_TIMEOUT = 120  # 2 minutes


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Ajoute des en-têtes de sécurité HTTP."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Ajouter les en-têtes de sécurité
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:;"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware de rate limiting."""
    
    async def dispatch(self, request: Request, call_next):
        # Ignorer le rate limiting pour les routes de santé
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        
        client_id = get_client_id(request)
        
        if not rate_limit_check(client_id):
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Trop de requêtes. Veuillez réessayer plus tard.",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        return await call_next(request)


class TimeoutMiddleware(BaseHTTPMiddleware):
    """Middleware pour gérer les timeouts."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Ajouter le temps de traitement dans les en-têtes
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
        except Exception as e:
            # Gérer les timeouts et autres erreurs
            if isinstance(e, asyncio.TimeoutError):
                return JSONResponse(
                    status_code=504,
                    content={"detail": "La requête a pris trop de temps à traiter."}
                )
            raise


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware pour logger les requêtes (sans informations sensibles)."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Logger la requête (sans le body pour éviter les logs de données sensibles)
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {request.method} {request.url.path}")
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        # Logger la réponse
        print(
            f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] "
            f"{request.method} {request.url.path} - "
            f"{response.status_code} - {process_time:.3f}s"
        )
        
        return response



