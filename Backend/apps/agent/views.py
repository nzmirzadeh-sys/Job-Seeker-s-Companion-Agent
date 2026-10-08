import json
import time

from django.http import StreamingHttpResponse
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Profile
from apps.agent.engine import agent_turn
from apps.agent.models import ChatMessage


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def messages_collection(request):
    if request.method == "GET":
        qs = ChatMessage.objects.filter(user=request.user)[:100]
        data = [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "tool_name": m.tool_name,
                "tool_result": m.tool_result,
                "created_at": m.created_at.isoformat(),
            }
            for m in qs
        ]
        return Response({"results": data})

    content = str((request.data or {}).get("content") or "").strip()
    if not content:
        return Response({"detail": "content required"}, status=400)
    msg = ChatMessage.objects.create(user=request.user, role="user", content=content)
    return Response({"id": msg.id, "role": "user", "content": msg.content})


def _sse(data: dict) -> str:
    return "data: " + json.dumps(data, ensure_ascii=False) + "\n\n"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_stream(request):
    """POST /api/chat/  {message, task?} → SSE stream of agent events."""
    message = str((request.data or {}).get("message") or "").strip()
    task = str((request.data or {}).get("task") or "chat")
    if not message:
        return Response({"detail": "message required"}, status=400)

    ChatMessage.objects.create(user=request.user, role="user", content=message)

    def event_stream():
        collected = []
        for event in agent_turn(request.user, message, task_hint=task):
            if event.get("type") == "assistant":
                collected.append(event.get("text", ""))
            yield _sse(event)
        if collected:
            ChatMessage.objects.create(
                user=request.user, role="assistant", content=" ".join(collected)
            )
        yield _sse({"type": "done"})

    response = StreamingHttpResponse(
        event_stream(), content_type="text/event-stream; charset=utf-8"
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def agent_feedback(request):
    """POST /api/agent/feedback/ {message} — free-text feedback recorded into
    the chat log so later turns can adapt."""
    text = str((request.data or {}).get("message") or "").strip()
    if text:
        ChatMessage.objects.create(
            user=request.user, role="user", content="[بازخورد] " + text
        )
    return Response({"ok": True})
