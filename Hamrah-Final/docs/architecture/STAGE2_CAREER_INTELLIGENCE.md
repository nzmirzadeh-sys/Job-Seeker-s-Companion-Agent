# Stage 2 — Career Intelligence

Stage 2 was described in the supplied Stage 2 report, but its implementation was not present in the supplied Stage 1 repository ZIP. This repository therefore reconstructs the Stage 2 architecture as a prerequisite for Stage 3, following the terminology and trust rules in the supplied report.

Implemented components:

- `Backend/core/career_schemas.py`
- `Backend/core/career_intelligence.py`
- `Backend/core/memory_service.py`
- `Backend/apps/career_memory/`

Career Intelligence extracts structured candidate facts from user messages. It does not certify them.

Newly extracted skills are stored as:

```text
unverified
```

Explicit confirmation transitions a skill to:

```text
confirmed
```

Explicit rejection transitions it to:

```text
rejected
```

Repeated/ambiguous extraction may move an existing unverified skill to:

```text
needs_clarification
```

The local trust gate also removes evidence quotes that are not actually contained in the user's message.
