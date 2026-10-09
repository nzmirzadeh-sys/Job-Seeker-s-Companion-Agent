"""Rule-based matching engine.

Computes a 0-100 score with a transparent breakdown so the agent (and the UI)
can explain *why* a job fits or does not fit. Used directly by the fallback
mode and as the numeric backbone for LLM-assisted explanations.
"""
from __future__ import annotations

import re

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


def _norm(text) -> str:
    """Normalize Persian/English text for robust keyword matching."""
    if not text:
        return ""
    t = str(text).translate(FA_DIGITS).lower().strip()
    t = t.replace("ي", "ی").replace("ك", "ک")
    t = re.sub(r"[\u200c\s]+", " ", t)
    return t


def _norm_list(items) -> list:
    return [_norm(i) for i in (items or []) if str(i or "").strip()]


# Synonym map so "js" also matches "javascript", "ری‌اکت" matches react, ...
_SYNONYMS_RAW = {
    "js": "javascript",
    "ts": "typescript",
    "reactjs": "react",
    "react.js": "react",
    "nextjs": "nextjs",
    "next.js": "nextjs",
    "next": "nextjs",
    "vue.js": "vue",
    "rest": "rest api",
    "restful": "rest api",
    "css3": "css",
    "html5": "html",
    "nodejs": "node",
    "node.js": "node",
    "پایتون": "python",
    "جاوااسکریپت": "javascript",
    "تایپ اسکریپت": "typescript",
    "ری اکت": "react",
    "نکست": "nextjs",
    "نکست جی اس": "nextjs",
}

SYNONYMS = {}
for _k, _v in _SYNONYMS_RAW.items():
    SYNONYMS[_norm(_k)] = _norm(_v)


def _canon(skill) -> str:
    s = _norm(skill)
    return SYNONYMS.get(s, s)


def _canon_list(items) -> list:
    return sorted({_canon(s) for s in _norm_list(items) if s})


def _level_rank(level: str) -> int:
    return {"intern": 0, "junior": 1, "mid": 2, "senior": 3}.get(_norm(level), 1)


def score_job(profile_dict: dict, job_dict: dict) -> dict:
    """Return {score, breakdown, reasons, missing_skills} for a profile/job pair.

    Weights: skills 45, role/title 25, level+experience 20, logistics 10.
    """
    p_skills = _canon_list(profile_dict.get("skills") or [])
    p_level = _norm(profile_dict.get("level") or "junior")
    p_years = float(profile_dict.get("experience_years") or 0)
    p_city = _norm(profile_dict.get("city") or "")
    remote_only = bool(profile_dict.get("remote_only"))
    p_role = _norm(profile_dict.get("target_role") or "")

    j_required = _canon_list(job_dict.get("required_skills") or [])
    j_optional = _canon_list(job_dict.get("optional_skills") or [])
    j_level = _norm(job_dict.get("level") or "")
    j_city = _norm(job_dict.get("city") or "")
    j_types = _norm_list(job_dict.get("job_types") or [])
    title_text = _norm(job_dict.get("title") or "")
    desc_text = _norm(job_dict.get("description") or "")

    reasons: list = []
    missing: list = []

    # --- skills (45) -------------------------------------------------------
    if j_required:
        hit = [s for s in p_skills if s in j_required]
        ratio = len(hit) / len(j_required)
        skill_score = round(45 * ratio)
        for s in hit:
            reasons.append(f"مهارت «{s}» از الزامات آگهی را دارید")
        missing = [s for s in j_required if s not in hit]
        if missing:
            reasons.append(
                "این مهارت‌ها الزامی است و در پروفایل شما نیست: "
                + "، ".join(missing)
            )
        # optional skills the user already has → small bonus narrative
        opt_hits = [s for s in p_skills if s in j_optional]
        if opt_hits:
            reasons.append("این مهارت‌های مزیت آگهی را هم دارید: " + "، ".join(opt_hits))
    else:
        skill_score = 30  # unknown requirements → neutral
        missing = []

    # --- role/title (25) -----------------------------------------------------
    role_score = 10  # neutral baseline
    if p_role:
        role_tokens = [t for t in p_role.split() if len(t) > 2]
        title_hit = [t for t in role_tokens if t in title_text]
        desc_hit = [t for t in role_tokens if t in desc_text]
        if title_hit:
            role_score = 25
            reasons.append("عنوان آگهی با نقش هدف شما هم‌خوانی دارد")
        elif desc_hit:
            role_score = 18
            reasons.append("نقش هدف شما در متن آگهی اشاره شده است")
        else:
            role_score = 5
            reasons.append(
                "عنوان آگهی با نقش هدف شما («%s») هم‌خوان نیست"
                % (profile_dict.get("target_role") or "")
            )

    # --- level & experience (20) ----------------------------------------------
    j_rank = _level_rank(j_level or "junior")
    p_rank = _level_rank(p_level)
    level_score = 14  # neutral
    if j_level:
        diff = j_rank - p_rank
        if diff == 0:
            level_score = 20
            reasons.append("سطح آگهی با سطح شما مطابقت دارد")
        elif diff > 0:
            level_score = max(4, 20 - 8 * diff)
            reasons.append("آگهی یک پله بالاتر از سطح شماست؛ فرصت رشد خوبی است")
        else:
            level_score = max(6, 20 - 6 * abs(diff))
            reasons.append("آگهی کمی پایین‌تر از سطح شماست")
    elif p_years >= 3 and j_rank >= 2:
        level_score = 20

    # --- logistics (10) ----------------------------------------------------------
    logi_score = 10
    if remote_only:
        if "remote" in j_types:
            logi_score = 10
            reasons.append("آگهی دورکاری است ✓")
        else:
            logi_score = 2
            reasons.append("شما فقط دورکاری می‌خواهید و این آگهی حضوری/هیبرید است")
    elif p_city and j_city:
        if p_city in j_city or j_city in p_city:
            logi_score = 10
            reasons.append("محل کار در شهر شماست")
        else:
            logi_score = 3
            reasons.append("آگهی در شهر دیگری است")

    total = int(round(skill_score + role_score + level_score + logi_score))
    return {
        "score": max(0, min(100, total)),
        "breakdown": {
            "skills": skill_score,
            "role": role_score,
            "level": level_score,
            "logistics": logi_score,
        },
        "reasons": reasons,
        "missing_skills": missing,
    }
