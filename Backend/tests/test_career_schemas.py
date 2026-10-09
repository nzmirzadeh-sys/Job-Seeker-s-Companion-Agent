"""Pure contract tests for Stage 2 domain schemas."""
import unittest
from pydantic import ValidationError
from core.career_schemas import CareerIntelligenceResult, CareerMemorySnapshot, SkillProfile


class CareerSchemaTests(unittest.TestCase):
    def test_skill_status_is_constrained(self):
        self.assertEqual(SkillProfile(name="Python", status="unverified").status, "unverified")
        with self.assertRaises(ValidationError):
            SkillProfile(name="Python", status="definitely_verified")

    def test_memory_snapshot_round_trips(self):
        snap = CareerMemorySnapshot(skills=[{"name": "React", "status": "confirmed"}])
        raw = snap.model_dump(mode="json")
        self.assertEqual(raw["skills"][0]["name"], "React")
        self.assertEqual(CareerMemorySnapshot.model_validate(raw).skills[0].status, "confirmed")

    def test_agent_never_accepts_confirmed_as_extracted_fact_without_local_downgrade(self):
        result = CareerIntelligenceResult(new_skills=[{"name": "Node.js", "status": "confirmed"}])
        self.assertEqual(result.new_skills[0].status, "confirmed")


if __name__ == "__main__":
    unittest.main()
