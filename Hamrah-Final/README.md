# HAMRAH.EXE

HAMRAH.EXE is a Personal Career Operating System / AI Career Copilot for job seekers. The current repository contains the complete Stage 1 + Stage 2 + Stage 3 implementation.

## Current implementation

| Stage | Component | Status |
|---|---|---|
| Stage 1 | Job Analyzer Agent | Implemented |
| Stage 2 | Career Intelligence Agent | Implemented |
| Stage 2 | Career Memory + Memory Service + Evidence/Trust | Implemented |
| Stage 3 | Match / Decision Agent | Implemented |
| Stage 4 | Resume / Application Agent | Future |
| Stage 5 | Interviewer Agent | Future |

Career Memory is shared infrastructure, not an agent.

## Architecture

```text
User
  ↓
Agent Runtime / API boundary
  ├── Job Analyzer Agent ───────→ JobAnalysis
  ├── Career Intelligence Agent ─→ Career Memory
  │                                  ↑
  │                            Memory Service
  │                                  ↑
  │                            Django database
  └── Match / Decision Agent ←── JobAnalysis + Career Memory
                                ↓
                             MatchResult

Later stages can consume:
JobAnalysis + Career Memory + MatchResult → Resume / Application
```

The Stage 3 score is deterministic and transparent. A provider-backed LLM can optionally rewrite explanations, but it cannot change the numerical score, decision, skill-match statuses, or hard-constraint evaluation.

## Stage 1: Job Analyzer

The existing Job Analyzer converts a raw job description into the canonical `JobAnalysis` Pydantic schema. It preserves evidence (`source_text`), validates locally, and has a strict Gemini path for real job analysis. It does not access Career Memory or make candidate-fit decisions.

## Stage 2: Career Intelligence and Memory

Career Intelligence extracts user-stated facts and passes them through `MemoryService`. Newly extracted skills are stored as `unverified` until explicit user confirmation. Repeated/ambiguous facts can become `needs_clarification`; explicit rejection becomes `rejected`. Evidence stores the source, quote, confidence, and timestamp.

All Career Memory access is user-scoped through `MemoryService`; agents do not directly manipulate database rows.

## Stage 3: Match / Decision

`MatchDecisionAgent` compares:

- required and preferred skills
- experience requirements
- education requirements
- career goals
- preferences
- hard and soft constraints

It distinguishes confirmed matches, uncertain matches, missing verified evidence, and rejected skills. A hard constraint violation forces `not_recommended`. Unknown hard constraints force `needs_more_information`.

### Scoring

| Dimension | Weight |
|---|---:|
| Technical fit | 40 |
| Experience fit | 15 |
| Education fit | 10 |
| Career-goal fit | 10 |
| Preference fit | 10 |
| Constraint fit | 15 |
| **Total** | **100** |

Unknown values are not silently treated as confirmed matches. Required skills without confirmed evidence are exposed separately and may force `needs_more_information` when the remaining evidence otherwise yields a high score.

Decision thresholds:

- `strong_match`: 85–100 with no material uncertainty
- `good_match`: 70–84 without material uncertainty
- `partial_match`: 50–69
- `weak_match`: 30–49
- `not_recommended`: below 30 or any violated hard constraint
- `needs_more_information`: material uncertainty or unknown hard constraint

## API

Protected by the existing JWT authentication.

### Stage 1

`POST /api/chat/analyze-job/`

### Stage 2

`POST /api/career/analyze/`

`GET /api/career/memory/`

`GET/POST /api/career/skills/`

### Stage 3

`POST /api/match/analyze/`

Preferred request:

```json
{
  "job_analysis": {
    "title": null,
    "company": null,
    "seniority": null,
    "employment_type": null,
    "location": null,
    "education": null,
    "salary": null,
    "years_experience": null,
    "required_skills": [],
    "preferred_skills": [],
    "responsibilities": [],
    "qualifications": [],
    "certifications": [],
    "languages": [],
    "other_requirements": []
  },
  "explain_with_llm": false
}
```

For compatibility with the existing job feed, `job_id` can also be supplied. The server adapts the stored `JobPosting` record without invoking a second analyzer.

Response shape:

```json
{
  "match_result": {
    "overall_decision": "good_match",
    "overall_score": 76,
    "technical_fit": {"score": 32, "max_score": 40, "status": "partial", "explanation": "..."},
    "experience_fit": {"score": 15, "max_score": 15, "status": "match", "explanation": "..."},
    "education_fit": {"score": 10, "max_score": 10, "status": "match", "explanation": "..."}
  }
}
```

## Running the backend

```bash
cd Backend
python -m venv .venv
# activate the environment
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Copy `Backend/.env.example` to `Backend/.env` and fill in the server-side provider configuration as needed. Never commit `Backend/.env` or any credentials.

## Running tests

```bash
cd Backend
python manage.py test -v 2
```

Pure deterministic Stage 3/contract tests can also run without Django:

```bash
PYTHONPATH=. python -m unittest tests.test_career_schemas tests.test_match_agent -v
```

## Validation status in this packaged build

The current working environment did not contain Django/DRF/google-genai and has no outbound package-install network. Therefore the final audit reports those tests as not executable here rather than claiming they passed. The pure Pydantic + deterministic Match suite was executed successfully.

Gemini real-world validation was **not performed**. No API key was available in the execution environment, and `google-genai` was not installed.

Frontend build was not run because `node_modules` is not included and network access was unavailable for dependency installation.

## Why MemoryService stayed in core/

An alternative design (implemented in Claude version) places `MemoryService` in `apps/career_memory/services.py`. The merged project intentionally keeps it in `core/memory_service` as an informed deviation from that approach, for these reasons:

1. **Tight coupling to Django ORM**: `MemoryService` directly uses Django models (`Skill`, `Experience`, etc.). Extracting it to a pure business-logic layer would require substantial refactoring to decouple from the database layer.

2. **No runtime benefit**: Both designs achieve user isolation. The architectural purity of separating core logic from Django models doesn't translate to functional improvements for this project.

3. **Migration compatibility**: Moving `MemoryService` risks breaking existing migrations and data access patterns that have been validated.

This is a conscious design choice, not an oversight.

## Known limitations

- Career Intelligence and live Job Analyzer require a configured provider for real-world LLM extraction.
- The Stage 3 optional narration path is deliberately secondary to deterministic scoring.
- The legacy feed ranker in `apps.jobs.matching` remains in place for existing Stage 1 UI behavior; Stage 3 is the richer Career-Memory-aware decision layer.
- Stage 4 and Stage 5 are not implemented.
