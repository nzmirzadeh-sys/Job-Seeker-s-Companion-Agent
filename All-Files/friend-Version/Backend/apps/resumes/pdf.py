"""Resume PDF generation.

Primary path: WeasyPrint renders an RTL HTML template to PDF.
Fallback path: a print-ready RTL HTML page the browser can save as PDF
(used when WeasyPrint is unavailable on the host, common on Windows).
"""
from __future__ import annotations

import json

from django.conf import settings
from django.template.loader import render_to_string


def resume_to_html(resume) -> str:
    content = resume.content or {}
    context = {
        "resume": resume,
        "data": content,
        "skills": content.get("skills") or [],
        "experiences": content.get("experiences") or [],
        "projects": content.get("projects") or [],
        "educations": content.get("educations") or [],
        "links": content.get("links") or [],
        "json_data": json.dumps(content, ensure_ascii=False, indent=2),
    }
    return render_to_string("resumes/resume_pdf.html", context)


def resume_to_pdf_bytes(resume) -> tuple[bytes | None, str]:
    """Return (pdf_bytes, mode). pdf_bytes is None when only HTML is possible."""
    html = resume_to_html(resume)
    try:
        from weasyprint import HTML

        pdf = HTML(string=html, base_url=str(settings.BASE_DIR)).write_pdf()
        return pdf, "weasyprint"
    except Exception:
        return None, "html"
