from django.contrib import admin

from apps.jobs.models import JobPosting, Match

admin.site.register(JobPosting)
admin.site.register(Match)
