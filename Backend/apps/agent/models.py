from django.conf import settings
from django.db import models


class ChatMessage(models.Model):
    ROLES = [("user", "کاربر"), ("assistant", "ایجنت"), ("system", "سیستم")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages"
    )
    role = models.CharField(max_length=12, choices=ROLES)
    content = models.TextField()
    tool_name = models.CharField(max_length=40, blank=True)
    tool_result = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "پیام چت"
        verbose_name_plural = "پیام‌های چت"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:40]}"
