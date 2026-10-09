# Gemini Removal Audit

## Initial audit (before implementation)

Repository root: `HAMRAH.EXE` (Django backend, Next.js frontend, Docker Compose).
The working directory is not a Git repository. The audit searched application
source, hidden configuration, tests, and documentation while excluding virtual
environments, dependency/build outputs, caches, database/log files, and archived
ZIPs. It found **106 Gemini-related text occurrences in 13 files**.

No Gemini-related frontend call or direct Google Generative Language HTTP
request was found. No CI/CD workflow directory was present in the source
inventory. `zip/` contains historical packaged snapshots; those are not active
runtime or dependency manifests and are not inputs to the final project ZIP.

## Discovered references and required migration

| File | Reference kind | Finding / affected feature | Required action |
|---|---|---|---|
| `Backend/core/llm.py` | Runtime provider, exception mapping, provider factory, fallback | `GeminiProvider` directly imports and calls `google.genai`; the default factory prioritizes Gemini, then direct OpenAI, then a rule-based provider. | Remove Gemini and direct OpenAI provider paths; make default and explicit LLM selection require the shared OpenRouter provider; remove model-provider fallbacks. |
| `Backend/core/career_intelligence.py` | Runtime provider selection | `CareerIntelligenceAgent.analyze()` explicitly asks for `get_provider("gemini")`. | Select OpenRouter while retaining extraction, schema validation, evidence checks, and persistence gates. |
| `Backend/apps/agent/engine.py` | Runtime call path (no Gemini literal) | General authenticated agent chat uses `get_provider()` for intent routing; that default currently can select Gemini or fallback providers. | Keep its route and API behavior, but resolve only to OpenRouter and handle missing provider configuration safely. |
| `Backend/apps/agent/tools.py` | Runtime call path (no Gemini literal) | Optional LLM match explanation uses the shared default provider. | Route through OpenRouter; do not substitute another provider. |
| `Backend/apps/match/views.py` | Runtime call path (no Gemini literal) | Optional explanation resolves the default provider and currently suppresses selection failures. Job description analysis itself uses `JobAnalyzerAgent`. | Route through OpenRouter and preserve deterministic score logic; report requested explanation service failures rather than silently selecting another provider. |
| `Backend/config/settings.py` | Active runtime configuration | Reads Gemini and direct OpenAI credentials/models alongside OpenRouter; comments describe multi-provider fallback. | Remove obsolete Gemini/OpenAI runtime settings; retain centralized OpenRouter settings and timeout. |
| `Backend/.env.example` | Active environment template | Documents Gemini/OpenAI credentials and claims Career Intelligence/default callers use Gemini. | Document only OpenRouter for LLM access. |
| `docker-compose.yml` | Active deployment configuration | Passes Gemini and direct OpenAI environment variables into the backend as well as OpenRouter settings. | Remove Gemini/direct-OpenAI variables; keep OpenRouter variables. |
| `Backend/requirements.txt` | Active dependency | Declares `google-genai`; no unrelated Google Cloud package was found. | Remove the SDK after Gemini runtime code and tests are removed. |
| `Backend/core/schemas.py` | Response/example metadata | A `JobAnalysisResult` example hardcodes provider `gemini` and model `gemini-2.0-flash`. | Replace stale provider/model example metadata without changing the response schema. |
| `Backend/tests/test_job_analyzer.py` | Provider tests and mock references | Contains Gemini SDK tests, old default-provider expectations, and a secret-sanitization test for Gemini-specific error mapping. | Replace with OpenRouter-only factory and feature-routing assertions; retain OpenRouter request/error tests. |
| `Backend/tests/test_interview_api.py` | Regression test | Confirms Interview ignores a configured Gemini key. | Update the test to assert a single OpenRouter provider path without referring to removed Gemini settings. |
| `Backend/tests/test_career_intelligence.py` | Test documentation | Describes the tests as requiring no Gemini call. | Update wording and add explicit OpenRouter selection/configuration/error coverage. |
| `Backend/README.md` | Setup documentation | Says Gemini remains for Career Intelligence and default-provider agents. | Document OpenRouter as the only provider. |
| `Backend/docs/job-analyzer.md` | Feature documentation | Describes remaining Gemini configuration/SDK use. | Remove obsolete note and point to single shared OpenRouter configuration. |
| `Backend/docs/interview-agent.md` | Feature documentation | Already documents Interview's OpenRouter configuration; no Gemini dependency was identified here. | Verify and align wording with the application-wide OpenRouter-only configuration. |
| `Backend/apps/agent/views.py` | Runtime-path comment | A comment says the agent does not route directly to Gemini. | Replace provider-specific wording with the shared OpenRouter service description. |

The occurrence count covers Gemini-related matches; it is not the number of
independent code paths. The files above include multiple occurrences per
provider implementation, tests, and configuration.

## AI feature inventory and runtime traces

1. **Job Analyzer (canonical and legacy)** — `JobAnalyzerAgent` and
   `analyze_job_description()` already explicitly call
   `get_provider("openrouter")`. Keep their API/data contracts and validation.
2. **Interview Agent** — interview API and agent explicitly select OpenRouter.
   Preserve session/history behavior and response schemas.
3. **Career Intelligence** — API → `CareerIntelligenceAgent.analyze()` →
   explicit Gemini factory selection. Migrate its provider selection; preserve
   evidence validation and user-confirmation behavior.
4. **General agent chat / resume tools** — authenticated SSE API →
   `agent_turn()` → default provider → action dispatch. The provider factory
   currently permits Gemini, direct OpenAI, or rule-based responses. Require
   OpenRouter and return a controlled error if it is not configured.
5. **Job match explanation** — match API/tool → default provider only when the
   optional LLM explanation is requested. The match score and decision remain
   deterministic; explanation calls must use OpenRouter.
6. **What-if and gap-priority analysis** — call the deterministic match engine
   without an LLM provider. No direct LLM call was found; no migration is
   needed unless the traced code shows otherwise.

The runtime code paths found have no direct Gemini HTTP client outside the
shared provider. The shared OpenRouter adapter already supports chat-completion
JSON mode, schema forwarding, timeout/network/status mapping, and sanitized
provider errors; it is the integration to reuse.

## Test plan

- Shared OpenRouter configuration, default selection, missing-key behavior,
  JSON response handling, malformed response, HTTP errors, timeout, and network
  errors.
- Career Intelligence provider selection, valid/invalid output, missing key,
  and failure contract.
- General agent chat and requested match explanation route only through
  OpenRouter, while deterministic match scoring remains unchanged.
- Job Analyzer, Interview Agent, API and regression suites.
- Django system and migration checks; production frontend build and available
  frontend tests.
- Final source/config/dependency search for remaining Gemini SDK/runtime
  references, classified as historical documentation/test or active usage.

## Final search results

The post-migration search covered backend and frontend source, hidden
configuration, tests, documentation, Docker Compose, and deployment files while
excluding virtual environments, dependency/build output, caches, local
database/log files, and archived ZIPs.

- **Active provider SDK imports, Google Generative Language calls, Gemini model
  identifiers, Gemini credentials/configuration, and Gemini fallback code:
  zero matches.**
- **Direct OpenAI provider credentials, provider class, and fallback
  configuration: zero matches.**
- Every model-backed production call site now reaches `get_provider()` or
  explicitly calls `get_provider("openrouter")`; the provider factory only
  returns `OpenRouterProvider` and raises a controlled configuration error
  instead of choosing another provider.
- OpenRouter callers verified by code inspection: Career Intelligence,
  general agent chat, optional match explanations, canonical and legacy Job
  Analyzer, and Interview.
- Remaining non-runtime Google-related text includes the `google cloud` skill
  taxonomy in `Backend/core/job_evidence.py` and sample fixture data. These are
  ordinary job/skill content, not provider integrations, and were retained.
- A source search that included installed frontend dependencies also found
  Lucide's unrelated `zodiac-gemini` icon. It is vendor icon naming, not an AI
  provider, and dependency/build output is excluded from the deliverable ZIP.
- This audit and `GEMINI_REMOVAL_MIGRATION_REPORT.md` retain the provider name
  only to document the migration and historical findings. Existing archives in
  `zip/` are historical snapshots, were not modified, and are excluded from
  the deliverable ZIP.

Automated checks and test results are recorded in
`GEMINI_REMOVAL_MIGRATION_REPORT.md`.
