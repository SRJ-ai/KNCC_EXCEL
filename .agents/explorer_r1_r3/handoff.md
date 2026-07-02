# Handoff Report — Explorer R1 & R3

## 1. Observation
We observed the following exact paths and lines of code detailing the Excel sync and Change Order mapping processes:

- **Template Dependency**:
  - In `platform/backend/app/services/excel_sync.py:228-234`:
    ```python
    if not os.path.exists(LEGACY_EXCEL):
        raise FileNotFoundError(f"Legacy Excel template not found: {LEGACY_EXCEL}")

    export_filename = f"{project.name.replace(' ', '_')}_Requirements.xlsx"
    export_path = os.path.join(EXPORT_DIR, export_filename)
    shutil.copy2(LEGACY_EXCEL, export_path)
    ```
    This shows the Excel generator copies the template to the destination and modifies it.
  - Hardcoded layout maps in `excel_sync.py:32-62` detail the sheets `"Cobia Cove Appartments"` (`COBIA_COLS` / data ranges `[(3, 118), (123, 152), (157, 170), (173, 176)]`) and `"Willow Way Apts"` (`WILLOW_COLS` / data ranges `[(3, 78)]`).

- **Formula Generation**:
  - `excel_sync.py:108-213` contains the formula injector, writing 13 calculations (Delivered, Delivered LF, Delivered BF/SF, Delivered Cost, Delivered Cost+Tax, % Delivery, Inventory PCS, Issues, Issues LF, Issues BF/SF, % Issued, Issues Cost, Issues Cost+Tax) dynamically using string interpolation (e.g. `ws.cell(row=row, column=col_to_num(cols["total_delivered"]), value=f"=SUM({del_start_letter}{r}:{del_end_letter}{r})")`).

- **Change Order Handling & Database Schema**:
  - `platform/backend/app/models/material.py` defines:
    - Table `materials` containing `qty`, `co_qty` and `po_co_qty` fields.
    - Table `co_adjustments` containing `material_id`, `co_number`, `co_date`, `qty_change`, and `description`.
  - In `platform/backend/app/routers/upload.py:40-78`:
    - `_save_co_adjustments` is called during the `/confirm` process, matching CO parsed items against materials in the database by word overlap (score weight +2) and dimension matching (score weight +5 per dimension component). If the score $\ge 6$, it increments the database material `co_qty` and updates `po_co_qty = qty + co_qty`.
  - In `platform/backend/app/services/excel_sync.py:261-285`:
    - The sync process reads `Delivery` items and writes them to the delivery date columns. It **never** reads `COAdjustment` records or writes individual CO columns.

- **React UI confirmation**:
  - In `platform/frontend/src/pages/UploadPreviewPage.jsx:440-456`:
    - Clicking the "Apply Changes" button calls `onConfirm` immediately without secondary confirmation prompts for Change Orders.

---

## 2. Logic Chain
- **Excel template elimination**:
  - Since `excel_sync.py` uses `shutil.copy2` to duplicate a pre-existing template file, it cannot operate if `Client_Requirments_Doc.xlsx` is missing or restructured.
  - Since the sheet name and column positions are hardcoded in layout dictionaries, we can write an openpyxl generator from scratch that initializes a blank workbook (`openpyxl.Workbook()`), adds columns dynamically, applies cell styles/borders/merged cells programmatically, and writes the exact same formula rules. This removes the static file dependency entirely.
- **Architectural Sync Gap**:
  - `_save_co_adjustments` updates `co_qty` in the database, but `sync_excel_for_project` does not load these `COAdjustment` records.
  - Since `sync_excel_for_project` only copies the template and overwrites delivery cells, the individual CO columns (Columns C to P in Willow, C to AO in Cobia) in the exported sheet remain empty. To solve this, the rewritten exporter must retrieve `COAdjustment` records for each material and populate them in the generated columns.
- **UI Safety checkpoint**:
  - Since `UploadPreviewPage.jsx` executes `onConfirm` instantly upon clicking the button, users risk committing erroneous parsing results to the database.
  - By intercepting the click handler in `UploadPreviewPage.jsx` when `doc_type === 'CO'`, we can display a custom React modal listing the specific material rows, descriptions, and quantities (+ / - adjustments) that will be updated in the Excel sheet, prompting the user for explicit confirmation before calling `onConfirm()`.

---

## 3. Caveats
- **Uninvestigated areas**: Detailed rendering characteristics of the legacy sheets (e.g., custom colors, font styles) were not extracted programmatically using Python scripts because the terminal command run timed out. However, standard professional formatting (Segoe UI, header colors, double-underlined totals) is mapped in the analysis report.
- **Assumptions**: We assume the tax rate is variable and must be fetched from the database `Project.tax_rate` or default to `1.06`.

---

## 4. Conclusion
The Excel generation pipeline can be successfully rewritten to generate requirements spreadsheets from scratch using openpyxl, avoiding a brittle template file dependency. At the same time, the sync gap where Change Orders are not written back to the spreadsheet columns should be resolved by writing `COAdjustment` quantities to the corresponding columns. The React UI confirmation flow can be secured with a secondary confirmation modal in `UploadPreviewPage.jsx` that reviews the affected materials and rows before saving.

---

## 5. Verification Method
1. **Source Inspection**:
   - Inspect the analysis document at `c:\Users\Admin\Desktop\KNCC_EXCEL\.agents\explorer_r1_r3\analysis.md` for the exact code details, formula specifications, and React component details.
2. **Local Test Run**:
   - Run backend E2E tests to verify environment state:
     ```powershell
     cd C:\Users\Admin\Desktop\KNCC_EXCEL\platform\backend
     .venv\Scripts\python.exe test_e2e_inprocess.py
     ```
   - Successful output verifies that E2E flow parses, reconciles, and generates output correctly.
