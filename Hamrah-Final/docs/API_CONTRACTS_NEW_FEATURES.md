# API Contracts - New Features

This document defines the API contracts for the three new features implemented in HAMRAH.EXE.

## Feature A: AI Interview Simulator

### POST /api/interview/start/

Start a new interview session for a specific job.

**Authentication:** JWT Bearer token required

**Request Body:**
```json
{
  "job_id": 123,                    // Optional: Use existing JobPosting from database
  "job_analysis": {                 // Optional: Use JobAnalysis directly (overrides job_id)
    "title": {"value": "Senior React Developer", "explicit": true, "source_text": "..."},
    "company": {"value": "Acme", "explicit": true, "source_text": "..."},
    "required_skills": [
      {"name": "React", "category": "framework", "explicit": true, "source_text": "..."}
    ],
    // ... full JobAnalysis structure from Stage 1
  },
  "persona": "مدیر فنی سخت‌گیر"     // Optional: Interviewer persona (default: "مدیر فنی سخت‌گیر")
}
```

**Response (200 OK):**
```json
{
  "session_id": 42,
  "question": {
    "question": "چگونه با React hooks کار می‌کنید؟",
    "difficulty": "medium",
    "rationale": "این سوال مهارت React مورد نیاز آگهی را تست می‌کند."
  },
  "question_number": 1,
  "max_questions": 3,
  "is_final": false
}
```

**Error Responses:**
- `400 Bad Request`: Missing job_id or job_analysis
- `404 Not Found`: JobPosting not found
- `500 Internal Server Error`: Could not load career memory
- `503 Service Unavailable`: LLM provider error (retryable)

---

### POST /api/interview/answer/

Submit an answer to the current question and receive feedback + next question.

**Authentication:** JWT Bearer token required

**Request Body:**
```json
{
  "session_id": 42,
  "answer": "من از useState و useEffect برای مدیریت state و side effects استفاده می‌کنم."
}
```

**Response (200 OK) - When more questions remain:**
```json
{
  "feedback": {
    "feedback": "پاسخ خوبی بود اما می‌توانستید دقیق‌تر باشید.",
    "strengths": ["اشاره به useState", "مثال عملی"],
    "weaknesses": ["توضیح useEffect کامل نبود"],
    "better_answer_hint": "درباره dependency array توضیح دهید."
  },
  "next_question": {
    "question": "تفاوت useReducer و useState چیست؟",
    "difficulty": "hard",
    "rationale": "این سوال درک عمیق‌تر React را می‌سنجد."
  },
  "is_complete": false,
  "summary": null,
  "question_number": 1
}
```

**Response (200 OK) - When interview is complete (after 3 questions):**
```json
{
  "feedback": {
    "feedback": "پاسخ نهایی خوب بود.",
    "strengths": ["درک صحیح Redux"],
    "weaknesses": [],
    "better_answer_hint": ""
  },
  "next_question": null,
  "is_complete": true,
  "summary": {
    "overall_feedback": "عملکرد کلی خوب بود اما به تمرین بیشتر روی TypeScript نیاز دارید.",
    "topics_to_study": ["TypeScript", "Redux Toolkit"]
  },
  "question_number": 3
}
```

**Error Responses:**
- `400 Bad Request`: Missing session_id or answer
- `400 Bad Request`: Session not active (status != "in_progress")
- `404 Not Found`: Interview session not found
- `500 Internal Server Error`: Could not load career memory
- `503 Service Unavailable`: LLM provider error (retryable)

---

### GET /api/interview/<id>/

Retrieve a complete interview session by ID.

**Authentication:** JWT Bearer token required

**URL Parameters:**
- `id`: Session ID (integer)

**Response (200 OK):**
```json
{
  "id": 42,
  "user": 5,
  "job_analysis": {
    "title": {"value": "Senior React Developer", ...},
    // ... full JobAnalysis
  },
  "persona": "مدیر فنی سخت‌گیر",
  "questions": [
    {
      "question": "چگونه با React hooks کار می‌کنید؟",
      "difficulty": "medium",
      "rationale": "..."
    },
    // ... all questions
  ],
  "answers": [
    "من از useState و useEffect استفاده می‌کنم.",
    // ... all answers
  ],
  "feedback_history": [
    {
      "feedback": "پاسخ خوبی بود...",
      "strengths": [...],
      "weaknesses": [...],
      "better_answer_hint": "..."
    },
    // ... all feedback
  ],
  "status": "done",
  "summary": {
    "overall_feedback": "عملکرد کلی خوب بود...",
    "topics_to_study": ["TypeScript", "Redux Toolkit"]
  },
  "created_at": "2026-10-08T10:30:00Z",
  "updated_at": "2026-10-08T10:35:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Interview session not found

---

## Feature B: What-If Simulator + Gap Priority

### POST /api/career/what-if/

Simulate the impact of adding hypothetical skills/certifications on job match results.

**Authentication:** JWT Bearer token required

**Request Body:**
```json
{
  "hypothetical": {
    "skills": ["SQL", "Docker"],           // Optional: Skills to add hypothetically
    "languages": ["English"],             // Optional: Languages to add hypothetically
    "certifications": ["AWS Certified"]   // Optional: Certifications to add hypothetically
  }
}
```

**Response (200 OK):**
```json
{
  "before_count": {
    "strong_match": 5,
    "good_match": 10,
    "partial_match": 0,
    "weak_match": 20,
    "not_recommended": 15,
    "needs_more_information": 0
  },
  "after_count": {
    "strong_match": 8,
    "good_match": 12,
    "partial_match": 0,
    "weak_match": 18,
    "not_recommended": 12,
    "needs_more_information": 0
  },
  "delta": {
    "strong_match": 3,
    "good_match": 2,
    "partial_match": 0,
    "weak_match": -2,
    "not_recommended": -3,
    "needs_more_information": 0
  },
  "upgraded_jobs": [
    {
      "job_analysis": {
        "title": {"value": "Senior Backend Developer", ...},
        "company": {"value": "TechCorp", ...},
        // ... full JobAnalysis
      },
      "previous_status": "weak_match",
      "new_status": "strong_match",
      "previous_score": 45,
      "new_score": 78,
      "reason": "مهارت‌های جدید (SQL, Docker) الزامات آگهی را پوشش می‌دهند."
    },
    // ... more upgraded jobs
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Could not load career memory
- `500 Internal Server Error`: Simulation failed

**Important:** This endpoint NEVER writes to Career Memory or the database. It's a read-only simulation.

---

### GET /api/career/gap-priority/

Get prioritized list of missing skills ranked by how many job opportunities they would unlock.

**Authentication:** JWT Bearer token required

**Response (200 OK):**
```json
{
  "prioritized_gaps": [
    {
      "skill": "SQL",
      "jobs_unlocked": 8,
      "sample_job_titles": ["Backend Developer", "Data Engineer", "Full Stack Developer"],
      "impact_score": 85,
      "sample_jobs": [
        {
          "title": "Backend Developer",
          "company": "TechCorp",
          "current_status": "weak_match",
          "job_analysis": {...}
        },
        // ... more sample jobs
      ]
    },
    {
      "skill": "Docker",
      "jobs_unlocked": 5,
      "sample_job_titles": ["DevOps Engineer", "Backend Developer"],
      "impact_score": 72,
      "sample_jobs": [...]
    },
    {
      "skill": "AWS",
      "jobs_unlocked": 4,
      "sample_job_titles": ["Cloud Engineer", "Backend Developer"],
      "impact_score": 65,
      "sample_jobs": [...]
    }
    // ... more gaps
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Could not load career memory
- `500 Internal Server Error`: Analysis failed

**Important:** This endpoint NEVER writes to Career Memory or the database. It's a read-only analysis.

---

## Feature C: Hidden Skill Detection + Resume Truth Guard

### POST /api/career/hidden-skill/confirm/

Confirm or reject a hidden skill suggestion from the career intelligence agent.

**Authentication:** JWT Bearer token required

**Request Body:**
```json
{
  "skill_name": "Signal Processing",
  "accept": true                           // true to accept, false to reject
}
```

**Response (200 OK) - When accepted:**
```json
{
  "status": "confirmed",
  "skill": "Signal Processing"
}
```

**Response (200 OK) - When rejected:**
```json
{
  "status": "rejected",
  "skill": "Signal Processing"
}
```

**Error Responses:**
- `400 Bad Request`: skill_name is required
- `401 Unauthorized`: Could not load career memory
- `500 Internal Server Error`: Confirmation failed

**Important:** Hidden skills are inferred from project/experience descriptions and are NOT automatically added to Career Memory. They require explicit user confirmation via this endpoint.

---

### GET /api/resumes/<id>/truth-report/

Get a truth report for a resume, showing which claims are verified vs unsupported.

**Authentication:** JWT Bearer token required

**URL Parameters:**
- `id`: Resume ID (integer)

**Response (200 OK):**
```json
{
  "resume_id": 7,
  "truth_report": [
    {
      "claim_text": "3 years",
      "claim_type": "quantitative",
      "status": "verified",
      "evidence_ref": {
        "type": "experience",
        "title": "Developer",
        "company": "TechCorp"
      },
      "context": "Developer"
    },
    {
      "claim_text": "90% improvement",
      "claim_type": "percentage",
      "status": "unsupported",
      "evidence_ref": null,
      "suggestion": "لطفاً شواهدی برای این ادعا ارائه کنید",
      "context": ""
    },
    {
      "claim_text": "5 team members",
      "claim_type": "quantitative",
      "status": "needs_clarification",
      "evidence_ref": null,
      "suggestion": "مهارت مدیریت تیم در پروفایل شماست اما این ادعای عددی شواهد مستقیم ندارد",
      "context": "Team Lead"
    }
    // ... more claims
  ],
  "overall_truth_score": 0.72,
  "verified_claims": 8,
  "unsupported_claims": 3,
  "needs_clarification_claims": 2
}
```

**Error Responses:**
- `404 Not Found`: Resume not found
- `401 Unauthorized`: Could not load career memory
- `500 Internal Server Error`: Truth report generation failed

**Important:** Quantitative claims (numbers, percentages) without supporting evidence in Career Memory are marked as "unsupported" and should not be inserted into resumes without verification.

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All Persian text should be properly encoded in UTF-8
- Pagination may be added to list endpoints in future versions
- The interview simulator strictly enforces MAX_QUESTIONS = 3 (configurable via constant in core/interview_agent.py)
- What-If simulator NEVER writes to Career Memory (read-only simulation enforced by design)
- Gap priority analysis NEVER writes to Career Memory (read-only analysis enforced by design)
- Hidden skills require explicit user confirmation before being added to Career Memory (enforced in career_intelligence.py persist() method)
- Resume claims without evidence are marked as "unsupported" by Resume Truth Guard (enforced in apps/resumes/truth_guard.py)
