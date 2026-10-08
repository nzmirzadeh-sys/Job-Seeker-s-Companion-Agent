from django.urls import path

from apps.agent import views

urlpatterns = [
    path("messages/", views.messages_collection, name="chat_messages"),
    path("analyze-job/", views.analyze_job, name="analyze_job"),
    path("", views.chat_stream, name="chat_stream"),
    path("feedback/", views.agent_feedback, name="agent_feedback"),
]
