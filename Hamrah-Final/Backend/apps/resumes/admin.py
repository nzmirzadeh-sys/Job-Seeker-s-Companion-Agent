from django.contrib import admin

from apps.resumes.models import Resume, ResumeFeedback

admin.site.register(Resume)
admin.site.register(ResumeFeedback)
