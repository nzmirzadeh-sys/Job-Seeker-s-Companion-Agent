"""Cross-app shared views (auth)."""
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=4)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        from apps.accounts.models import Profile

        Profile.objects.get_or_create(user=user)
        return user


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = []


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        from apps.accounts.models import Profile

        profile = Profile.objects.filter(user=self.user).first()
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
        }
        data["profile_completed"] = bool(profile and profile.completed)
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RefreshViewWithProfile(TokenRefreshView):
    """Refresh endpoint that also returns the user's profile_completed flag
    so the SPA can route correctly after a silent re-login."""
    serializer_class = TokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        data = response.data
        if isinstance(data, dict) and "access" in data:
            from rest_framework_simplejwt.tokens import AccessToken

            try:
                access = AccessToken(data["access"])
                user = User.objects.filter(id=access["user_id"]).first()
                if user:
                    from apps.accounts.models import Profile

                    profile = Profile.objects.filter(user=user).first()
                    data["profile_completed"] = bool(profile and profile.completed)
            except Exception:
                pass
        return response
