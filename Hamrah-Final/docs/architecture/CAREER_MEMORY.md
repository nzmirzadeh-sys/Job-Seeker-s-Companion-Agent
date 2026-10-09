# Career Memory

Career Memory is shared infrastructure, not an agent.

Persistence is normalized across a root `CareerMemoryRecord` and the related entities:

- Skill
- Experience
- Project
- Education
- CareerGoal
- Preference
- Constraint
- MemoryEvidence

The root record is one-to-one with the authenticated user.

## Evidence

Evidence stores:

- `source`
- `quote`
- `confidence`
- `recorded_at`
- the logical `content_type` and `object_id` of the fact

The Match Agent reads these evidence objects through the snapshot returned by `MemoryService`.

## API

- `GET /api/career/memory/`
- `GET /api/career/skills/`
- `POST /api/career/skills/`
- `POST /api/career/analyze/`

No Career Memory endpoint accepts another user's record id as an access path. The authenticated request user is always the root scope.
