# Stage 1 — Job Analyzer Agent

The current implementation is in `Backend/core/job_analyzer.py`.

Boundary:

```text
raw job description
        ↓
input guard
        ↓
Gemini via core.llm
        ↓
Pydantic JobAnalysis validation
        ↓
deterministic evidence verification
        ↓
JobAnalysisResult
```

The canonical schema is `Backend/core/schemas.py`.

Important invariants:

- unknown fields remain `null` / `[]`
- evidence is stored as verbatim `source_text`
- normalization cannot silently become explicit fact
- job-description instructions are treated as untrusted data
- no Career Memory access
- no candidate-fit scoring or apply/don't-apply decision

Existing Stage 1 files were preserved rather than rewritten for Stage 3.
