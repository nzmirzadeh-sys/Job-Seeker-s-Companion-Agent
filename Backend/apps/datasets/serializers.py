import csv
from io import StringIO
import json
from pathlib import PurePosixPath

from rest_framework import serializers

from apps.datasets.models import Dataset

MAX_DATASET_SIZE = 10 * 1024 * 1024


class DatasetSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True, required=True)

    class Meta:
        model = Dataset
        fields = (
            "id",
            "name",
            "file",
            "original_filename",
            "file_format",
            "file_size",
            "row_count",
            "columns",
            "created_at",
        )
        read_only_fields = (
            "id",
            "original_filename",
            "file_format",
            "file_size",
            "row_count",
            "columns",
            "created_at",
        )

    def validate_file(self, uploaded_file):
        suffix = PurePosixPath(uploaded_file.name).suffix.lower()
        if suffix not in {".csv", ".json"}:
            raise serializers.ValidationError("فقط فایل‌های CSV و JSON پذیرفته می‌شوند.")
        if uploaded_file.size > MAX_DATASET_SIZE:
            raise serializers.ValidationError("حداکثر حجم فایل دیتاست ۱۰ مگابایت است.")

        try:
            content = uploaded_file.read().decode("utf-8-sig")
        except (UnicodeDecodeError, AttributeError):
            raise serializers.ValidationError("فایل باید با UTF-8 ذخیره شده باشد.")
        finally:
            uploaded_file.seek(0)

        if suffix == ".csv":
            try:
                reader = csv.reader(StringIO(content, newline=""), strict=True)
                columns = next(reader, [])
                if not columns or not any(column.strip() for column in columns):
                    raise serializers.ValidationError("فایل CSV باید ردیف عنوان ستون‌ها را داشته باشد.")
                if any(not column.strip() for column in columns):
                    raise serializers.ValidationError("عنوان ستون‌های CSV نباید خالی باشد.")
                row_count = sum(1 for row in reader if row)
            except csv.Error as exc:
                raise serializers.ValidationError(f"فایل CSV معتبر نیست: {exc}")
        else:
            try:
                records = json.loads(content)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(f"فایل JSON معتبر نیست: {exc.msg}")
            if not isinstance(records, list) or any(not isinstance(row, dict) for row in records):
                raise serializers.ValidationError("ساختار JSON باید آرایه‌ای از رکوردها باشد.")
            columns = list(dict.fromkeys(key for row in records for key in row))
            row_count = len(records)

        self._parsed_file = {
            "columns": columns,
            "row_count": row_count,
            "file_format": suffix[1:],
        }
        return uploaded_file

    def create(self, validated_data):
        uploaded_file = validated_data["file"]
        parsed = self._parsed_file
        return Dataset.objects.create(
            **validated_data,
            original_filename=uploaded_file.name[:255],
            file_format=parsed["file_format"],
            file_size=uploaded_file.size,
            row_count=parsed["row_count"],
            columns=parsed["columns"],
        )
