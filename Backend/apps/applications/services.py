import hashlib
import json
from collections import Counter, defaultdict

from apps.applications.models import ApplicationSuggestion, JobApplication
from apps.applications.serializers import ApplicationSuggestionSerializer


MIN_COMPARABLE_APPLICATIONS = 3
MIN_REQUIREMENT_FREQUENCY = 2
KNOWN_OUTCOMES = (JobApplication.Status.OFFER, JobApplication.Status.REJECTED)


def _normalize(value):
    return " ".join(str(value).casefold().split())


def _requirement_name(value):
    if isinstance(value, dict):
        value = value.get("name", "")
    if not isinstance(value, str):
        return ""
    return value.strip()


class ApplicationService:
    """Create cautious, descriptive suggestions from a user's recorded history."""

    def __init__(self, user):
        self.user = user

    def generate_suggestions(self):
        applications = (
            JobApplication.objects.filter(user=self.user, status__in=KNOWN_OUTCOMES)
            .select_related("job_posting")
            .order_by("id")
        )
        roles = defaultdict(list)
        for application in applications:
            normalized_title = _normalize(application.job_title)
            if normalized_title:
                roles[normalized_title].append(application)

        created_suggestions = []
        sufficient_evidence = False
        for comparable in roles.values():
            if len(comparable) < MIN_COMPARABLE_APPLICATIONS:
                continue

            requirements = Counter()
            display_names = {}
            for application in comparable:
                names = application.required_skills
                if not names and application.job_posting_id:
                    names = application.job_posting.required_skills
                names_for_application = set()
                for value in (names if isinstance(names, list) else []):
                    name = _requirement_name(value)
                    normalized_name = _normalize(name)
                    if normalized_name:
                        names_for_application.add(normalized_name)
                        display_names.setdefault(normalized_name, name)
                requirements.update(names_for_application)

            recurring = [
                name
                for name, count in requirements.most_common()
                if count >= MIN_REQUIREMENT_FREQUENCY
            ][:3]
            if not recurring:
                continue

            sufficient_evidence = True
            title = comparable[0].job_title.strip()
            outcomes = Counter(application.status for application in comparable)
            requirement_names = [display_names[name] for name in recurring]
            suggestion = (
                f"For {title} applications, consider using a short checklist to "
                "review whether your materials address these recurring listed "
                f"requirements: {', '.join(requirement_names)}."
            )
            evidence = {
                "comparable_applications": len(comparable),
                "supporting_observations": [
                    (
                        f"{outcomes[JobApplication.Status.OFFER]} recorded offer(s) "
                        f"and {outcomes[JobApplication.Status.REJECTED]} recorded "
                        "rejection(s); these outcomes do not establish why they occurred."
                    ),
                    *[
                        f"{display_names[name]} was recorded as a listed requirement "
                        f"in {requirements[name]} of {len(comparable)} comparable applications."
                        for name in recurring
                    ],
                ],
            }
            fingerprint = hashlib.sha256(
                json.dumps(
                    {"role": _normalize(title), "suggestion": suggestion},
                    sort_keys=True,
                ).encode("utf-8")
            ).hexdigest()
            suggestion_record, _ = ApplicationSuggestion.objects.get_or_create(
                user=self.user,
                fingerprint=fingerprint,
                defaults={
                    "suggestion": suggestion,
                    "evidence": evidence,
                    "confidence": "low",
                },
            )
            if suggestion_record.status == ApplicationSuggestion.Status.PENDING:
                created_suggestions.append(suggestion_record)

        return {
            "insufficient_data": not sufficient_evidence,
            "detail": (
                "No role group has enough recorded outcomes and recurring job "
                "requirements to support a suggestion."
                if not sufficient_evidence
                else (
                    "Existing suggestions already cover these observations."
                    if not created_suggestions
                    else "Suggestions are based on recorded outcomes and listed job requirements."
                )
            ),
            "results": ApplicationSuggestionSerializer(
                created_suggestions, many=True
            ).data,
        }
