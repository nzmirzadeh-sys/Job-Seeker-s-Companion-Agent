# System Architecture

HAMRAH.EXE follows a staged career-copilot architecture.

```text
                         User
                           │
                           ▼
                  Agent Runtime / API
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   Job Analyzer     Career Intelligence   Match / Decision
          │                │                │
          ▼                ▼                │
      JobAnalysis     Memory Service        │
                           │                │
                           ▼                ▼
                     Career Memory ────────┘
                           │
                           ▼
                        Database
```

### Agent vs Service vs Memory

**Agent** means bounded reasoning/extraction behavior. Current agents are Job Analyzer, Career Intelligence, and Match / Decision.

**Service** means controlled application access. `MemoryService` is responsible for user-scoped reads/writes around Career Memory.

**Career Memory** is shared infrastructure and the source of truth for candidate facts. It is not an agent.

### Stage 1 boundary

`raw job description → JobAnalysisResult`.

The Job Analyzer owns extraction and evidence verification. It does not access candidate memory and does not decide fit.

### Stage 2 boundary

`user message → CareerIntelligenceResult → MemoryService → Career Memory`.

The extraction layer is not allowed to turn a user statement into a confirmed fact silently.

### Stage 3 boundary

`JobAnalysis + Career Memory → MatchResult`.

The Match Agent reads Career Memory through `MemoryService`. It does not mutate Career Memory and does not query its database tables directly.

### User isolation

All Career Memory records are rooted at a one-to-one relationship with the authenticated user. API views instantiate `MemoryService(request.user)`, so each read is scoped to that user's root memory record.

### Future-stage contract

Stage 4 can consume `JobAnalysis`, the Career Memory snapshot, and `MatchResult` without reverse-engineering the matching logic.
