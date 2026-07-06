# Handoff Report: Codebase Investigation for KNCC EXCEL

## 1. Observation

### R1: Fix Data Persistence
- **FastAPI /confirm Endpoint**: In `platform/backend/app/routers/upload.py` lines 425-426, the project ID is converted to an integer:
  ```python
  proj_id_int = int(project_id)
  project = db.query(Project).filter(Project.id == proj_id_int, ...).first()
  ```
- **Database Model Key Type**: In `platform/backend/app/models/project.py` line 9, project IDs are defined as `Integer`:
  ```python
  id = Column(Integer, primary_key=True, index=True)
  ```
- **Supabase DB Table Schema**: In `supabase_schema.sql` lines 7-8 and 60-62, project and material IDs are UUIDs:
  ```sql
  CREATE TABLE IF NOT EXISTS public.projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
  CREATE TABLE IF NOT EXISTS public.materials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ```
- **Supabase Client In Frontend**: In `platform/frontend/src/context/PlatformContext.jsx` lines 90-103, materials are fetched from Supabase:
  ```javascript
  const matsRes = await supabase.from('materials').select('*').eq('project_id', pId);
  if (matsRes.data) setMaterials(matsRes.data);
  ```
- **Backend SQLite Config**: In `platform/backend/app/config.py` lines 29-30, local dev runs SQLite:
  ```python
  DB_PATH = os.path.join(BASE_DIR, "kncc_platform.db")
  DATABASE_URL = f"sqlite:///{DB_PATH}"
  ```
- **Backend Materials Column Model vs. Supabase Columns**:
  - `models/material.py` lines 7-26 defines columns like `qty`, `co_qty`, `thickness`, `width`, `length`, `material_type`, `cost_mbf`, `total_cost`, `total_cost_tax`, `invoice_refs`.
  - `supabase_schema.sql` lines 60-74 defines columns like `item_code`, `description`, `category`, `quantity`, `uom`, `unit_price`, `amount`, `footage`, `dimensions`, `source_document`.

### R2: Intelligent Local Mapping
- **Hardcoding of "Willow Way" and "Cobia Cove"**:
  - In `platform/backend/app/services/classifier.py` line 9:
    ```python
    if "COBIA COVE" in text_upper:
    ```
  - In `platform/backend/app/services/excel_importer.py` lines 42-64, the variables `COBIA_COLS` and `COBIA_DATA_RANGES` are defined statically.
- **Invoice/CO Quantity Adjustments**:
  - In `platform/backend/app/services/excel_generator.py` line 319, quantities for CO are added directly:
    ```python
    safe_set_cell(ws, best_match, po_co_qty_col, float(curr_qty) + qty)
    ```

### R3: Excel Export Generation
- **Backend Export Generator**: In `platform/backend/app/services/excel_sync.py` line 629, the `sync_excel_for_project` builds the sheet from scratch using `openpyxl` with dynamic headers, styles, fonts, and formulas.
- **Frontend Export Mismatch**: In `platform/frontend/src/utils/excelExport.js` line 16, SheetJS `xlsx` constructs a flat sheet structure with basic formulas but has zero style/nesting capabilities.

---

## 2. Logic Chain

1. **R1 (Data Persistence)**:
   - Since the backend writes materials to a local SQLite database (`kncc_platform.db`), but the frontend fetches materials directly from Supabase, updates made via `/api/upload/confirm` are not displayed.
   - If the backend is reconfigured to write to Supabase directly, it crashes because the frontend passes a UUID string for `project_id` which fails `int(project_id)` coercion in `upload.py`.
   - Additionally, columns defined in SQLAlchemy `Material` (`qty`, `material_type`, etc.) do not exist in the Supabase schema (`quantity`, `description`), leading to query failure.
   - During `/confirm` for invoices, delivery records are inserted, but `Material.invoice_refs` is never updated or sync-triggered, leaving invoice references blank in the grid.

2. **R2 (Intelligent Mapping)**:
   - Project matching and parsing logic are hardcoded with strings like "COBIA" and "WILLOW" and exact row indices.
   - By creating a JSON/YAML configuration file or mapping schema, and writing a header-matching routine that dynamically maps column letters (e.g. searching row 2 for "Thickness" to find column index), new spreadsheets can be processed without code updates.
   - By using a case-insensitive regex for `T x W x L` dimensions, normalizations, wood-species keyword weights (+3 points), and a manual mapping database table fallback, we can achieve high-accuracy fuzzy matching.
   - By mapping CO inputs to dedicated CO columns (`C` to `AO` for Cobia) in Excel and writing `=SUM(C{r}:AO{r})` formulas, we adjust quantities gracefully instead of duplicating rows.

3. **R3 (Excel Export)**:
   - The backend already contains an `openpyxl` exporter that perfectly mimics `Client_Requirments_Doc.xlsx` layout, groupings, fonts, and borders.
   - The frontend's SheetJS-based exporter only generates flat files.
   - Integrating a fetch call to backend REST `POST /api/export/{project_id}` from the frontend "Download .xlsx" button ensures the downloaded Excel file perfectly mirrors the layout rules populated with live data.

---

## 3. Caveats
- This investigation assumes that row styles (Segoe UI font, background colors, alignments) are mandatory for the final user Excel export (mimicking `Client_Requirments_Doc.xlsx`), which is why backend-driven `openpyxl` generation is recommended over client-side SheetJS.
- We assume that the database tables in Supabase should reflect the same SQLAlchemy schema to support the REST APIs. If Supabase cannot be modified, the backend models must be rewritten to match Supabase's columns exactly.

---

## 4. Conclusion
The lack of data persistence and Material Grid display is caused by a misalignment between the frontend querying Supabase directly, the backend writing to a local SQLite instance, mismatched column/key types (Integer vs. UUID), and a lack of REST API integration for materials on the frontend.
Intelligent matching and dynamic sheet parsing can be achieved using regular expressions, similarity scoring, database-backed manual mappings, and header-matching discovery to avoid hardcoding project sheets.
An Excel sheet perfectly mimicking the client requirements can be cleanly downloaded by routing the frontend download button to stream from the backend `POST /api/export/{project_id}` REST service.

---

## 5. Verification Method
- **Verify R1 Mismatch**:
  1. Inspect `PlatformContext.jsx` lines 96 and 182 to confirm they query Supabase directly.
  2. Inspect `upload.py` lines 461-512 to confirm writes occur on the SQLAlchemy SessionLocal.
- **Verify Key Mismatch**:
  1. Inspect `models/project.py` line 9 (`Column(Integer)`) and `supabase_schema.sql` line 8 (`UUID`).
- **Verify Excel Generator**:
  1. Open `services/excel_sync.py` line 629 and verify the styling and formulas mapped to Cobia/Willow layouts.
