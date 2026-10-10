import tempfile
import unittest
from pathlib import Path

import pentagi_key_manager as manager


class EnvFileTests(unittest.TestCase):
    def test_update_preserves_unrelated_lines_and_adds_missing_keys(self):
        original = "# config\nOPEN_AI_KEY=old\nUNCHANGED=value\n"
        updated = manager.update_env_text(original, {"OPEN_AI_KEY": "new$key", "GLM_API_KEY": "glm-secret"})
        self.assertIn("OPEN_AI_KEY='new$key'", updated)
        self.assertIn("UNCHANGED=value", updated)
        self.assertIn("GLM_API_KEY='glm-secret'", updated)

    def test_read_env_decodes_managed_quotes(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text("OPEN_AI_KEY='sk-abc'\nGLM_API_KEY=glm\n", encoding="utf-8")
            values = manager.read_env(env_file)
        self.assertEqual(values["OPEN_AI_KEY"], "sk-abc")
        self.assertEqual(values["GLM_API_KEY"], "glm")

    def test_rejects_newlines_and_credential_urls(self):
        with self.assertRaises(ValueError):
            manager.encode_env_value("secret\nnext")
        with self.assertRaises(ValueError):
            manager.validate_url("https://user:pass@example.com/v1")

    def test_serialization_never_returns_plaintext_secret(self):
        definition = manager.KEYS_BY_NAME["OPEN_AI_KEY"]
        serialized = manager.serialize_key(
            definition,
            {"OPEN_AI_KEY": "sk-super-secret-value", "OPEN_AI_SERVER_URL": "https://api.example.com/v1"},
        )
        self.assertTrue(serialized["hasValue"])
        self.assertNotIn("super-secret", str(serialized))
        self.assertEqual(serialized["serverUrl"], "https://api.example.com/v1")


if __name__ == "__main__":
    unittest.main()
