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

See the repository-level README and `docs/` for architecture and development notes.
