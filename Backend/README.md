# HAMRAH.EXE Backend

Django REST backend for HAMRAH.EXE.

Implemented layers:

- `core.job_analyzer` — Stage 1 Job Analyzer
- `core.career_intelligence` — Stage 2 Career Intelligence Agent
- `core.memory_service` — user-isolated Career Memory access
- `core.match_agent` — Stage 3 deterministic Match / Decision Agent
- `apps.career_memory` — Career Memory persistence and APIs
- `apps.match` — Stage 3 Match API
- `apps.agent` — existing agent runtime/tool orchestration
- `apps.applications` — user-owned application tracking and evidence-based outcome suggestions

See the repository-level README and `docs/` for architecture and development notes.

## Deployment (Docker)

```bash
docker build -t hamrah-backend .
docker run -p 8000:8000 --env-file .env hamrah-backend
```

`entrypoint.sh` waits for the database, runs `migrate`, loads
`fixtures/initial_data.json` only on a completely empty database (falls back to a
`demo` user if the fixture fails), runs `collectstatic`, then starts gunicorn.
See `.env.example` for all supported environment variables.

Run tests: `python manage.py test tests`

## Job applications and outcome learning

See [docs/application-outcome-learning.md](docs/application-outcome-learning.md)
for the repository audit, implementation notes, endpoints, and examples.

Every model-backed feature uses the shared OpenRouter adapter. Configure
`OPENROUTER_API_KEY` and, optionally, `OPENROUTER_BASE_URL` and
`OPENROUTER_MODEL` in the backend environment. `LLM_TIMEOUT` controls the
request timeout. There is no alternate provider or model fallback; requests
fail with a controlled configuration error when the OpenRouter key is absent.

## Datasets API

All routes require JWT:

- `GET /api/datasets/` — list the signed-in user's datasets
- `POST /api/datasets/` — multipart upload with `name` and `file`
- `GET /api/datasets/<id>/` — one dataset's metadata
- `PATCH /api/datasets/<id>/` — rename
- `DELETE /api/datasets/<id>/` — delete record and file

Only CSV (with a header row) and JSON (array of objects) are accepted; max 10 MB.
Files are stored under `MEDIA_ROOT` (env `MEDIA_ROOT`, default `./media`) — mount a
persistent volume there in Docker. Tests: `python manage.py test apps.datasets`
