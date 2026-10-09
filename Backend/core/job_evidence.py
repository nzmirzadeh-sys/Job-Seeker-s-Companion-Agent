"""Deterministic evidence verification for Job Analyzer output.

Pure functions, no I/O, no LLM. The model output is treated as an UNTRUSTED
claim set and is checked against the ORIGINAL job description:

  * source_text must be a (whitespace/punctuation-insensitive) excerpt of the source
  * explicit=True without verifiable evidence is downgraded
  * technical skills must literally occur in the source (alias-aware) or are removed
  * salary / years are removed unless their numbers occur in the source
  * every downgrade/removal is reported in `warnings`

The checks are lexical, not semantic (see JOB_ANALYZER_IMPLEMENTATION.md §11).
"""
import re
import unicodedata
from dataclasses import dataclass

from core.schemas import TECHNICAL_CATEGORIES, JobAnalysis, SkillClaim, TextClaim

# ---------------------------------------------------------------- normalization
_FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_DROP = dict.fromkeys(map(ord, '•·●▪◦"“”‘’«»*'), None)


def normalize(text) -> str:
    t = unicodedata.normalize("NFKC", str(text or ""))
    t = t.translate(_FA_DIGITS).lower()
    t = t.replace("ي", "ی").replace("ك", "ک").translate(_DROP)
    return re.sub(r"[\u200c\u200e\u200f\s]+", " ", t).strip()


def _squash(text) -> str:
    return re.sub(r"[\W_]+", "", normalize(text))


def _loose(norm_text: str) -> str:
    return re.sub(r"[-_/]+", " ", norm_text)


# ---------------------------------------------------------------- aliases
_ALIAS_GROUPS = [
    {"javascript", "js", "ecmascript", "جاوااسکریپت"},
    {"typescript", "ts", "تایپ اسکریپت"},
    {"react", "reactjs", "react.js", "ری اکت", "ریکت"},
    {"next.js", "nextjs"},
    {"vue", "vue.js", "vuejs"},
    {"node.js", "nodejs", "node"},
    {"kubernetes", "k8s"},
    {"postgresql", "postgres"},
    {"mongodb", "mongo"},
    {"amazon web services", "aws"},
    {"google cloud", "gcp", "google cloud platform"},
    {"c#", "csharp", "c sharp"},
    {"machine learning", "ml"},
    {"ci/cd", "cicd", "ci cd"},
    {"rest api", "rest", "restful", "rest apis"},
    {"python", "پایتون"},
    {"html", "html5"},
    {"css", "css3"},
    {"scikit-learn", "sklearn", "scikit learn"},
    {"elasticsearch", "elastic search"},
]
_ALIAS_INDEX: dict[str, frozenset] = {}
for _g in _ALIAS_GROUPS:
    _fg = frozenset(normalize(a) for a in _g)
    for _a in _fg:
        _ALIAS_INDEX[_a] = _fg


def _aliases(name: str) -> frozenset:
    n = normalize(name)
    return _ALIAS_INDEX.get(n, frozenset({n}))


def _canon(name: str) -> str:
    return sorted(_aliases(name))[0]


def _contains(hay_loose: str, needle_loose: str) -> bool:
    if not needle_loose:
        return False
    return re.search(r"(?<!\w)" + re.escape(needle_loose) + r"(?![\w+#])", hay_loose) is not None


def _grounded(name: str, text_norm: str) -> bool:
    hay = _loose(text_norm)
    return any(_contains(hay, _loose(a)) for a in _aliases(name))


# ---------------------------------------------------------------- numbers
_MULT = {
    "k": 1e3, "thousand": 1e3, "هزار": 1e3,
    "m": 1e6, "mm": 1e6, "million": 1e6, "میلیون": 1e6,
    "b": 1e9, "billion": 1e9, "میلیارد": 1e9,
}
_MULT_ALT = "k|mm|m|thousand|million|billion|b|هزار|میلیون|میلیارد"
_NUM_RE = re.compile(r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(" + _MULT_ALT + r")?(?![a-z])")
_RANGE_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:-|–|—|to|تا)\s*(\d+(?:\.\d+)?)\s*(" + _MULT_ALT + r")(?![a-z])"
)
_WORD_NUMS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "twelve": 12, "fifteen": 15,
    "یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6, "هفت": 7,
    "هشت": 8, "نه": 9, "ده": 10,
}
# Persian "یک/دو/نه/ده" are ordinary words found in nearly every Persian text, so a
# spelled-out number only counts as support for a years claim when it sits right
# next to a "years" word ("five years", "دو سال").
_WORD_YEARS_RE = re.compile(
    r"(?<!\w)(" + "|".join(sorted(map(re.escape, _WORD_NUMS), key=len, reverse=True)) + r")(?!\w)"
    r"\s*\+?\s*(?:\(\s*\d+\s*\)\s*)?(?:years?|yrs?|سال)(?!\w)"
)


def source_numbers(text: str) -> set:
    t = normalize(text).replace("٬", ",").replace("٫", ".")
    out: set = set()
    for m in _NUM_RE.finditer(t):
        try:
            v = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        out.add(v)
        mult = _MULT.get(m.group(2) or "")
        if mult:
            out.add(v * mult)
    for m in _RANGE_RE.finditer(t):  # "120-150k" → both scaled
        mult = _MULT.get(m.group(3), 1)
        out.add(float(m.group(1)) * mult)
        out.add(float(m.group(2)) * mult)
    return out


def _num_in(v: float, nums: set) -> bool:
    return any(abs(v - n) <= max(1e-6, abs(n) * 1e-4) for n in nums)


# ---------------------------------------------------------------- context
@dataclass
class _Src:
    norm: str
    squashed: str
    nums: set


def _quote_found(quote, src: _Src) -> bool:
    if not quote:
        return False
    q = _squash(quote)
    return len(q) >= 3 and q in src.squashed


NAME_FIELDS = {"title", "company", "location"}
_PREF_MARKERS = ("nice to have", "nice-to-have", "preferred", "a plus", "is a plus",
                 "bonus", "desirable", "advantage", "good to have", "مزیت", "امتیاز", "ترجیحا", "ترجیحاً")
_REQ_MARKERS = ("required", "must have", "must-have", "mandatory", "essential", "الزامی", "ضروری")


# ---------------------------------------------------------------- checks
def _check_text(claim: TextClaim | None, field: str, src: _Src, warns: list):
    """Scalar/list TextClaim check."""
    if claim is None:
        return None
    ok = _quote_found(claim.source_text, src)
    if claim.source_text and not ok:
        warns.append(f"{field}: source_text not found in original; evidence discarded")
        claim = claim.model_copy(update={"source_text": None})
    if claim.explicit and not ok:
        warns.append(f"{field}: '{claim.value}' marked explicit without verifiable evidence; downgraded to inferred")
        claim = claim.model_copy(update={"explicit": False})
    if not ok:
        if field in NAME_FIELDS and _grounded(claim.value, src.norm):
            return claim
        warns.append(f"{field}: '{claim.value}' removed (no supporting evidence in source)")
        return None
    if claim.explicit and field in NAME_FIELDS and not _grounded(claim.value, normalize(claim.source_text)):
        warns.append(f"{field}: '{claim.value}' not literally in its source_text; downgraded to inferred")
        claim = claim.model_copy(update={"explicit": False})
    return claim


def _check_text_list(items, field, src, warns):
    out = []
    for c in items:
        r = _check_text(c, field, src, warns)
        if r is not None:
            out.append(r)
    return out


def _check_skills(skills: list[SkillClaim], field: str, src: _Src, warns: list):
    """Fabricated skill / technology detection."""
    kept = []
    for s in skills:
        ok = _quote_found(s.source_text, src)
        if s.source_text and not ok:
            warns.append(f"{field}: '{s.name}' source_text not found in original; evidence discarded")
            s = s.model_copy(update={"source_text": None})
        in_source = _grounded(s.name, src.norm)
        technical = s.category in TECHNICAL_CATEGORIES
        if technical and not in_source:
            warns.append(f"{field}: '{s.name}' does not occur in the source; removed as fabricated")
            continue
        if not technical and not in_source and not ok:
            warns.append(f"{field}: '{s.name}' has no supporting evidence; removed")
            continue
        if s.explicit and not (ok and _grounded(s.name, normalize(s.source_text))):
            warns.append(f"{field}: '{s.name}' marked explicit without literal evidence; downgraded to inferred")
            s = s.model_copy(update={"explicit": False})
        if ok:  # importance sanity (warning only, never reclassifies)
            q = normalize(s.source_text)
            has_pref = any(m in q for m in _PREF_MARKERS)
            has_req = any(m in q for m in _REQ_MARKERS)
            if field == "required_skills" and has_pref and not has_req:
                warns.append(f"{field}: '{s.name}' evidence reads as optional; check classification")
            if field == "preferred_skills" and has_req and not has_pref:
                warns.append(f"{field}: '{s.name}' evidence reads as mandatory; check classification")
        kept.append(s)
    return kept


def _dedupe_skills(required, preferred, warns):
    seen, req, pref = set(), [], []
    for s in required:
        k = _canon(s.name)
        if k in seen:
            warns.append(f"required_skills: duplicate '{s.name}' dropped")
            continue
        seen.add(k)
        req.append(s)
    for s in preferred:
        k = _canon(s.name)
        if k in seen:
            warns.append(f"preferred_skills: '{s.name}' already required/duplicated; dropped")
            continue
        seen.add(k)
        pref.append(s)
    return req, pref


def _check_salary(sal, src: _Src, warns):
    if sal is None:
        return None
    vals = [v for v in (sal.min_amount, sal.max_amount) if v is not None]
    if not vals:
        warns.append("salary: no amounts present; removed")
        return None
    bad = [v for v in vals if not _num_in(v, src.nums)]
    if bad:
        warns.append(f"salary: amount(s) {bad} not found in source; removed as fabricated")
        return None
    if sal.source_text and not _quote_found(sal.source_text, src):
        warns.append("salary: source_text not found in original; evidence discarded")
        sal = sal.model_copy(update={"source_text": None})
    return sal


def _check_years(y, src: _Src, warns):
    if y is None:
        return None
    vals = [v for v in (y.min_years, y.max_years) if v is not None]
    if not vals:
        warns.append("years_experience: no values present; removed")
        return None
    words = {_WORD_NUMS[m.group(1)] for m in _WORD_YEARS_RE.finditer(src.norm)}
    bad = [v for v in vals if not (0 <= v <= 60 and (_num_in(v, src.nums) or v in words))]
    if bad:
        warns.append(f"years_experience: value(s) {bad} not found in source; removed as fabricated")
        return None
    if y.source_text and not _quote_found(y.source_text, src):
        warns.append("years_experience: source_text not found in original; evidence discarded")
        y = y.model_copy(update={"source_text": None})
    return y


# ---------------------------------------------------------------- entry point
def verify_job(job: JobAnalysis, source: str) -> tuple[JobAnalysis, list]:
    """Return (verified copy, warnings). Never mutates `job`."""
    src = _Src(norm=normalize(source), squashed=_squash(source), nums=source_numbers(source))
    warns: list = []
    j = job.model_copy(deep=True)

    for f in ("title", "company", "seniority", "employment_type", "location", "education"):
        setattr(j, f, _check_text(getattr(j, f), f, src, warns))
    for f in ("responsibilities", "qualifications", "certifications", "languages", "other_requirements"):
        setattr(j, f, _check_text_list(getattr(j, f), f, src, warns))

    req = _check_skills(j.required_skills, "required_skills", src, warns)
    pref = _check_skills(j.preferred_skills, "preferred_skills", src, warns)
    j.required_skills, j.preferred_skills = _dedupe_skills(req, pref, warns)

    j.salary = _check_salary(j.salary, src, warns)
    j.years_experience = _check_years(j.years_experience, src, warns)
    return j, warns
