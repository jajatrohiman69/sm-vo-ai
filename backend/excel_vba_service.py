import base64
import csv
from datetime import datetime
import io
import json
import os
import re
import uuid
from typing import Any

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

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
INSTRUKSI KHUSUS: PEMBUATAN / PERBAIKAN FILE EXCEL (.XLSX) & MACRO VBA (.BAS)
============================================================
Jika Founder meminta pembuatan template Excel, perbaikan file Excel, pembuatan rumus/formula, atau pembuatan kode Macro VBA:

1. Berikan penjelasan analisis, perbaikan rumus, dan panduan penggunaan secara jelas.
2. Jika ada kode Macro VBA yang dibuat atau diperbaiki, WAJIB tuliskan kode lengkapnya di dalam blok kode Markdown ` ```vba ... ``` ` (lengkap dengan `Option Explicit` dan `Sub ... End Sub`). Sistem Solusi Macro VHQ akan otomatis mengonversi blok ` ```vba ` tersebut menjadi file modul `.bas` yang bisa langsung diunduh Founder.
3. Jika kamu merancang atau memperbaiki struktur Sheet Excel (tabel, data sampel, dan rumus/formula), SERTAKAN blok spesifikasi JSON di bagian akhir jawabanmu dengan format ` ```excel-spec ... ``` ` seperti contoh berikut agar sistem otomatis merakit file `.xlsx` asli untuk diunduh Founder:

```excel-spec
{
  "filename": "Sistem_Otomasi_SolusiMacro.xlsx",
  "sheets": [
    {
      "name": "Data_Transaksi",
      "headers": ["ID Transaksi", "Tanggal", "Nama Barang", "Qty", "Harga Satuan", "Total Harga"],
      "rows": [
        ["TRX-001", "2026-11-01", "Paket Dashboard UMKM", 2, 1500000, "=D2*E2"],
        ["TRX-002", "2026-11-02", "Otomasi Macro Stok", 1, 2500000, "=D3*E3"],
        ["", "", "TOTAL PENDAPATAN", "=SUM(D2:D3)", "", "=SUM(F2:F3)"]
      ]
    }
  ]
}
```
Pastikan JSON di dalam ` ```excel-spec ` valid (gunakan tanda kutip ganda standar dan formula Excel diawali `=`).
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
        "tabel",
        "template",
        "file",
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


def build_xlsx_from_spec(spec: dict[str, Any], fallback_prefix: str = "SolusiMacro") -> dict[str, str]:
    """
    Membangun file .xlsx profesional menggunakan openpyxl dari spesifikasi JSON agent.
    """
    wb = openpyxl.Workbook()
    # Hapus sheet default jika ada sheets di spec
    sheets_data = spec.get("sheets") or []
    if sheets_data:
        wb.remove(wb.active)

    header_fill = PatternFill(start_color="3B3754", end_color="3B3754", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
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

        start_row = 1
        if headers:
            for c_idx, h_text in enumerate(headers, start=1):
                cell = ws.cell(row=1, column=c_idx, value=str(h_text))
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                cell.border = cell_border
            ws.row_dimensions[1].height = 26
            start_row = 2

        for r_offset, row_vals in enumerate(rows):
            r_num = start_row + r_offset
            is_total_row = any(
                isinstance(v, str) and "total" in v.lower() for v in row_vals
            )
            for c_idx, val in enumerate(row_vals, start=1):
                # Konversi string angka menjadi float/int jika bukan formula
                parsed_val = val
                if isinstance(val, str):
                    stripped = val.strip()
                    if not stripped.startswith("="):
                        cleaned_num = stripped.replace(",", "")
                        if re.fullmatch(r"-?\d+", cleaned_num):
                            try:
                                parsed_val = int(cleaned_num)
                            except Exception:
                                parsed_val = val
                        elif re.fullmatch(r"-?\d+\.\d+", cleaned_num):
                            try:
                                parsed_val = float(cleaned_num)
                            except Exception:
                                parsed_val = val

                cell = ws.cell(row=r_num, column=c_idx, value=parsed_val)
                cell.border = cell_border

                if is_total_row:
                    cell.fill = total_fill
                    cell.font = total_font
                elif isinstance(parsed_val, str) and parsed_val.startswith("="):
                    cell.font = formula_font
                else:
                    cell.font = regular_font

                if isinstance(parsed_val, (int, float)):
                    cell.number_format = "#,##0"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

        # Auto-fit lebar kolom
        for col in ws.columns:
            max_len = 10
            col_letter = get_column_letter(col[0].column)
            for cell in col:
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
    clean_fname = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", raw_fname)
    if not clean_fname.lower().endswith(".xlsx"):
        clean_fname += ".xlsx"

    unique_fname = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:5]}_{clean_fname}"
    full_path = os.path.join(STORAGE_DIR, unique_fname)
    wb.save(full_path)

    return {
        "filename": clean_fname,
        "stored_name": unique_fname,
        "kind": "xlsx",
        "download_path": f"/files/download/{unique_fname}",
    }


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
            # Lewati baris separator |---|---|
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
) -> tuple[str, list[dict[str, str]]]:
    """
    Memindai output Markdown dari AI Agent:
    1. Mengekstrak blok ` ```excel-spec ... ``` ` (atau tabel Markdown) dan merakit file `.xlsx`.
    2. Mengekstrak blok ` ```vba ... ``` ` dan merakit file modul Macro VBA `.bas`.
    3. Menambahkan bagian '📦 FILE SIAP UNDUH' di akhir Markdown sehingga tombol download otomatis muncul di UI.
    """
    if not markdown_text:
        return markdown_text, []

    generated_files: list[dict[str, str]] = []
    cleaned_markdown = markdown_text

    # 1. Cari blok ```excel-spec ... ```
    spec_pattern = re.compile(r"```excel-spec\s*([\s\S]*?)```", re.IGNORECASE)
    spec_matches = spec_pattern.findall(markdown_text)

    for raw_json in spec_matches:
        try:
            spec_obj = json.loads(raw_json.strip())
            if isinstance(spec_obj, dict) and spec_obj.get("sheets"):
                compiled = build_xlsx_from_spec(spec_obj, fallback_prefix=prefix)
                generated_files.append(compiled)
        except Exception:
            continue

    # Hapus blok raw ```excel-spec dari tampilan Markdown agar dokumen rapi
    cleaned_markdown = spec_pattern.sub("", cleaned_markdown).strip()

    # Jika belum ada file xlsx tapi force_excel_if_table aktif dan ada tabel Markdown
    if not any(f["kind"] == "xlsx" for f in generated_files) and force_excel_if_table:
        fallback_spec = _extract_markdown_tables_as_spec(cleaned_markdown, prefix=prefix)
        if fallback_spec:
            try:
                compiled = build_xlsx_from_spec(fallback_spec, fallback_prefix=prefix)
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
        clean_bas_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", prefix) + "_Macro.bas"
        unique_bas_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:5]}_{clean_bas_name}"
        full_bas_path = os.path.join(STORAGE_DIR, unique_bas_name)

        with open(full_bas_path, "w", encoding="utf-8") as f:
            f.write(full_vba_content)

        generated_files.append({
            "filename": clean_bas_name,
            "stored_name": unique_bas_name,
            "kind": "bas",
            "download_path": f"/files/download/{unique_bas_name}",
        })

    # 3. Tambahkan tautan unduhan ke bagian bawah Markdown jika ada file yang berhasil dirakit
    if generated_files:
        download_section = [
            "\n\n---",
            "### 📦 File Excel & Modul Macro VBA Siap Unduh",
            "Sistem Solusi Macro VHQ telah merakit file kerja dari hasil di atas. Klik tautan di bawah untuk mengunduh:",
        ]
        for gf in generated_files:
            icon = "📊" if gf["kind"] == "xlsx" else "⚙️"
            label = (
                f"Unduh Workbook Excel (`{gf['filename']}`)"
                if gf["kind"] == "xlsx"
                else f"Unduh Modul Macro VBA (`{gf['filename']}` — Import via Alt+F11)"
            )
            download_section.append(
                f"- {icon} [**{label}**](/api/backend{gf['download_path']})"
            )
        cleaned_markdown = cleaned_markdown + "\n" + "\n".join(download_section)

    return cleaned_markdown, generated_files
