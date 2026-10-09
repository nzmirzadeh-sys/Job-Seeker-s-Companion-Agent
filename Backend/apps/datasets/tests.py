from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.datasets.models import Dataset


class DatasetAPITests(TestCase):
    def setUp(self):
        self.media_dir = TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.client = APIClient()
        self.owner = User.objects.create_user(username="dataset-owner", password="password")
        self.other_user = User.objects.create_user(username="dataset-other", password="password")

    def test_upload_lists_dataset_metadata_and_persists_file(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            "/api/datasets/",
            {
                "name": "نمونه",
                "file": SimpleUploadedFile(
                    "jobs.csv",
                    b'title,company\n"Engineer\nII",Example\nDesigner,Sample\n',
                    content_type="text/csv",
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["row_count"], 2)
        self.assertEqual(response.data["columns"], ["title", "company"])
        self.assertNotIn("file", response.data)
        dataset = Dataset.objects.get(owner=self.owner)
        self.assertTrue(dataset.file.storage.exists(dataset.file.name))

    def test_dataset_list_and_detail_are_scoped_to_owner(self):
        dataset = Dataset.objects.create(
            owner=self.other_user,
            name="private",
            file=SimpleUploadedFile("private.csv", b"name\nsecret\n"),
            original_filename="private.csv",
            file_format="csv",
            file_size=12,
            row_count=1,
            columns=["name"],
        )
        self.client.force_authenticate(self.owner)

        self.assertEqual(self.client.get("/api/datasets/").data, [])
        self.assertEqual(self.client.get(f"/api/datasets/{dataset.pk}/").status_code, 404)

    def test_upload_accepts_json_record_arrays(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            "/api/datasets/",
            {
                "name": "نمونه JSON",
                "file": SimpleUploadedFile(
                    "jobs.json",
                    b'[{"title":"Engineer","company":"Example"}]',
                    content_type="application/json",
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["file_format"], "json")
        self.assertEqual(response.data["row_count"], 1)
        self.assertEqual(response.data["columns"], ["title", "company"])

    def test_upload_requires_authentication(self):
        response = self.client.post(
            "/api/datasets/",
            {"name": "sample", "file": SimpleUploadedFile("data.csv", b"name\nvalue\n")},
            format="multipart",
        )
        self.assertIn(response.status_code, (401, 403))

    def test_invalid_format_and_invalid_json_are_rejected(self):
        self.client.force_authenticate(self.owner)
        invalid_extension = self.client.post(
            "/api/datasets/",
            {"name": "bad", "file": SimpleUploadedFile("data.txt", b"name\nvalue\n")},
            format="multipart",
        )
        invalid_json = self.client.post(
            "/api/datasets/",
            {"name": "bad-json", "file": SimpleUploadedFile("data.json", b'{"not":"a list"}')},
            format="multipart",
        )

        self.assertEqual(invalid_extension.status_code, 400)
        self.assertEqual(invalid_json.status_code, 400)

    def test_delete_removes_the_uploaded_file(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            "/api/datasets/",
            {
                "name": "remove me",
                "file": SimpleUploadedFile("remove.csv", b"name\nvalue\n"),
            },
            format="multipart",
        )
        dataset = Dataset.objects.get(pk=response.data["id"])
        stored_name = dataset.file.name

        deleted = self.client.delete(f"/api/datasets/{dataset.pk}/")

        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(dataset.file.storage.exists(stored_name))
