# Stage 3 — Match / Decision Agent

## Purpose

Answer:

> Is this job a good fit for this user, and why?

Input:

```text
JobAnalysis
+
CareerMemorySnapshot
```

Output:

```text
MatchResult
```

## Matching strategy

The canonical Stage 1 `JobAnalysis` schema remains the input contract; Stage 3 does not re-run the Job Analyzer.

The implementation is intentionally hybrid:

1. deterministic normalization and scoring
2. a small transparent alias map (`React.js` → `React`, `JS` → `JavaScript`, etc.)
3. optional LLM narration for explanation only

There is no large skills ontology and the LLM cannot invent candidate skills.

## Score model

| Dimension | Weight |
|---|---:|
| Technical | 40 |
| Experience | 15 |
| Education | 10 |
| Career goal | 10 |
| Preference | 10 |
| Constraints | 15 |
| Total | 100 |

For required skills, confirmed evidence receives full technical credit; unverified/needs-clarification receives half credit and is exposed in `uncertain_matches`; absent/rejected evidence does not become a positive match.

Unknown information is represented as `unknown` in dimension-level status rather than being silently interpreted as a positive fact.

## Hard constraints

A violated hard constraint immediately produces:

```text
overall_decision = not_recommended
```

An unknown hard constraint produces:

```text
overall_decision = needs_more_information
```

This keeps hard red lines visible instead of hiding them inside the numeric score.

## Output useful to Stage 4

`MatchResult` exposes:

- `matching_skills`
- `missing_required_skills`
- `missing_preferred_skills`
- `uncertain_matches`
- `strengths`
- `gaps`
- `risks`
- `constraints`
- `reasoning`
- `recommendation`

Stage 4 can therefore build application materials from the already-explained matching process.
