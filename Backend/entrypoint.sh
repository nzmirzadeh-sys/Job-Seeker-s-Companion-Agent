#!/bin/sh
set -e

echo "==> Waiting for database..."
python - <<'PYEOF'
import os, sys, time
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django; django.setup()
from django.db import connections
from django.db.utils import OperationalError
conn = connections["default"]
for attempt in range(1, 31):
    try:
        conn.ensure_connection()
        print("    database ready.")
        break
    except OperationalError:
        print(f"    not ready yet ({attempt}/30), retrying...")
        time.sleep(1)
else:
    print("ERROR: database did not become ready in 30 seconds.")
    sys.exit(1)
PYEOF

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Checking whether initial data should be loaded..."
python - <<'PYEOF'
import os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django; django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()

# Only load fixtures when the DB is completely empty (fresh deploy)
if User.objects.exists():
    print("    data already present — skipping fixture load.")
    sys.exit(0)

fixture = "/app/fixtures/initial_data.json"
import os as _os
if not _os.path.exists(fixture):
    print("    no fixture file found — skipping.")
    sys.exit(0)

print("    fresh database detected — loading initial_data.json ...")
from django.core.management import call_command
try:
    call_command("loaddata", fixture, verbosity=1)
    print("    fixture loaded successfully.")
except Exception as exc:
    # Non-fatal: fixture may have integrity issues on a clean schema.
    # Fall back to creating just the demo user.
    print(f"    WARNING: fixture load failed ({exc}), falling back to demo user only.")
    sys.exit(2)
PYEOF
FIXTURE_EXIT=$?

if [ "$FIXTURE_EXIT" = "2" ]; then
    echo "==> Creating demo user as fallback..."
    python - <<'PYEOF'
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django; django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username="demo").exists():
    User.objects.create_user("demo", password="demo1234")
    print("    demo user created.")
PYEOF
fi

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "==> Starting gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
