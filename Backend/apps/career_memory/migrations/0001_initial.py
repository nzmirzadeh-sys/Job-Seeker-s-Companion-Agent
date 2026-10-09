from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="CareerMemoryRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(blank=True, max_length=255)),
                ("headline", models.CharField(blank=True, max_length=300)),
                ("summary", models.TextField(blank=True, null=True)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone", models.CharField(blank=True, max_length=40)),
                ("location", models.CharField(blank=True, max_length=120)),
                ("websites", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="career_memory", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="CareerGoal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(max_length=200)), ("industry", models.CharField(blank=True, max_length=200)),
                ("direction", models.CharField(blank=True, max_length=300)),
                ("priority", models.CharField(choices=[("primary", "Primary"), ("secondary", "Secondary"), ("unknown", "Unknown")], default="unknown", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="goals", to="career_memory.careermemoryrecord")),
            ],
        ),
        migrations.CreateModel(
            name="Constraint",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("category", models.CharField(max_length=80)), ("value", models.CharField(max_length=300)),
                ("hard", models.BooleanField(default=False)), ("created_at", models.DateTimeField(auto_now_add=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="constraints", to="career_memory.careermemoryrecord")),
            ],
        ),
        migrations.CreateModel(
            name="Education",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("degree", models.CharField(max_length=200)), ("field", models.CharField(blank=True, max_length=200)),
                ("school", models.CharField(blank=True, max_length=200)), ("graduation_year", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="education_records", to="career_memory.careermemoryrecord")),
            ],
        ),
        migrations.CreateModel(
            name="Experience",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)), ("company", models.CharField(blank=True, max_length=200)),
                ("years", models.FloatField(blank=True, null=True)), ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="experiences", to="career_memory.careermemoryrecord")),
            ],
        ),
        migrations.CreateModel(
            name="MemoryEvidence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_type", models.CharField(max_length=50)), ("object_id", models.PositiveBigIntegerField()),
                ("source", models.CharField(choices=[("user_statement", "User statement"), ("user_confirmation", "User confirmation"), ("imported_resume", "Imported resume"), ("system", "System")], default="user_statement", max_length=30)),
                ("quote", models.TextField(blank=True, null=True)),
                ("confidence", models.CharField(choices=[("certain", "Certain"), ("high", "High"), ("medium", "Medium"), ("low", "Low")], default="high", max_length=10)),
                ("recorded_at", models.DateTimeField(auto_now_add=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="evidence_items", to="career_memory.careermemoryrecord")),
            ],
        ),
        migrations.CreateModel(
            name="Preference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("category", models.CharField(max_length=80)), ("value", models.CharField(max_length=300)),
                ("priority", models.CharField(choices=[("preferred", "Preferred"), ("strong", "Strong"), ("unknown", "Unknown")], default="preferred", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="preferences", to="career_memory.careermemoryrecord")),
            ],
        ),
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)), ("role", models.CharField(blank=True, max_length=200)),
                ("technologies", models.JSONField(blank=True, default=list)), ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="projects", to="career_memory.careermemoryrecord")),
            ],
        ),
        migrations.CreateModel(
            name="Skill",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)), ("category", models.CharField(blank=True, max_length=30)),
                ("level", models.CharField(choices=[("beginner", "Beginner"), ("intermediate", "Intermediate"), ("advanced", "Advanced"), ("expert", "Expert"), ("unknown", "Unknown")], default="unknown", max_length=20)),
                ("years_of_experience", models.FloatField(blank=True, null=True)),
                ("status", models.CharField(choices=[("unverified", "Unverified"), ("needs_clarification", "Needs clarification"), ("confirmed", "Confirmed"), ("rejected", "Rejected")], default="unverified", max_length=30)),
                ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("memory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="skills", to="career_memory.careermemoryrecord")),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.AddConstraint(
            model_name="skill",
            constraint=models.UniqueConstraint(fields=("memory", "name"), name="uniq_memory_skill_name"),
        ),
        migrations.AddIndex(
            model_name="memoryevidence",
            index=models.Index(fields=["memory", "content_type", "object_id"], name="cm_evidence_memory_content_idx"),
        ),
    ]
