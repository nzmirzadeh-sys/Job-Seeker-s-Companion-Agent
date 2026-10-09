# API Reference

All protected endpoints use the existing JWT authentication. No endpoint returns provider credentials or internal exception text.

## Stage 1

`POST /api/chat/analyze-job/`

Request:

```json
{"description":"<raw job description>"}
```

Returns `job_analysis` or a controlled error.

## Stage 2

### `POST /api/career/analyze/`

```json
{"message":"من با Python و React کار کرده‌ام."}
```

Returns the structured Career Intelligence result and a persistence summary.

### `GET /api/career/memory/`

Returns a user-scoped `CareerMemorySnapshot`, plus convenience arrays `verified_skills` and `skills_needing_clarification`.

### `GET /api/career/skills/`

Optional query parameter: `status`.

### `POST /api/career/skills/`

Supported actions:

- `add`
- `confirm`
- `reject`

Example confirmation:

```json
{"name":"React","action":"confirm","level":"advanced","years_of_experience":3}
```

## Stage 3

### `POST /api/match/analyze/`

Preferred input:

```json
{
  "job_analysis": {"job": {"required_skills": [], "preferred_skills": []}}
}
```

The server also accepts a direct JobAnalysis object under `job_analysis`.

For existing Stage 1 job-feed data, a convenience `job_id` adapter is supported:

```json
{"job_id":123}
```

Optional explanation flag:

```json
{"job_id":123,"explain_with_llm":true}
```

The optional LLM is narration-only. It cannot modify the deterministic score or decision.
