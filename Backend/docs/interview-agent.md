# Interview practice API

Interview practice uses the existing Django authentication and the shared
OpenRouter provider adapter. All routes are under `/api/interview/` and require
the normal Bearer access token:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Run `python manage.py migrate` from `Backend/` when deploying this version. The
new migration adds interview type, job reference, question limit, and rubric
version fields. Existing sessions are marked `interview-legacy/0`; their saved
JSON remains readable, but legacy evaluations are excluded from progress
comparisons.

## Lifecycle

### Start

`POST /api/interview/start/`

The UI analyzes the selected job with the existing `POST /api/chat/analyze-job/`
endpoint and submits its canonical `job_analysis` alongside `job_id`. The
backend also accepts a `job_id` alone when the posting already contains
structured requirements. It accepts `technical`, `behavioral`, or `general`
and a `max_questions` value from 1 to 3.

```json
{
  "job_id": 42,
  "interview_type": "technical",
  "max_questions": 3
}
```

When supplied by the UI, `job_analysis` must be the complete canonical
`JobAnalysis` schema returned by Job Analyzer. A successful response is `201`
and includes `session_id`, the first `question`, question counts,
`interview_type`, `rubric_version`, and `memory_unavailable`.

### Submit an answer

`POST /api/interview/answer/`

```json
{
  "session_id": 123,
  "answer": "I used SQL to query and validate the data.",
  "expected_question_number": 1
}
```

The response includes criterion-level `feedback`, verbatim answer evidence,
the job `competency` assessed, an optional `next_question`, completion state,
and an optional final `summary`. The server owns rubric weighting and verifies
that cited evidence is present in the submitted answer. Answers are limited to
10,000 characters. Stale or duplicate submissions return `409`.

### Retrieve sessions and results

- `GET /api/interview/history/?limit=20&offset=0` returns `{count, results}`.
- `GET /api/interview/<session_id>/` returns the saved session and answer
  history.
- `GET /api/interview/reports/<session_id>/` returns a completed session,
  summary, question/answer/evaluation pairs, and progress; an incomplete session
  returns `400`.
- `GET /api/interview/progress/?interview_type=technical` returns descriptive
  observations only. Fewer than two compatible completed sessions are reported
  as a baseline, not a trend.

Every lookup and mutation is scoped to the authenticated user. Another user's
session is returned as `404`.

## Provider and memory behavior

Set `OPENROUTER_API_KEY` on the backend. The default base URL is
`https://openrouter.ai/api/v1`; set `OPENROUTER_BASE_URL` to override it.
`OPENROUTER_MODEL` selects the OpenRouter model; if unset, the backend uses its
configured default.
The backend sends an OpenAI-compatible chat-completions request, including JSON
mode where needed. The Pydantic validation and evidence checks remain in the
Interview Agent. Missing credentials, network timeouts, rate limits, upstream
errors, and invalid response shapes produce controlled errors without exposing
provider exception details.

Interview, Job Analyzer, Career Intelligence, general agent chat, and optional
match explanations all use the shared OpenRouter provider. No alternate
provider fallback is configured.
Interview does not write to Career Memory. Confirmed, relevant Career Memory
facts may be read for question context. `memory_unavailable` indicates that
optional Career Memory context could not be loaded; the interview can proceed
using job information.

The frontend does not use interview mocks. It sends the stored access token
through the shared API helper and displays authentication, validation, provider,
and network errors.
