# Job Analyzer

The current Job Analyzer and the backward-compatible
`analyze_job_description()` interface use the shared OpenRouter provider. Both
retain their existing data contracts and local validation/evidence checks.
Configure the backend with:

- `OPENROUTER_API_KEY` (required)
- `OPENROUTER_BASE_URL` (optional; defaults to `https://openrouter.ai/api/v1`)
- `OPENROUTER_MODEL` (optional; selects the model, with a backend default when
  unset)

The model is requested to return JSON. The canonical analyzer validates the
response against `JobAnalysis`, makes at most one retry for malformed output,
then verifies claims against the original job description. Provider/network
failures are returned as controlled errors; no rule-based or fabricated
analysis is substituted.

## API contract

`POST /api/chat/analyze-job/` accepts:

```json
{"description": "The original job description"}
```

The successful response remains an envelope:

```json
{
  "job_analysis": {
    "job": {"title": null, "required_skills": []},
    "warnings": [],
    "analyzer_version": "job-analyzer/1",
    "provider": "openrouter",
    "model": "configured-model"
  }
}
```

The `job` object contains the complete canonical `JobAnalysis` fields; the
shortened object above only illustrates the response envelope. Validation and
input/provider errors retain the existing `{error: {code, message, retryable}}`
response structure. REST and agent/SSE tool flows share the same analyzer.

Both Job Analyzer interfaces use the same OpenRouter-only provider as the rest
of the application. No provider fallback is performed.
