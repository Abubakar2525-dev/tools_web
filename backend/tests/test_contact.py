import unittest

from backend.app.contact import BUDGET_OPTIONS, SERVICE_OPTIONS, validate_contact


class ContactValidationTests(unittest.TestCase):
    def valid_payload(self) -> dict[str, str]:
        return {
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "company": "Analytical Engines",
            "service": "AI application development",
            "budget": "$25k – $50k",
            "details": "We need a dependable application for a well-defined internal workflow.",
            "website": "",
        }

    def test_valid_payload_is_normalized(self) -> None:
        data, errors = validate_contact(self.valid_payload())
        self.assertEqual(errors, {})
        self.assertEqual(data["name"], "Ada Lovelace")

    def test_invalid_fields_match_frontend_contract(self) -> None:
        data, errors = validate_contact({})
        self.assertEqual(data["name"], "")
        self.assertEqual(set(errors), {"name", "email", "service", "details"})

    def test_unknown_options_are_rejected(self) -> None:
        payload = self.valid_payload()
        payload["service"] = "Unknown service"
        payload["budget"] = "Unlimited"
        _, errors = validate_contact(payload)
        self.assertIn("service", errors)
        self.assertIn("budget", errors)

    def test_form_options_include_fallbacks(self) -> None:
        self.assertIn("Not sure yet", SERVICE_OPTIONS)
        self.assertIn("Not sure yet", BUDGET_OPTIONS)


if __name__ == "__main__":
    unittest.main()
