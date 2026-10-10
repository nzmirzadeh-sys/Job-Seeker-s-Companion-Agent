"""
Django settings for JobMatchAI / HAMRAH.EXE project.
Supports both SQLite (dev) and PostgreSQL (production via DATABASE_URL or DB_* env vars).
JWT auth, CORS for the Next.js frontend, and the shared OpenRouter LLM provider.
"""
from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "hackathon-only-not-for-production")
DEBUG = os.environ.get("DEBUG", "1") not in ("0", "false", "False")

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.accounts",
    "apps.jobs",
    "apps.resumes",
    "apps.agent",
    "apps.career_memory",
    "apps.match",
    "apps.interview",
    "apps.datasets",
    "apps.applications",
    "apps.resume_writer",
    "apps.evidence_validator",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database — PostgreSQL in production, SQLite for local dev
# ---------------------------------------------------------------------------
_db_url = os.environ.get("DATABASE_URL", "")
if _db_url:
    # Parse DATABASE_URL: postgres://user:pass@host:port/dbname
    import re as _re
    _m = _re.match(
        r"postgres(?:ql)?://(?P<user>[^:]+):(?P<pass>[^@]+)@(?P<host>[^:/]+)(?::(?P<port>\d+))?/(?P<name>.+)",
        _db_url,
    )
    if _m:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": _m.group("name"),
                "USER": _m.group("user"),
                "PASSWORD": _m.group("pass"),
                "HOST": _m.group("host"),
                "PORT": _m.group("port") or "5432",
            }
        }
    else:
        raise ValueError(f"Cannot parse DATABASE_URL: {_db_url}")
elif os.environ.get("DB_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["DB_NAME"],
            "USER": os.environ.get("DB_USER", "postgres"),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "db"),
            "PORT": os.environ.get("DB_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "UNAUTHENTICATED_USER": None,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": __import__("datetime").timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": __import__("datetime").timedelta(days=30),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = os.environ.get(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

LANGUAGE_CODE = "fa-ir"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Uploaded files (datasets). In Docker, mount a persistent volume at this path.
MEDIA_URL = "media/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# All model-backed features use the shared OpenRouter gateway.
# ---------------------------------------------------------------------------
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "45"))

AGGREGATOR_SCRAPER = os.environ.get("AGGREGATOR_SCRAPER", "").strip()

# OpenRouter credentials remain server-side.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.environ.get(
    "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
).rstrip("/")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL") or "openai/gpt-4o-mini"
