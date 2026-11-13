import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import ai_service
import excel_vba_service
from openpyxl import load_workbook


class ExcelArtifactRegressionTests(unittest.TestCase):
    def test_json_workbook_spec_is_compiled_to_xlsx(self):
        response = """Workbook:
```json
{
  "filename": "Invoice.xlsx",
  "sheets": [
    {
      "name": "Invoice",
      "headers": ["Deskripsi", "Jumlah"],
      "rows": [["Jasa", 110000]]
    }
  ]
}
```"""

        with tempfile.TemporaryDirectory() as output_dir:
            with patch.object(excel_vba_service, "STORAGE_DIR", output_dir):
                clean_response, artifacts = excel_vba_service.extract_and_compile_artifacts(
                    response,
                    prefix="Invoice",
                    force_excel_if_table=True,
                )

                self.assertEqual([artifact["kind"] for artifact in artifacts], ["xlsx"])
                self.assertNotIn("```json", clean_response)
                self.assertTrue(os.path.isfile(os.path.join(output_dir, artifacts[0]["stored_name"])))

                workbook = load_workbook(os.path.join(output_dir, artifacts[0]["stored_name"]))
                self.assertEqual(workbook["Invoice"]["A1"].value, "Deskripsi")
                self.assertEqual(workbook["Invoice"]["B2"].value, 110000)

    def test_regular_json_request_remains_a_json_artifact(self):
        response = """```json
{"settings": {"currency": "IDR", "tax_rate": 0.11}}
```"""

        with tempfile.TemporaryDirectory() as output_dir:
            with patch.object(excel_vba_service, "STORAGE_DIR", output_dir):
                _, artifacts = excel_vba_service.extract_and_compile_artifacts(
                    response,
                    prefix="Settings",
                    force_excel_if_table=True,
                    auto_extract_code=True,
                )

        self.assertEqual([artifact["kind"] for artifact in artifacts], ["json"])

    def test_invalid_json_workbook_spec_reports_that_no_xlsx_was_created(self):
        response = """```json
{"filename": "Invoice.xlsx", "sheets": [
```"""

        with tempfile.TemporaryDirectory() as output_dir:
            with patch.object(excel_vba_service, "STORAGE_DIR", output_dir):
                clean_response, artifacts = excel_vba_service.extract_and_compile_artifacts(
                    response,
                    prefix="Invoice",
                    force_excel_if_table=True,
                )

        self.assertEqual(artifacts, [])
        self.assertIn("JSON workbook tidak valid", clean_response)


class AIResponseRegressionTests(unittest.TestCase):
    def test_provider_safety_wrapper_and_reasoning_are_rejected_for_fallback(self):
        responses = {
            "first-model": (
                "<ds_safety>provider metadata</ds_safety>"
                "I'll build the workbook now.\nLet me design carefully."
            ),
            "second-model": "Berikut hasil akhirnya dalam Bahasa Indonesia.",
        }
        calls = []

        def create_completion(**kwargs):
            model = kwargs["model"]
            calls.append(model)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content=responses[model])
                    )
                ]
            )

        client = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(create=create_completion)
            )
        )
        config = {"models": [{"id": "second-model"}]}

        with (
            patch.object(ai_service, "get_ai_client", return_value=(client, "second-model")),
            patch.object(ai_service, "get_active_provider_config", return_value=config),
        ):
            content, selected_model = ai_service._chat_completion_with_fallback(
                model="first-model",
                messages=[{"role": "user", "content": "Buat workbook"}],
            )

        self.assertEqual(content, responses["second-model"])
        self.assertEqual(selected_model, "second-model")
        self.assertEqual(calls, ["first-model", "second-model"])


if __name__ == "__main__":
    unittest.main()
