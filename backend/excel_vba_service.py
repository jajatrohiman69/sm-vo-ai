import base64
import csv
from datetime import datetime
import io
import json
import os
import re
import uuid
import zipfile
from typing import Any
from xml.sax.saxutils import escape as xml_escape

import openpyxl
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.formatting.rule import CellIsRule, ColorScaleRule, DataBarRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

try:
    from docx import Document as DocxDocument
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    HAS_DOCX = True
except Exception:
    HAS_DOCX = False

try:
    from reportlab.lib import colors as rl_colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph,
        Preformatted,
        SimpleDocTemplate,
        Spacer,
        Table as RLTable,
        TableStyle as RLTableStyle,
    )
    HAS_REPORTLAB = True
except Exception:
    HAS_REPORTLAB = False

try:
    from oletools.olevba import VBA_Parser
    HAS_OLEVBA = True
except Exception:
    HAS_OLEVBA = False


STORAGE_DIR = os.path.join(os.path.dirname(__file__), "generated_files")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploaded_files")
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
UPLOAD_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
IMAGE_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


EXCEL_VBA_BUILDER_INSTRUCTIONS = """
============================================================
INSTRUKSI KHUSUS: GENERATOR ARTIFACT LENGKAP (.XLSX PRO, .BAS, .DOCX, .PDF, SCRIPT, .ZIP)
============================================================
Sistem Solusi Macro VHQ mendukung kompilasi otomatis berbagai artifact siap unduh:
1. **Excel Workbook (`.xlsx`)**: Jika merancang atau memperbaiki struktur Sheet Excel, SERTAKAN blok ` ```excel-spec ... ``` ` dengan JSON valid. Anda dapat memakai fitur pro seperti `title`, `subtitle`, `kpi_cards`, `column_formats` (`currency`/`percent`/`number`/`date`/`text`), `validations` (dropdown), `conditional_rules` (`data_bar`/`color_scale`), dan `charts` (`bar`/`line`/`pie`).
2. **Macro VBA (`.bas`)**: Jika ada kode Macro VBA, WAJIB tulis lengkap di dalam blok ` ```vba ... ``` ` (dengan `Option Explicit` dan `Sub ... End Sub`).
3. **Script & Data (`.py`, `.gs`, `.sql`, `.csv`, `.json`, `.html`)**: Blok kode Python (` ```python `), Google Apps Script (` ```gs `), SQL (` ```sql `), CSV (` ```csv `), atau HTML (` ```html `) otomatis dikompilasi menjadi file terpisah.
4. **Dokumen Resmi (`.docx` & `.pdf`)**: Laporan, SOP, proposal, atau analisis terstruktur otomatis dikonversi menjadi dokumen Word (`.docx`) dan PDF (`.pdf`), serta dibundel dalam `.zip` bila menghasilkan beberapa file.

Contoh `excel-spec` Pro:
```excel-spec
{
  "filename": "Sistem_Otomasi_SolusiMacro.xlsx",
  "sheets": [
    {
      "name": "Data_Transaksi",
      "title": "LAPORAN TRANSAKSI & KPI PENJUALAN",
      "subtitle": "Dibuat otomatis oleh Solusi Macro Virtual HQ",
      "kpi_cards": [
        {"label": "Total Omzet", "value": "=SUM(G7:G8)"},
        {"label": "Total Qty", "value": "=SUM(D7:D8)"}
      ],
      "headers": ["ID", "Tanggal", "Produk", "Qty", "Harga", "Status", "Total"],
      "column_formats": ["text", "date", "text", "number", "currency", "text", "currency"],
      "rows": [
        ["TRX-001", "2026-11-01", "Paket Dashboard UMKM", 2, 1500000, "Lunas", "=D7*E7"],
        ["TRX-002", "2026-11-02", "Otomasi Macro Stok", 1, 2500000, "Pending", "=D8*E8"]
      ],
      "validations": [
        {"column": 6, "values": ["Lunas", "Pending", "Batal"]}
      ],
      "conditional_rules": [
        {"column": 7, "rule": "data_bar"}
      ],
      "charts": [
        {"type": "bar", "title": "Omzet per Produk", "label_col": 3, "data_col": 7, "position": "I6"}
      ]
    }
  ]
}
```
Pastikan JSON di dalam ` ```excel-spec ` valid (tanda kutip ganda standar, formula diawali `=`).
"""


def needs_excel_vba_builder(text: str) -> bool:
    t = (text or "").lower()
    keywords = (
        "excel",
        "xlsx",
        "xlsm",
        "csv",
        "vba",
        "macro",
        "makro",
        "spreadsheet",
        "rumus",
        "formula",
        "xlookup",
        "vlookup",
        "sumifs",
        "sheet",
        "workbook",
        "userform",
        "template excel",
        "buatkan tabel",
        "buat tabel",
        "generate artifact",
        "buatkan artifact",
    )
    return any(k in t for k in keywords)


def needs_document_artifacts(text: str) -> bool:
    t = (text or "").lower()
    keywords = (
        "docx",
        "word",
        "pdf",
        "cetak",
        "ekspor dokumen",
        "export dokumen",
        "download dokumen",
        "unduh dokumen",
        "buatkan dokumen",
        "buat dokumen",
        "buatkan sop",
        "buat sop",
        "buatkan proposal",
        "buat proposal",
        "buatkan laporan",
        "buat laporan",
        "buatkan kontrak",
        "file laporan",
        "file sop",
        "file proposal",
        "generate artifact",
        "buatkan artifact",
    )
    return any(k in t for k in keywords)


def needs_code_artifacts(text: str) -> bool:
    t = (text or "").lower()
    keywords = (
        "python",
        ".py",
        "apps script",
        ".gs",
        "sql",
        "csv",
        "html",
        "json",
        "script",
        "skrip",
        "buatkan kode",
        "buat kode",
        "generate artifact",
        "buatkan artifact",
        "ekspor",
        "export",
        "download",
        "unduh",
    )
    return any(k in t for k in keywords)


def parse_uploaded_file(
    filename: str,
    content_bytes: bytes,
    content_type: str = "",
) -> dict[str, Any]:
    """
    Membedah file yang diupload Founder:
    - Excel (.xlsx, .xlsm): Ekstrak daftar sheet, header, sampel data, daftar formula, sel error (#REF!, #VALUE!, dll), dan kode Macro VBA (jika .xlsm).
    - CSV / TXT / BAS / CLS: Ekstrak struktur tabel atau kode VBA mentah.
    - Gambar (.png, .jpg, .jpeg, .webp): Konversi ke Base64 Data URL untuk dianalisis oleh Vision AI.
    """
    safe_name = os.path.basename(filename or "uploaded_file")
    ext = os.path.splitext(safe_name)[1].lower()
    file_id = uuid.uuid4().hex
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    with open(saved_path, "wb") as f:
        f.write(content_bytes)

    # 1. IMAGE FILES (PNG, JPG, WEBP, GIF)
    if ext in (".png", ".jpg", ".jpeg", ".webp", ".gif") or content_type.startswith("image/"):
        mime = content_type if content_type.startswith("image/") else "image/jpeg"
        if ext == ".png":
            mime = "image/png"
        elif ext == ".webp":
            mime = "image/webp"
        b64 = base64.b64encode(content_bytes).decode("ascii")
        data_url = f"data:{mime};base64,{b64}"
        return {
            "file_id": file_id,
            "filename": safe_name,
            "kind": "image",
            "mime_type": mime,
            "size_bytes": len(content_bytes),
            "image_data_url": data_url,
            "extracted_text": (
                f"[LAMPIRAN GAMBAR: {safe_name} ({len(content_bytes) // 1024} KB)]\n"
                "Founder melampirkan gambar ini untuk dipelajari (bisa berupa screenshot error Excel/VBA, "
                "sketsa tabel/dashboard, atau laporan yang perlu dikonversi menjadi file Excel/VBA)."
            ),
        }

    # 2. EXCEL FILES (.XLSX, .XLSM, .XLTX, .XLTM)
    if ext in (".xlsx", ".xlsm", ".xltx", ".xltm"):
        summary_lines = [
            f"============================================================",
            f"ANALISIS FILE EXCEL YANG DIUPLOAD: {safe_name}",
            f"Ukuran File: {len(content_bytes):,} bytes",
            f"============================================================",
        ]
        try:
            wb_formula = openpyxl.load_workbook(
                io.BytesIO(content_bytes), data_only=False
            )
            wb_val = openpyxl.load_workbook(
                io.BytesIO(content_bytes), data_only=True
            )
            sheet_names = wb_formula.sheetnames
            summary_lines.append(f"Jumlah Sheet ({len(sheet_names)}): {', '.join(sheet_names)}")

            for sname in sheet_names[:8]:
                ws_f = wb_formula[sname]
                ws_v = wb_val[sname]
                max_r = ws_f.max_row or 0
                max_c = ws_f.max_column or 0
                summary_lines.append(
                    f"\n--- SHEET: '{sname}' (Baris: {max_r}, Kolom: {max_c}) ---"
                )

                formulas_found: list[str] = []
                errors_found: list[str] = []
                sample_rows: list[str] = []

                scan_r = min(max_r, 40)
                scan_c = min(max_c, 18)

                for r in range(1, scan_r + 1):
                    row_cells = []
                    for c in range(1, scan_c + 1):
                        coord = f"{get_column_letter(c)}{r}"
                        f_val = ws_f.cell(r, c).value
                        v_val = ws_v.cell(r, c).value

                        if isinstance(f_val, str) and f_val.startswith("="):
                            if len(formulas_found) < 40:
                                formulas_found.append(
                                    f"  - Sel {coord}: Formula `{f_val}` => Nilai saat ini: `{v_val}`"
                                )
                        if isinstance(v_val, str) and any(
                            err in v_val
                            for err in ("#REF!", "#NAME?", "#VALUE!", "#N/A", "#DIV/0!", "#NUM!", "#NULL!")
                        ):
                            errors_found.append(
                                f"  - ERROR di Sel {coord}: `{v_val}` (Formula: `{f_val}`)"
                            )

                        display_cell = (
                            f"{f_val} [={v_val}]"
                            if isinstance(f_val, str) and f_val.startswith("=") and v_val is not None
                            else str(f_val if f_val is not None else "")
                        )
                        row_cells.append(display_cell[:45])

                    if any(cell.strip() for cell in row_cells) and len(sample_rows) < 20:
                        sample_rows.append(f"  Baris {r}: | " + " | ".join(row_cells) + " |")

                if sample_rows:
                    summary_lines.append("Sampel Isi Tabel (20 baris pertama):")
                    summary_lines.extend(sample_rows)
                if formulas_found:
                    summary_lines.append(f"\nDaftar Formula Terdeteksi di Sheet '{sname}':")
                    summary_lines.extend(formulas_found)
                if errors_found:
                    summary_lines.append(f"\n⚠️ SEL ERROR TERDETEKSI DI SHEET '{sname}':")
                    summary_lines.extend(errors_found)

        except Exception as exc:
            summary_lines.append(f"Catatan pembacaan openpyxl: {exc}")

        # Ekstrak Macro VBA jika file .xlsm atau memiliki vbaProject.bin
        if HAS_OLEVBA:
            try:
                vba_parser = VBA_Parser(filename=safe_name, data=content_bytes)
                if vba_parser.detect_vba_macros():
                    summary_lines.append(
                        "\n============================================================"
                    )
                    summary_lines.append("KODE MACRO VBA YANG DITEMUKAN DI DALAM FILE:")
                    summary_lines.append(
                        "============================================================"
                    )
                    for (_, _, vba_filename, vba_code) in vba_parser.extract_all_macros():
                        clean_code = (vba_code or "").strip()
                        if clean_code:
                            summary_lines.append(
                                f"\n### Modul VBA: `{vba_filename}`\n```vba\n{clean_code[:6000]}\n```"
                            )
                vba_parser.close()
            except Exception:
                pass

        return {
            "file_id": file_id,
            "filename": safe_name,
            "kind": "excel",
            "mime_type": content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "size_bytes": len(content_bytes),
            "extracted_text": "\n".join(summary_lines),
        }

    # 3. CSV / TSV / BAS / CLS / VBA / TXT FILES
    text_content = content_bytes.decode("utf-8", errors="replace")
    if ext == ".csv":
        reader = csv.reader(io.StringIO(text_content))
        rows = list(reader)
        preview_lines = [
            f"============================================================",
            f"FILE CSV YANG DIUPLOAD: {safe_name} (Total Baris: {len(rows)})",
            f"============================================================",
        ]
        for idx, r in enumerate(rows[:30], start=1):
            preview_lines.append(f"Baris {idx}: | " + " | ".join(r[:18]) + " |")
        return {
            "file_id": file_id,
            "filename": safe_name,
            "kind": "csv",
            "mime_type": "text/csv",
            "size_bytes": len(content_bytes),
            "extracted_text": "\n".join(preview_lines),
        }

    return {
        "file_id": file_id,
        "filename": safe_name,
        "kind": "code_or_text",
        "mime_type": content_type or "text/plain",
        "size_bytes": len(content_bytes),
        "extracted_text": (
            f"============================================================\n"
            f"FILE LAMPIRAN ({safe_name}):\n"
            f"============================================================\n"
            f"{text_content[:12000]}"
        ),
    }


def save_upload_metadata(upload: dict[str, Any]) -> None:
    file_id = str(upload.get("file_id") or "")
    if not UPLOAD_ID_PATTERN.fullmatch(file_id):
        raise ValueError("ID file upload tidak valid.")

    metadata = {
        key: value
        for key, value in upload.items()
        if key != "image_data_url"
    }
    metadata_path = os.path.join(UPLOAD_DIR, f"{file_id}.json")
    with open(metadata_path, "w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False)


def load_upload_metadata(file_id: str) -> dict[str, Any] | None:
    if not UPLOAD_ID_PATTERN.fullmatch(file_id):
        return None

    metadata_path = os.path.join(UPLOAD_DIR, f"{file_id}.json")
    if not os.path.isfile(metadata_path):
        return None

    with open(metadata_path, encoding="utf-8") as file:
        metadata = json.load(file)
    return metadata if isinstance(metadata, dict) else None


def get_uploaded_image_data_url(file_id: str) -> str | None:
    metadata = load_upload_metadata(file_id)
    if not metadata or metadata.get("kind") != "image":
        return None

    for extension, mime_type in IMAGE_MIME_TYPES.items():
        image_path = os.path.join(UPLOAD_DIR, f"{file_id}{extension}")
        if os.path.isfile(image_path):
            with open(image_path, "rb") as file:
                encoded_image = base64.b64encode(file.read()).decode("ascii")
            return f"data:{mime_type};base64,{encoded_image}"
    return None


def _save_artifact_bytes(
    raw_filename: str,
    content_bytes: bytes,
    kind: str,
    description: str = "",
) -> dict[str, Any]:
    clean_fname = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", raw_filename) or f"artifact.{kind}"
    unique_fname = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:5]}_{clean_fname}"
    full_path = os.path.join(STORAGE_DIR, unique_fname)
    with open(full_path, "wb") as f:
        f.write(content_bytes)
    return {
        "filename": clean_fname,
        "stored_name": unique_fname,
        "kind": kind,
        "size_bytes": len(content_bytes),
        "description": description,
        "download_path": f"/files/download/{unique_fname}",
    }


def _parse_cell_value(val: Any) -> Any:
    if not isinstance(val, str):
        return val
    stripped = val.strip()
    if stripped.startswith("="):
        return stripped
    cleaned_num = stripped.replace(",", "")
    if re.fullmatch(r"-?\d+", cleaned_num):
        try:
            return int(cleaned_num)
        except Exception:
            return val
    if re.fullmatch(r"-?\d+\.\d+", cleaned_num):
        try:
            return float(cleaned_num)
        except Exception:
            return val
    return val


def _apply_column_format(cell: Any, col_fmt: str | None, parsed_val: Any) -> None:
    fmt = (col_fmt or "").lower().strip()
    if fmt == "currency":
        cell.number_format = '"Rp" #,##0'
        cell.alignment = Alignment(horizontal="right", vertical="center")
    elif fmt == "percent":
        cell.number_format = "0.0%"
        cell.alignment = Alignment(horizontal="right", vertical="center")
    elif fmt == "decimal":
        cell.number_format = "#,##0.00"
        cell.alignment = Alignment(horizontal="right", vertical="center")
    elif fmt == "date":
        cell.number_format = "yyyy-mm-dd"
        cell.alignment = Alignment(horizontal="center", vertical="center")
    elif fmt == "number":
        cell.number_format = "#,##0"
        cell.alignment = Alignment(horizontal="right", vertical="center")
    elif isinstance(parsed_val, (int, float)):
        cell.number_format = "#,##0"
        cell.alignment = Alignment(horizontal="right", vertical="center")
    else:
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)


def build_xlsx_from_spec(spec: dict[str, Any], fallback_prefix: str = "SolusiMacro") -> dict[str, Any]:
    """
    Membangun file .xlsx profesional menggunakan openpyxl dari spesifikasi JSON agent.
    Mendukung title/subtitle banner, KPI cards, column_formats, freeze panes,
    auto-filter, zebra striping, data validation dropdown, conditional formatting, dan charts.
    """
    wb = openpyxl.Workbook()
    sheets_data = spec.get("sheets") or []
    if sheets_data:
        wb.remove(wb.active)

    banner_fill = PatternFill(start_color="1E1B4B", end_color="1E1B4B", fill_type="solid")
    banner_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="CBD5E1")
    kpi_label_fill = PatternFill(start_color="EEF2FF", end_color="EEF2FF", fill_type="solid")
    kpi_label_font = Font(name="Calibri", size=9, bold=True, color="4338CA")
    kpi_val_font = Font(name="Calibri", size=12, bold=True, color="0F172A")

    header_fill = PatternFill(start_color="3B3754", end_color="3B3754", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    total_fill = PatternFill(start_color="F3E8FF", end_color="F3E8FF", fill_type="solid")
    total_font = Font(name="Calibri", size=11, bold=True, color="1E1B4B")
    regular_font = Font(name="Calibri", size=11, color="18181B")
    formula_font = Font(name="Calibri", size=11, bold=True, color="0F766E")

    thin_side = Side(border_style="thin", color="D4D4D8")
    cell_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    for idx, s_info in enumerate(sheets_data):
        raw_title = str(s_info.get("name") or f"Sheet_{idx + 1}")
        clean_title = re.sub(r"[\\/*?:\[\]]", "_", raw_title)[:31] or f"Sheet_{idx + 1}"
        ws = wb.create_sheet(title=clean_title)

        headers = s_info.get("headers") or []
        rows = s_info.get("rows") or []
        col_formats = s_info.get("column_formats") or []
        sheet_title = str(s_info.get("title") or "").strip()
        sheet_subtitle = str(s_info.get("subtitle") or "").strip()
        kpi_cards = s_info.get("kpi_cards") or []
        max_cols = max(len(headers), max((len(r) for r in rows), default=0), 4)

        current_row = 1

        if sheet_title:
            ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=max_cols)
            tcell = ws.cell(row=current_row, column=1, value=sheet_title)
            tcell.fill = banner_fill
            tcell.font = banner_font
            tcell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
            ws.row_dimensions[current_row].height = 28
            current_row += 1

            if sheet_subtitle:
                ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=max_cols)
                scell = ws.cell(row=current_row, column=1, value=sheet_subtitle)
                scell.fill = banner_fill
                scell.font = subtitle_font
                scell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
                ws.row_dimensions[current_row].height = 18
                current_row += 1

            current_row += 1

        if kpi_cards and isinstance(kpi_cards, list):
            for k_idx, card in enumerate(kpi_cards[:6]):
                col_pos = k_idx * 2 + 1
                if not isinstance(card, dict):
                    continue
                lbl_cell = ws.cell(row=current_row, column=col_pos, value=str(card.get("label") or "KPI"))
                lbl_cell.fill = kpi_label_fill
                lbl_cell.font = kpi_label_font
                lbl_cell.border = cell_border
                lbl_cell.alignment = Alignment(horizontal="center", vertical="center")

                val_cell = ws.cell(row=current_row + 1, column=col_pos, value=_parse_cell_value(card.get("value", "")))
                val_cell.font = kpi_val_font
                val_cell.border = cell_border
                val_cell.alignment = Alignment(horizontal="center", vertical="center")
                if isinstance(val_cell.value, (int, float)) or (
                    isinstance(val_cell.value, str) and val_cell.value.startswith("=")
                ):
                    val_cell.number_format = "#,##0"
            ws.row_dimensions[current_row].height = 18
            ws.row_dimensions[current_row + 1].height = 24
            current_row += 3

        header_row = current_row if headers else None
        if headers:
            for c_idx, h_text in enumerate(headers, start=1):
                cell = ws.cell(row=header_row, column=c_idx, value=str(h_text))
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                cell.border = cell_border
            ws.row_dimensions[header_row].height = 26
            current_row += 1

        data_start_row = current_row
        for r_offset, row_vals in enumerate(rows):
            r_num = data_start_row + r_offset
            is_total_row = any(
                isinstance(v, str) and "total" in v.lower() for v in row_vals
            )
            for c_idx, val in enumerate(row_vals, start=1):
                parsed_val = _parse_cell_value(val)
                cell = ws.cell(row=r_num, column=c_idx, value=parsed_val)
                cell.border = cell_border

                if is_total_row:
                    cell.fill = total_fill
                    cell.font = total_font
                else:
                    if r_offset % 2 == 1:
                        cell.fill = zebra_fill
                    if isinstance(parsed_val, str) and parsed_val.startswith("="):
                        cell.font = formula_font
                    else:
                        cell.font = regular_font

                col_fmt = col_formats[c_idx - 1] if c_idx - 1 < len(col_formats) else None
                _apply_column_format(cell, col_fmt, parsed_val)

        data_end_row = data_start_row + max(len(rows) - 1, 0)

        # Freeze panes & AutoFilter
        if header_row is not None:
            freeze_target = s_info.get("freeze_panes")
            if freeze_target is not False:
                ws.freeze_panes = str(freeze_target) if isinstance(freeze_target, str) else f"A{header_row + 1}"
            if s_info.get("auto_filter", True) and len(headers) > 0:
                last_col_letter = get_column_letter(len(headers))
                ws.auto_filter.ref = f"A{header_row}:{last_col_letter}{max(data_end_row, header_row)}"

        # Data validations (dropdowns)
        for dv_spec in s_info.get("validations") or []:
            if not isinstance(dv_spec, dict) or not rows:
                continue
            col_num = int(dv_spec.get("column") or 1)
            values_list = dv_spec.get("values") or []
            if values_list and col_num >= 1:
                formula_str = '"' + ",".join(str(v).replace('"', "'") for v in values_list) + '"'
                dv = DataValidation(type="list", formula1=formula_str, allow_blank=True)
                ws.add_data_validation(dv)
                col_l = get_column_letter(col_num)
                dv.add(f"{col_l}{data_start_row}:{col_l}{data_end_row}")

        # Conditional formatting
        for cf_spec in s_info.get("conditional_rules") or []:
            if not isinstance(cf_spec, dict) or not rows:
                continue
            col_num = int(cf_spec.get("column") or 1)
            rule_type = str(cf_spec.get("rule") or "").lower()
            col_l = get_column_letter(col_num)
            cell_range = f"{col_l}{data_start_row}:{col_l}{data_end_row}"
            try:
                if rule_type == "data_bar":
                    ws.conditional_formatting.add(
                        cell_range,
                        DataBarRule(start_type="min", end_type="max", color="4F46E5"),
                    )
                elif rule_type == "color_scale":
                    ws.conditional_formatting.add(
                        cell_range,
                        ColorScaleRule(
                            start_type="min", start_color="FEE2E2",
                            mid_type="percentile", mid_value=50, mid_color="FEF3C7",
                            end_type="max", end_color="DCFCE7",
                        ),
                    )
                elif rule_type == "contains" and cf_spec.get("text"):
                    fill_hex = str(cf_spec.get("fill") or "DCFCE7")
                    font_hex = str(cf_spec.get("color") or "166534")
                    ws.conditional_formatting.add(
                        cell_range,
                        CellIsRule(
                            operator="equal",
                            formula=[f'"{cf_spec["text"]}"'],
                            fill=PatternFill(start_color=fill_hex, end_color=fill_hex, fill_type="solid"),
                            font=Font(color=font_hex, bold=True),
                        ),
                    )
            except Exception:
                pass

        # Charts
        for ch_idx, ch_spec in enumerate(s_info.get("charts") or []):
            if not isinstance(ch_spec, dict) or not rows or header_row is None:
                continue
            try:
                ch_type = str(ch_spec.get("type") or "bar").lower()
                chart = LineChart() if ch_type == "line" else PieChart() if ch_type == "pie" else BarChart()
                chart.title = str(ch_spec.get("title") or "Grafik Ringkasan")
                chart.style = 10
                chart.width = 16
                chart.height = 9

                data_col = int(ch_spec.get("data_col") or 2)
                label_col = int(ch_spec.get("label_col") or 1)
                data_ref = Reference(ws, min_col=data_col, min_row=header_row, max_row=data_end_row)
                cats_ref = Reference(ws, min_col=label_col, min_row=data_start_row, max_row=data_end_row)
                chart.add_data(data_ref, titles_from_data=True)
                chart.set_categories(cats_ref)

                default_pos = f"{get_column_letter(len(headers) + 2)}{header_row + ch_idx * 18}"
                ws.add_chart(chart, str(ch_spec.get("position") or default_pos))
            except Exception:
                pass

        # Auto-fit lebar kolom
        for col in ws.columns:
            max_len = 10
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.row == 1 and sheet_title:
                    continue
                if sheet_subtitle and cell.row == 2:
                    continue
                val_str = str(cell.value or "")
                if len(val_str) > max_len:
                    max_len = min(len(val_str), 42)
            ws.column_dimensions[col_letter].width = max_len + 5

        ws.views.sheetView[0].showGridLines = True

    if not wb.sheetnames:
        ws = wb.active
        ws.title = "SolusiMacro_Output"
        ws["A1"] = "Solusi Macro Virtual HQ"

    raw_fname = str(spec.get("filename") or f"{fallback_prefix}.xlsx")
    if not raw_fname.lower().endswith(".xlsx"):
        raw_fname += ".xlsx"

    buf = io.BytesIO()
    wb.save(buf)
    sheet_count = len(wb.sheetnames)
    return _save_artifact_bytes(
        raw_filename=raw_fname,
        content_bytes=buf.getvalue(),
        kind="xlsx",
        description=f"Workbook Excel ({sheet_count} sheet)",
    )


def build_csv_from_spec(spec: dict[str, Any], fallback_prefix: str = "SolusiMacro") -> dict[str, Any] | None:
    sheets_data = spec.get("sheets") or []
    if not sheets_data:
        return None
    first_sheet = sheets_data[0]
    headers = first_sheet.get("headers") or []
    rows = first_sheet.get("rows") or []
    if not headers and not rows:
        return None

    output = io.StringIO()
    writer = csv.writer(output)
    if headers:
        writer.writerow([str(h) for h in headers])
    for r in rows:
        writer.writerow([str(c) for c in r])

    base_name = os.path.splitext(str(spec.get("filename") or fallback_prefix))[0]
    return _save_artifact_bytes(
        raw_filename=f"{base_name}.csv",
        content_bytes=output.getvalue().encode("utf-8-sig"),
        kind="csv",
        description="Data tabel format CSV (UTF-8)",
    )


def _strip_md_inline(text: str) -> str:
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    return cleaned.strip()


def _clean_markdown_for_document(markdown_text: str) -> str:
    text = re.sub(r"<!--\s*VHQ_ARTIFACTS:[\s\S]*?-->", "", markdown_text or "")
    text = re.sub(r"```excel-spec[\s\S]*?```", "", text, flags=re.IGNORECASE)
    return text.strip()


def build_docx_from_markdown(
    markdown_text: str,
    title: str = "Dokumen Solusi Macro VHQ",
    fallback_prefix: str = "SolusiMacro_Dokumen",
) -> dict[str, Any] | None:
    if not HAS_DOCX:
        return None

    doc = DocxDocument()
    for sec in doc.sections:
        sec.top_margin = Inches(0.8)
        sec.bottom_margin = Inches(0.8)
        sec.left_margin = Inches(0.85)
        sec.right_margin = Inches(0.85)

    title_p = doc.add_heading(title, level=0)
    title_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    meta_p = doc.add_paragraph(
        f"Solusi Macro Virtual HQ  •  Dibuat otomatis pada {datetime.now().strftime('%d %b %Y, %H:%M')}"
    )
    meta_run = meta_p.runs[0]
    meta_run.font.size = Pt(9)
    meta_run.font.color.rgb = RGBColor(100, 116, 139)

    clean_md = _clean_markdown_for_document(markdown_text)
    lines = clean_md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # Code block
        if stripped.startswith("```"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            if code_lines:
                p = doc.add_paragraph("\n".join(code_lines))
                for run in p.runs:
                    run.font.name = "Consolas"
                    run.font.size = Pt(8.5)
                    run.font.color.rgb = RGBColor(30, 41, 59)
            continue

        # Markdown table
        if stripped.startswith("|") and stripped.endswith("|") and len(stripped) > 2:
            tbl_rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[:\-]+", c or "-") for c in cells):
                    tbl_rows.append([_strip_md_inline(c) for c in cells])
                i += 1
            if tbl_rows:
                col_count = max(len(r) for r in tbl_rows)
                table = doc.add_table(rows=len(tbl_rows), cols=col_count)
                table.style = "Table Grid"
                for r_idx, row_cells in enumerate(tbl_rows):
                    for c_idx in range(col_count):
                        val = row_cells[c_idx] if c_idx < len(row_cells) else ""
                        cell = table.cell(r_idx, c_idx)
                        cell.text = val
                        if r_idx == 0:
                            shading = OxmlElement("w:shd")
                            shading.set(qn("w:fill"), "3B3754")
                            cell._tc.get_or_add_tcPr().append(shading)
                            for p in cell.paragraphs:
                                for run in p.runs:
                                    run.bold = True
                                    run.font.color.rgb = RGBColor(255, 255, 255)
                                    run.font.size = Pt(9.5)
                        else:
                            for p in cell.paragraphs:
                                for run in p.runs:
                                    run.font.size = Pt(9.5)
                doc.add_paragraph("")
            continue

        # Headings
        if stripped.startswith("### "):
            doc.add_heading(_strip_md_inline(stripped[4:]), level=3)
        elif stripped.startswith("## "):
            doc.add_heading(_strip_md_inline(stripped[3:]), level=2)
        elif stripped.startswith("# "):
            doc.add_heading(_strip_md_inline(stripped[2:]), level=1)
        elif re.match(r"^[-*•]\s+", stripped):
            item = re.sub(r"^[-*•]\s+", "", stripped)
            doc.add_paragraph(_strip_md_inline(item), style="List Bullet")
        elif re.match(r"^\d+\.\s+", stripped):
            item = re.sub(r"^\d+\.\s+", "", stripped)
            doc.add_paragraph(_strip_md_inline(item), style="List Number")
        elif stripped == "---":
            doc.add_paragraph("_" * 50)
        else:
            p = doc.add_paragraph(_strip_md_inline(stripped))
            for run in p.runs:
                run.font.size = Pt(10.5)
        i += 1

    buf = io.BytesIO()
    doc.save(buf)
    return _save_artifact_bytes(
        raw_filename=f"{fallback_prefix}.docx",
        content_bytes=buf.getvalue(),
        kind="docx",
        description="Dokumen Word siap edit (.docx)",
    )


def build_pdf_from_markdown(
    markdown_text: str,
    title: str = "Dokumen Solusi Macro VHQ",
    fallback_prefix: str = "SolusiMacro_Dokumen",
) -> dict[str, Any] | None:
    if not HAS_REPORTLAB:
        return None

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "VHQTitle",
        parent=styles["Heading1"],
        fontSize=16,
        leading=20,
        textColor=rl_colors.HexColor("#1E1B4B"),
        spaceAfter=4,
    )
    meta_style = ParagraphStyle(
        "VHQMeta",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=rl_colors.HexColor("#64748B"),
        spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        "VHQH2",
        parent=styles["Heading2"],
        fontSize=12.5,
        leading=16,
        textColor=rl_colors.HexColor("#1E3A8A"),
        spaceBefore=10,
        spaceAfter=4,
    )
    h3_style = ParagraphStyle(
        "VHQH3",
        parent=styles["Heading3"],
        fontSize=11,
        leading=14,
        textColor=rl_colors.HexColor("#334155"),
        spaceBefore=8,
        spaceAfter=3,
    )
    body_style = ParagraphStyle(
        "VHQBody",
        parent=styles["Normal"],
        fontSize=9.8,
        leading=14,
        textColor=rl_colors.HexColor("#1E293B"),
        spaceAfter=4,
    )
    code_style = ParagraphStyle(
        "VHQCode",
        parent=styles["Code"],
        fontSize=8,
        leading=10.5,
        backColor=rl_colors.HexColor("#F1F5F9"),
        borderPadding=6,
    )

    story: list[Any] = [
        Paragraph(xml_escape(title), title_style),
        Paragraph(
            xml_escape(f"Solusi Macro Virtual HQ  •  {datetime.now().strftime('%d %b %Y, %H:%M')}"),
            meta_style,
        ),
    ]

    clean_md = _clean_markdown_for_document(markdown_text)
    lines = clean_md.splitlines()
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if not stripped:
            i += 1
            continue

        if stripped.startswith("```"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i][:105])
                i += 1
            i += 1
            if code_lines:
                story.append(Preformatted("\n".join(code_lines), code_style))
                story.append(Spacer(1, 5))
            continue

        if stripped.startswith("|") and stripped.endswith("|") and len(stripped) > 2:
            tbl_rows: list[list[Any]] = []
            while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[:\-]+", c or "-") for c in cells):
                    tbl_rows.append([Paragraph(xml_escape(_strip_md_inline(c)), body_style) for c in cells])
                i += 1
            if tbl_rows:
                col_count = max(len(r) for r in tbl_rows)
                norm_rows = [r + [""] * (col_count - len(r)) for r in tbl_rows]
                col_width = (A4[0] - 36 * mm) / max(col_count, 1)
                tbl = RLTable(norm_rows, colWidths=[col_width] * col_count, repeatRows=1)
                tbl.setStyle(RLTableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), rl_colors.HexColor("#3B3754")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, rl_colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.append(tbl)
                story.append(Spacer(1, 6))
            continue

        if stripped.startswith("### "):
            story.append(Paragraph(xml_escape(_strip_md_inline(stripped[4:])), h3_style))
        elif stripped.startswith("## "):
            story.append(Paragraph(xml_escape(_strip_md_inline(stripped[3:])), h2_style))
        elif stripped.startswith("# "):
            story.append(Paragraph(xml_escape(_strip_md_inline(stripped[2:])), title_style))
        elif re.match(r"^[-*•]\s+", stripped):
            item = re.sub(r"^[-*•]\s+", "", stripped)
            story.append(Paragraph(f"• {xml_escape(_strip_md_inline(item))}", body_style))
        elif re.match(r"^\d+\.\s+", stripped):
            story.append(Paragraph(xml_escape(_strip_md_inline(stripped)), body_style))
        elif stripped == "---":
            story.append(Spacer(1, 6))
        else:
            story.append(Paragraph(xml_escape(_strip_md_inline(stripped)), body_style))
        i += 1

    doc.build(story)
    return _save_artifact_bytes(
        raw_filename=f"{fallback_prefix}.pdf",
        content_bytes=buf.getvalue(),
        kind="pdf",
        description="Dokumen PDF siap cetak/bagikan",
    )


def _extract_code_and_data_artifacts(markdown_text: str, prefix: str) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    lang_map = {
        "python": ("py", "Script Python (.py)"),
        "py": ("py", "Script Python (.py)"),
        "gs": ("gs", "Google Apps Script (.gs)"),
        "appsscript": ("gs", "Google Apps Script (.gs)"),
        "gas": ("gs", "Google Apps Script (.gs)"),
        "sql": ("sql", "Query / Skema SQL (.sql)"),
        "csv": ("csv", "Data CSV (.csv)"),
        "html": ("html", "Halaman / Laporan HTML (.html)"),
        "json": ("json", "Data / Konfigurasi JSON (.json)"),
    }
    fence_pattern = re.compile(r"```([a-zA-Z0-9_-]+)\s*([\s\S]*?)```")
    counters: dict[str, int] = {}

    for raw_lang, raw_code in fence_pattern.findall(markdown_text or ""):
        lang = raw_lang.lower().strip()
        code = (raw_code or "").strip()
        if len(code) < 40:
            continue
        if lang in ("excel-spec", "vba", "vb"):
            continue
        if lang in ("javascript", "js") and any(
            kw in code for kw in ("SpreadsheetApp", "DocumentApp", "GmailApp", "DriveApp", "onOpen(")
        ):
            ext, desc = "gs", "Google Apps Script (.gs)"
        elif lang in lang_map:
            ext, desc = lang_map[lang]
        else:
            continue

        if ext == "json":
            try:
                json.loads(code)
            except Exception:
                continue

        counters[ext] = counters.get(ext, 0) + 1
        suffix = f"_{counters[ext]}" if counters[ext] > 1 else ""
        artifacts.append(
            _save_artifact_bytes(
                raw_filename=f"{prefix}{suffix}.{ext}",
                content_bytes=code.encode("utf-8"),
                kind=ext,
                description=desc,
            )
        )
    return artifacts


def _build_zip_bundle(files: list[dict[str, Any]], prefix: str) -> dict[str, Any] | None:
    if len(files) < 2:
        return None
    buf = io.BytesIO()
    seen_names: set[str] = set()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for item in files:
            fpath = os.path.join(STORAGE_DIR, item["stored_name"])
            if not os.path.isfile(fpath):
                continue
            arc_name = item["filename"]
            if arc_name in seen_names:
                arc_name = f"{len(seen_names)}_{arc_name}"
            seen_names.add(arc_name)
            zf.write(fpath, arcname=arc_name)
    return _save_artifact_bytes(
        raw_filename=f"{prefix}_Bundle.zip",
        content_bytes=buf.getvalue(),
        kind="zip",
        description=f"Paket lengkap ({len(seen_names)} file artifact)",
    )


def _extract_markdown_tables_as_spec(markdown_text: str, prefix: str) -> dict[str, Any] | None:
    """
    Fallback pintar: jika agent tidak menulis blok ```excel-spec, tetapi menulis tabel Markdown,
    otomatis ekstrak tabel Markdown tersebut menjadi sheet Excel (.xlsx)!
    """
    lines = (markdown_text or "").splitlines()
    tables: list[list[list[str]]] = []
    current_table: list[list[str]] = []

    for line in lines:
        s = line.strip()
        if s.startswith("|") and s.endswith("|") and len(s) > 2:
            cells = [c.strip() for c in s.strip("|").split("|")]
            if all(re.fullmatch(r"[:\-]+", c or "-") for c in cells):
                continue
            current_table.append(cells)
        else:
            if len(current_table) >= 2:
                tables.append(current_table)
            current_table = []

    if len(current_table) >= 2:
        tables.append(current_table)

    if not tables:
        return None

    sheets = []
    for idx, tbl in enumerate(tables[:6], start=1):
        headers = tbl[0]
        rows = tbl[1:]
        sheets.append({
            "name": f"Tabel_Data_{idx}",
            "headers": headers,
            "rows": rows,
        })

    return {
        "filename": f"{prefix}_Workbook.xlsx",
        "sheets": sheets,
    }


def extract_and_compile_artifacts(
    markdown_text: str,
    prefix: str = "SolusiMacro",
    force_excel_if_table: bool = False,
    force_documents: bool = False,
    auto_extract_code: bool = True,
    document_title: str | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Memindai output Markdown dari AI Agent dan mengompilasi semua artifact siap unduh:
    1. `.xlsx` (dari `excel-spec` atau fallback tabel Markdown)
    2. `.bas` (dari blok `vba` / `vb`)
    3. `.py`, `.gs`, `.sql`, `.csv`, `.html`, `.json` (dari blok kode/data terkait)
    4. `.docx` & `.pdf` (untuk laporan/SOP/proposal atau deliverable terstruktur)
    5. `.zip` bundle otomatis bila dihasilkan >= 2 artifact
    """
    if not markdown_text:
        return markdown_text, []

    safe_prefix = re.sub(r"[^a-zA-Z0-9_\-]", "_", prefix).strip("_") or "SolusiMacro"
    generated_files: list[dict[str, Any]] = []
    cleaned_markdown = markdown_text

    # 1. Cari blok ```excel-spec ... ```
    spec_pattern = re.compile(r"```excel-spec\s*([\s\S]*?)```", re.IGNORECASE)
    spec_matches = spec_pattern.findall(markdown_text)

    for raw_json in spec_matches:
        try:
            spec_obj = json.loads(raw_json.strip())
            if isinstance(spec_obj, dict) and spec_obj.get("sheets"):
                compiled = build_xlsx_from_spec(spec_obj, fallback_prefix=safe_prefix)
                generated_files.append(compiled)
        except Exception:
            continue

    cleaned_markdown = spec_pattern.sub("", cleaned_markdown).strip()

    # Fallback tabel Markdown -> Excel (.xlsx)
    if not any(f["kind"] == "xlsx" for f in generated_files) and force_excel_if_table:
        fallback_spec = _extract_markdown_tables_as_spec(cleaned_markdown, prefix=safe_prefix)
        if fallback_spec:
            try:
                compiled = build_xlsx_from_spec(fallback_spec, fallback_prefix=safe_prefix)
                generated_files.append(compiled)
            except Exception:
                pass

    # 2. Cari blok ```vba ... ``` atau ```vb ... ```
    vba_pattern = re.compile(r"```(?:vba|vb)\s*([\s\S]*?)```", re.IGNORECASE)
    vba_matches = vba_pattern.findall(markdown_text)

    if vba_matches:
        combined_vba_parts = [
            'Attribute VB_Name = "SolusiMacro_Automation"\r\n'
            "' ============================================================\r\n"
            "' Modul Macro VBA — Dihasilkan oleh Solusi Macro Virtual HQ\r\n"
            f"' Tanggal: {datetime.now().strftime('%Y-%m-%d %H:%M')}\r\n"
            "' Cara Pakai: Buka Excel -> Tekan Alt+F11 -> File -> Import File\r\n"
            "' ============================================================\r\n"
        ]
        for idx, code_block in enumerate(vba_matches, start=1):
            clean_code = code_block.strip().replace("\r\n", "\n").replace("\n", "\r\n")
            combined_vba_parts.append(f"\r\n' --- [ Bagian Macro #{idx} ] ---\r\n{clean_code}\r\n")

        full_vba_content = "\r\n".join(combined_vba_parts)
        generated_files.append(
            _save_artifact_bytes(
                raw_filename=f"{safe_prefix}_Macro.bas",
                content_bytes=full_vba_content.encode("utf-8"),
                kind="bas",
                description="Modul Macro VBA (Import via Alt+F11)",
            )
        )

    # 3. Ekstrak blok kode & data (.py, .gs, .sql, .csv, .html, .json) bila diminta/diaktifkan
    if auto_extract_code:
        generated_files.extend(_extract_code_and_data_artifacts(cleaned_markdown, prefix=safe_prefix))

    # 4. Dokumen resmi (.docx & .pdf) hanya jika diminta eksplisit (force_documents=True)
    if force_documents:
        doc_title = document_title or safe_prefix.replace("_", " ")
        try:
            docx_file = build_docx_from_markdown(
                cleaned_markdown, title=doc_title, fallback_prefix=safe_prefix
            )
            if docx_file:
                generated_files.append(docx_file)
        except Exception:
            pass
        try:
            pdf_file = build_pdf_from_markdown(
                cleaned_markdown, title=doc_title, fallback_prefix=safe_prefix
            )
            if pdf_file:
                generated_files.append(pdf_file)
        except Exception:
            pass

    # 5. Bundle ZIP jika >= 2 file
    zip_bundle = _build_zip_bundle(generated_files, prefix=safe_prefix)
    if zip_bundle:
        generated_files.append(zip_bundle)

    # 6. Sisipkan metadata terstruktur + fallback markdown links
    if generated_files:
        icon_map = {
            "xlsx": "📊",
            "bas": "⚙️",
            "docx": "📝",
            "pdf": "📄",
            "py": "🐍",
            "gs": "📜",
            "sql": "🗄️",
            "csv": "📑",
            "html": "🌐",
            "json": "🔧",
            "zip": "📦",
        }
        download_section = [
            "\n\n---",
            "### 📦 Artifact & File Kerja Siap Unduh",
            "Sistem Solusi Macro VHQ telah merakit file siap pakai dari hasil di atas:",
        ]
        for gf in generated_files:
            icon = icon_map.get(gf["kind"], "📎")
            size_kb = max(1, round((gf.get("size_bytes") or 0) / 1024))
            desc = gf.get("description") or gf["kind"].upper()
            download_section.append(
                f"- {icon} [**{gf['filename']}**](/api/backend{gf['download_path']}) — {desc} ({size_kb} KB)"
            )
        artifacts_json = json.dumps(generated_files, ensure_ascii=False)
        cleaned_markdown = (
            cleaned_markdown
            + "\n"
            + "\n".join(download_section)
            + f"\n\n<!-- VHQ_ARTIFACTS:{artifacts_json} -->"
        )

    return cleaned_markdown, generated_files
