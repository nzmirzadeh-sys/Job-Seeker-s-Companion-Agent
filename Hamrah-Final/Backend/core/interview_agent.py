"""AI Interview Simulator Agent.

Generates interview questions based on job analysis and provides feedback on answers.
Questions are strictly derived from job requirements (required_skills, responsibilities).
"""
from __future__ import annotations

import json
import logging

from pydantic import ValidationError

from core.interview_schemas import (
    InterviewFeedback,
    InterviewGenerateQuestionRequest,
    InterviewGenerateQuestionResponse,
    InterviewProcessAnswerRequest,
    InterviewProcessAnswerResponse,
    InterviewQuestion,
    InterviewSummary,
)
from core.llm import BaseProvider, LLMError, LLMBadResponseError, LLMNotConfiguredError, get_provider

logger = logging.getLogger(__name__)

MAX_QUESTIONS = 3

SYSTEM_PROMPT_GENERATE = """You are an expert technical interviewer for {persona}.
Your task is to generate interview questions based strictly on the job requirements.

Rules:
1. Derive questions ONLY from the job's required_skills, preferred_skills, and responsibilities.
2. Do NOT ask generic questions like "tell me about yourself" or "what are your strengths".
3. Each question must be specific to the technical requirements listed in the job analysis.
4. Vary difficulty: early questions should be foundational, later questions more advanced.
5. Provide a clear rationale explaining which job requirement the question targets.
6. Return ONLY valid JSON matching the supplied schema.
7. Reply in Persian.

Context:
- Job Analysis: {job_analysis_json}
- User's Career Snapshot: {career_snapshot_json}
- Question {question_number} of {max_questions}
{previous_context}

Generate a question that tests understanding of a specific skill or responsibility from the job."""

SYSTEM_PROMPT_FEEDBACK = """You are an expert technical interviewer for {persona}.
Your task is to provide feedback on the user's interview answer.

Rules:
1. Evaluate the answer based on the job requirements in the job analysis.
2. Be specific: mention what was covered well and what was missing.
3. Reference the actual job requirements when identifying gaps.
4. Provide a concrete hint for a better answer.
5. Return ONLY valid JSON matching the supplied schema.
6. Reply in Persian.

Context:
- Job Analysis: {job_analysis_json}
- User's Career Snapshot: {career_snapshot_json}
- Question: {question}
- User's Answer: {answer}
- Question {question_number} of {max_questions}

Provide constructive feedback focused on the job's technical requirements."""

SYSTEM_PROMPT_SUMMARY = """You are an expert technical interviewer for {persona}.
Your task is to provide a final summary of the interview performance.

Rules:
1. Assess overall readiness for this specific job based on the answers.
2. Reference the job's requirements when identifying strengths and gaps.
3. Recommend specific topics to study based on missing skills or weak answers.
4. Return ONLY valid JSON matching the supplied schema.
5. Reply in Persian.

Context:
- Job Analysis: {job_analysis_json}
- User's Career Snapshot: {career_snapshot_json}
- All Q&A pairs: {qa_history_json}

Provide an actionable summary for improving chances with this specific job."""


class InterviewAgentError(Exception):
    MESSAGES = {
        "llm_not_configured": "The interview service is not configured.",
        "llm_error": "Interview generation failed.",
        "llm_invalid_output": "The interview agent returned an invalid result.",
        "invalid_input": "Invalid input for interview agent.",
    }
    RETRYABLE = {"llm_invalid_output"}

    def __init__(self, code: str):
        self.code = code
        self.message = self.MESSAGES.get(code, self.MESSAGES["llm_error"])
        self.retryable = code in self.RETRYABLE
        super().__init__(self.message)

    def public(self):
        return {"code": self.code, "message": self.message, "retryable": self.retryable}


def _strip_fences(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.strip("`").strip()
        if t.lower().startswith("json"):
            t = t[4:].strip()
    return t


class InterviewAgent:
    name = "interview"

    def __init__(self, provider: BaseProvider | None = None):
        self._provider = provider

    def _get_provider(self) -> BaseProvider:
        if self._provider is None:
            try:
                self._provider = get_provider("gemini")
            except LLMNotConfiguredError as exc:
                raise InterviewAgentError("llm_not_configured") from exc
        return self._provider

    def generate_question(self, request: InterviewGenerateQuestionRequest) -> InterviewGenerateQuestionResponse:
        """Generate the next interview question based on job requirements."""
        provider = self._get_provider()

        job_analysis_json = json.dumps(request.job_analysis, ensure_ascii=False)
        career_snapshot_json = json.dumps(request.career_snapshot, ensure_ascii=False)

        previous_context = ""
        if request.previous_answers:
            qa_pairs = [
                f"Q{i+1}: {qa.get('question', '')}\nA{i+1}: {qa.get('answer', '')}"
                for i, qa in enumerate(request.previous_answers)
            ]
            previous_context = "\nPrevious Q&A:\n" + "\n\n".join(qa_pairs)

        system_prompt = SYSTEM_PROMPT_GENERATE.format(
            persona=request.persona,
            job_analysis_json=job_analysis_json,
            career_snapshot_json=career_snapshot_json,
            question_number=request.question_number,
            max_questions=request.max_questions,
            previous_context=previous_context,
        )

        user_prompt = "Generate the next interview question."

        try:
            res = provider.chat(
                system_prompt,
                user_prompt,
                json_mode=True,
                response_schema=InterviewQuestion,
            )
            question = InterviewQuestion.model_validate_json(_strip_fences(res.text))
        except (LLMBadResponseError, ValidationError) as exc:
            logger.warning("interview_agent invalid question output: %s", type(exc).__name__)
            raise InterviewAgentError("llm_invalid_output") from exc
        except LLMError as exc:
            logger.warning("interview_agent provider failed: %s", type(exc).__name__)
            raise InterviewAgentError("llm_error") from exc

        is_final = request.question_number >= request.max_questions
        return InterviewGenerateQuestionResponse(question=question, is_final=is_final)

    def process_answer(self, request: InterviewProcessAnswerRequest) -> InterviewProcessAnswerResponse:
        """Process user's answer and provide feedback, optionally generating next question."""
        provider = self._get_provider()

        job_analysis_json = json.dumps(request.job_analysis, ensure_ascii=False)
        career_snapshot_json = json.dumps(request.career_snapshot, ensure_ascii=False)

        system_prompt = SYSTEM_PROMPT_FEEDBACK.format(
            persona=request.persona,
            job_analysis_json=job_analysis_json,
            career_snapshot_json=career_snapshot_json,
            question=request.question,
            answer=request.answer,
            question_number=request.question_number,
            max_questions=request.max_questions,
        )

        user_prompt = "Provide feedback on this answer."

        try:
            res = provider.chat(
                system_prompt,
                user_prompt,
                json_mode=True,
                response_schema=InterviewFeedback,
            )
            feedback = InterviewFeedback.model_validate_json(_strip_fences(res.text))
        except (LLMBadResponseError, ValidationError) as exc:
            logger.warning("interview_agent invalid feedback output: %s", type(exc).__name__)
            raise InterviewAgentError("llm_invalid_output") from exc
        except LLMError as exc:
            logger.warning("interview_agent provider failed: %s", type(exc).__name__)
            raise InterviewAgentError("llm_error") from exc

        is_complete = request.question_number >= request.max_questions

        if is_complete:
            # Generate final summary
            qa_history = request.previous_answers + [{"question": request.question, "answer": request.answer}]
            qa_history_json = json.dumps(qa_history, ensure_ascii=False)

            summary_prompt = SYSTEM_PROMPT_SUMMARY.format(
                persona=request.persona,
                job_analysis_json=job_analysis_json,
                career_snapshot_json=career_snapshot_json,
                qa_history_json=qa_history_json,
            )

            try:
                res = provider.chat(
                    summary_prompt,
                    "Generate the final interview summary.",
                    json_mode=True,
                    response_schema=InterviewSummary,
                )
                summary = InterviewSummary.model_validate_json(_strip_fences(res.text))
            except (LLMBadResponseError, ValidationError) as exc:
                logger.warning("interview_agent invalid summary output: %s", type(exc).__name__)
                summary = InterviewSummary(
                    overall_feedback="خلاصهٔ نهایی به دلیل خطا تولید نشد.",
                    topics_to_study=[],
                )
            except LLMError as exc:
                logger.warning("interview_agent provider failed for summary: %s", type(exc).__name__)
                summary = InterviewSummary(
                    overall_feedback="خلاصهٔ نهایی به دلیل خطا تولید نشد.",
                    topics_to_study=[],
                )

            return InterviewProcessAnswerResponse(
                feedback=feedback,
                next_question=None,
                is_complete=True,
                summary=summary,
            )

        # Generate next question
        next_request = InterviewGenerateQuestionRequest(
            job_analysis=request.job_analysis,
            career_snapshot=request.career_snapshot,
            persona=request.persona,
            question_number=request.question_number + 1,
            max_questions=request.max_questions,
            previous_answers=request.previous_answers + [{"question": request.question, "answer": request.answer}],
        )
        next_response = self.generate_question(next_request)

        return InterviewProcessAnswerResponse(
            feedback=feedback,
            next_question=next_response.question,
            is_complete=False,
            summary=None,
        )
