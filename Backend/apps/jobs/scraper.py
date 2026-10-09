"""Demo scraper.

Fetches a few frontend jobs from a public aggregator endpoint when available,
otherwise returns a small local batch so the demo always has a "second source".
Intentionally light: no HTML parsing, no auth, no fragile scraping — safe for a
hackathon demo.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

import requests

from config.settings import AGGREGATOR_SCRAPER

UA = {"User-Agent": "JobMatchAI/0.1 (hackathon demo; +local fallback)"}

REMOTEOK_URL = "https://remoteok.com/api"

LOCAL_FALLBACK = [
    {
        "title": "Frontend Developer (React)",
        "company": "اسنپ‌فود",
        "city": "تهران",
        "level": "junior",
        "required_skills": ["React", "JavaScript", "CSS"],
        "optional_skills": ["TypeScript"],
        "job_types": ["onsite"],
        "description": "توسعه فرانت‌اند پنل رستوران‌ها با React و Redux.",
        "url": "https://jobinja.ir",
    },
    {
        "title": "کارآموز Frontend",
        "company": "دیجی‌استایل",
        "city": "تهران",
        "level": "intern",
        "required_skills": ["HTML", "CSS", "JavaScript"],
        "optional_skills": ["React"],
        "job_types": ["onsite"],
        "description": "کارآموزی فرانت‌اند با مسیر تبدیل به استخدام کامل.",
        "url": "https://jobinja.ir",
    },
    {
        "title": "Remote React Developer",
        "company": "Avatech",
        "city": "دورکاری",
        "level": "mid",
        "required_skills": ["React", "TypeScript", "Next.js"],
        "optional_skills": ["GraphQL"],
        "job_types": ["remote"],
        "description": "Product team building analytics dashboards with Next.js.",
        "url": "https://jobguy.work",
    },
]


def _map_level(tags) -> str:
    tags_l = [str(t).lower() for t in (tags or [])]
    if any(t in tags_l for t in ("intern", "internship")):
        return "intern"
    if any(t in tags_l for t in ("junior", "entry level", "entry-level")):
        return "junior"
    if any(t in tags_l for t in ("senior", "lead", "principal")):
        return "senior"
    return "mid"


def _remoteok_fetch() -> list[dict]:
    """Fetch a handful of frontend-ish jobs from remoteok public JSON API."""
    resp = requests.get(REMOTEOK_URL, headers=UA, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    out: list[dict] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        title = str(row.get("position") or "")
        if not title:
            continue
        tags = row.get("tags") or []
        title_l = title.lower()
        if not any(
            kw in title_l or kw in [str(t).lower() for t in tags]
            for kw in ("frontend", "front-end", "react", "vue", "next.js")
        ):
            continue
        out.append(
            {
                "title": title,
                "company": str(row.get("company") or ""),
                "city": "دورکاری" if row.get("remote") else "",
                "level": _map_level(tags + [title]),
                "required_skills": [str(t) for t in tags][:6],
                "optional_skills": [],
                "job_types": ["remote" if row.get("remote") else "onsite"],
                "description": str(row.get("description") or "")[:600],
                "url": str(row.get("url") or ""),
                "source_ref": f"remoteok:{row.get('id') or title}",
            }
        )
        if len(out) >= 6:
            break
    return out


def scrape_jobs() -> tuple[list[dict], str]:
    """Return (jobs, note). Tries the configured aggregator first, then
    remoteok, then the local fallback batch."""
    # 1) custom aggregator endpoint if configured via env
    if AGGREGATOR_SCRAPER:
        try:
            resp = requests.get(AGGREGATOR_SCRAPER, headers=UA, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            jobs = data if isinstance(data, list) else data.get("jobs", [])
            if isinstance(jobs, list) and jobs:
                return jobs[:10], "از تجمیع‌کنندهٔ سفارشی دریافت شد"
        except Exception:
            pass

    # 2) remoteok public API
    try:
        jobs = _remoteok_fetch()
        if jobs:
            return jobs, "از RemoteOK (فرصت‌های بین‌المللی دورکاری) دریافت شد"
    except Exception:
        pass

    # 3) local fallback — always works offline
    picked = random.sample(LOCAL_FALLBACK, k=min(3, len(LOCAL_FALLBACK)))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    for j in picked:
        j["source_ref"] = f"local:{stamp}:{j['company']}"
    return picked, "منبع آنلاین در دسترس نبود؛ بستهٔ محلی نمایشی"
