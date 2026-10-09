# Job Application Outcome Learning

## Repository audit

- **Backend:** Django 5.2 with Django REST Framework in `Backend/config`; JWT authentication is already configured and API routes are grouped under `/api/`.
- **Reusable components:** `apps.accounts.User` supplies authenticated user ownership; `apps.jobs.JobPosting` stores optional existing postings and listed requirements; `apps.career_memory` and `core.memory_service.MemoryService` hold verified career facts.
- **Frontend:** Next.js/React lives under `Frontend`; `lib/api.ts` injects the existing access token and the home screen links to the current product areas.
- **Tests/migrations:** Django tests are in `Backend/tests`; each Django app keeps migrations in its own `migrations/` directory.
- **Missing capability:** `apps.jobs.Match.status="applied"` is a per-job feed state, not an application record, and does not store outcomes/history. There is no endpoint for a user's application lifecycle or outcome-derived recommendations.
- **Naming/data conflicts:** An application cannot reuse `Match` without losing multiple applications, dates, notes, and outcomes. This implementation uses a distinct `JobApplication` and references `JobPosting` optionally. The existing Career Memory represents claims about the user; storing a generated recommendation there would misrepresent it as a user fact.
- **Files changed:** `Backend/apps/applications/__init__.py`, `apps.py`, `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `admin.py`, and `migrations/0001_initial.py`; `Backend/config/settings.py`, `config/urls.py`, `tests/test_applications.py`, `README.md`, and `docs/application-outcome-learning.md`; `Frontend/lib/api.ts`, `Frontend/app/page.tsx`, and `Frontend/app/applications/page.tsx`.

## Behavior and evidence boundaries

Applications belong to the authenticated user. List and detail/update/delete operations are scoped by owner; attempts to retrieve another user's application or suggestion return 404. A suggestion is considered only when at least three of the user's applications for the same normalized job title have a recorded `OFFER` or `REJECTED` outcome and at least one requirement appears in two or more comparable postings. Requirements come from user-entered application data or the linked posting. `NO_RESPONSE`, `WITHDRAWN`, and in-progress applications are not treated as positive or negative outcomes.

Suggestions describe repeated listed job requirements and recommend a checklist; they do not attribute a result to a skill or claim to predict hiring. Evidence includes only stored outcome/requirement counts. Confidence is `low`, and the user must explicitly accept or reject each suggestion. Duplicate suggestion content for a user is stored once.

The existing memory schema has no safe concept for a recommendation: its profile facts and evidence are used as user claims. Therefore the decision is persisted on the suggestion itself, and neither acceptance nor rejection changes `CareerMemoryRecord`, skills, or other career-profile data. Career Memory integration requires a future, separately designed user-owned insight type; no new memory architecture or external AI provider is introduced here.

## API

All endpoints below require `Authorization: Bearer <access-token>`.

### Applications

- `GET /api/applications/?limit=20&offset=0` — paginated list, restricted to the signed-in user. Response: `{"count": 1, "next": null, "previous": null, "results": [...]}`.
- `POST /api/applications/` — create an application. `company` and `job_title` are required; other fields are optional.
- `GET /api/applications/<id>/` — retrieve one owned application.
- `PUT/PATCH /api/applications/<id>/` — update an owned application.
- `DELETE /api/applications/<id>/` — delete an owned application.

Create example:

```http
POST /api/applications/
Content-Type: application/json
Authorization: Bearer <access-token>
```

```json
{
  "company": "Example Co",
  "job_title": "Data Analyst",
  "job_posting": 17,
  "applied_on": "2026-10-01",
  "status": "APPLIED",
  "required_skills": ["SQL", "Excel"],
  "notes": "Applied through the company site."
}
```

Update status / voluntarily record an outcome:

```json
{"status": "REJECTED", "outcome_reason": "Role filled internally"}
```

Statuses are `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`, and `NO_RESPONSE`.

### Suggestions and decisions

- `POST /api/applications/suggestions/` — evaluate the signed-in user's history and persist supported, deduplicated suggestions.
- `GET /api/applications/suggestions/` — list suggestions and their decision status.
- `POST /api/applications/suggestions/<id>/decision/` — decide a pending suggestion using `{"decision":"accepted"}` or `{"decision":"rejected"}`.

Insufficient history response:

```json
{
  "insufficient_data": true,
  "detail": "No role group has enough recorded outcomes and recurring job requirements to support a suggestion.",
  "results": []
}
```

Supported suggestion response:

```json
{
  "insufficient_data": false,
  "detail": "Suggestions are based on recorded outcomes and listed job requirements.",
  "results": [{
    "id": 4,
    "suggestion": "For Data Analyst applications, consider using a short checklist to review whether your materials address these recurring listed requirements: SQL.",
    "evidence": {
      "comparable_applications": 3,
      "supporting_observations": [
        "1 recorded offer(s) and 2 recorded rejection(s); these outcomes do not establish why they occurred.",
        "SQL was recorded as a listed requirement in 3 of 3 comparable applications."
      ]
    },
    "confidence": "low",
    "requires_user_confirmation": true,
    "status": "pending",
    "created_at": "2026-10-09T21:00:00Z"
  }]
}
```

Decision response:

```json
{"id": 4, "status": "accepted", "career_memory_updated": false}
```

## Setup and migration

No additional dependencies or environment variables are required. From `Backend/` run:

```bash
python manage.py migrate
python manage.py test tests.test_applications
```
