# Detailed Investigation Analysis

This report presents a thorough read-only investigation of the KNCC Excel platform codebase, covering:
1. **R1: Fix Data Persistence**: Analysis of the `/api/upload/confirm` handler and associated DB models, and why line items do not persist or display.
2. **R2: Intelligent Local Mapping**: Locations of "Willow Way" and "Cobia Cove" mapping logic, proposed heuristics for matching, layout generalization, and quantity adjustments.
3. **R3: Excel Export Generation**: Existing backend `openpyxl` services vs. frontend client-side SheetJS exports, and the design for a live-data Excel export mimicking the target structure.

---

## R1: Fix Data Persistence Investigation

### 1. Endpoint Location and Handler Logic
The `/api/upload/confirm` endpoint is defined in `platform/backend/app/routers/upload.py` as:
```python
@router.post("/confirm")
async def confirm_upload(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    project_id: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
```
- **Execution Flow**:
  1. The uploaded file is saved to the local directory `UPLOAD_DIR`.
  2. The parser parses the PDF based on `doc_type` via `parse_pdf_document(filepath, doc_type)`.
  3. It validates that the invoice has not been processed already.
  4. It writes a `Document` record to the database session.
  5. If `doc_type == "CO"`, it inserts adjustments via `_save_co_adjustments(db, proj_id_int, doc_data, doc.id)`.
  6. If `doc_type == "PO"`, it iterates through parsed line items, matches them to existing materials via `_match_line_to_material`, and either updates quantities on existing material rows or inserts new `Material` records into the database session.
  7. If `doc_type == "INV"`, it maps line items to materials and inserts `Delivery` records.
  8. Finally, it commits the database session and returns success.

---

### 2. Discovered Persistence & Display Failures

#### A. Database Disconnection (SQLite vs. Supabase)
In local development, the backend is configured to use a local SQLite database file `platform/backend/kncc_platform.db` (governed by `platform/backend/app/config.py` and `database.py`).
However, the frontend's `PlatformProvider` (in `platform/frontend/src/context/PlatformContext.jsx`) is configured to query the remote Supabase database directly:
```javascript
const [materials, setMaterials] = useState([]);
...
const refreshProjectData = async () => {
  if (!activeProject) return;
  try {
    const pId = activeProject.id;
    const [posRes, invRes, cosRes, docsRes, matsRes] = await Promise.all([
      supabase.from('pos').select('*').eq('project_id', pId),
      supabase.from('invoices').select('*').eq('project_id', pId),
      supabase.from('cos').select('*').eq('project_id', pId),
      supabase.from('documents').select('*').eq('project_id', pId),
      supabase.from('materials').select('*').eq('project_id', pId),
    ]);
    ...
    if (matsRes.data) setMaterials(matsRes.data);
```
Because the backend writes materials to the local SQLite database file, but the frontend reads materials from the remote Supabase instance, **confirmed uploads never appear in the frontend grid**.

#### B. Primary Key Type Conflict (UUID vs. Integer)
In the SQLAlchemy database models (`platform/backend/app/models/project.py` and `material.py`):
```python
class Project(Base):
    id = Column(Integer, primary_key=True, index=True)

class Material(Base):
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
```
However, the remote Supabase tables (defined in `supabase_schema.sql`) use UUIDs:
```sql
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
);
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id),
    ...
);
```
When the frontend communicates with the backend, it passes a UUID string `project_id` (e.g., `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`). The `/confirm` handler does:
```python
proj_id_int = int(project_id)
```
This raises a `ValueError` (cannot convert UUID string to integer), causing the endpoint transaction to crash and roll back, resulting in a `500 Internal Server Error`.

#### C. Database Column Mismatch
If the backend `DATABASE_URL` is set to point to the remote Supabase PostgreSQL database directly, SQLAlchemy queries and writes still fail because the columns do not align:
- **SQLAlchemy `Material` Columns**: `qty`, `co_qty`, `po_co_qty`, `thickness`, `width`, `length`, `material_type`, `lf_pcs`, `bf_sf`, `cost_mbf`, `total_cost`, `total_cost_tax`, `invoice_refs`.
- **Supabase `materials` Columns**: `item_code`, `description`, `category`, `quantity`, `uom`, `unit_price`, `amount`, `footage`, `dimensions`, `source_document`.
SQLAlchemy attempts to insert columns like `qty` and `material_type` which do not exist in Supabase, causing Postgres syntax/column errors.

#### D. Missing REST Integration for Material Grid
The frontend grid in `MaterialGrid.jsx` loads its data from `materials` stored in `PlatformContext`. There is no API request calling the backend's `/api/materials/{project_id}` endpoint (which is defined in `platform/backend/app/routers/materials.py`). The enriched calculations (lumber formulas, delivery totals, inventory issues) are entirely computed by the backend in Python but are bypassed because the frontend directly pulls raw, uncalculated rows from Supabase.

#### E. Invoice References Not Updated
During invoice confirmation (`doc_type == "INV"`), the handler inserts `Delivery` records, but it never updates the `invoice_refs` string field on the associated `Material` record. As a result, the `invoice_refs` field in the database remains blank, and no invoice numbers are displayed in the Material Grid.

---

## R2: Intelligent Local Mapping Investigation

### 1. Locations of Hardcoded "Willow Way" and "Cobia Cove" Logic
Hardcoded project name checks and custom column schemas are scattered across multiple backend files:
- **`services/classifier.py`**:
  ```python
  if "COBIA COVE" in text_upper:
      project = "Cobia Cove"
  ```
- **`services/document_parser.py` & `services/pdf_parser.py`**: Identifies project boundaries by matching `"COBIA COVE"` or `"WILLOW WAY"`.
- **`services/excel_importer.py` & `services/excel_sync.py` & `routers/export.py`**: Defines layout mappings (`COBIA_COLS`, `WILLOW_COLS`), sheet names (`SHEET_COBIA`, `SHEET_WILLOW`), and fixed row indices (`[(3, 118), (123, 152), (157, 170), (173, 176)]` for Cobia vs. `[(3, 78)]` for Willow).

---

### 2. Intelligent Mapping Heuristics Proposal
Instead of rigid text matching, the matching service (`services/matcher.py`) and upload confirmation mapping should be reinforced with the following heuristics:
1. **Dimension Extraction Regex**: Use a case-insensitive regex to capture T x W x L values:
   `r'(\d+)\s*[-xX]\s*([\d.]+)\s*[-xX]\s*(\d+)'`
   Handle decimals/fractions (e.g. `11-7/8` to `11.875`) and PET lengths ("PET 104-5/8" -> 9ft, "PET 116-5/8" -> 10ft).
2. **Text Normalization**: Strip spaces, lowercase, and resolve abbreviations (e.g. "PT" or "MCA" -> Pressure Treated; "SYP" -> Southern Yellow Pine; "EWP" -> Engineered Wood Product).
3. **Keyword Similarity Score**: Allocate scores based on keyword overlaps:
   - Match categories (Lumber, Panels, LVL, Each) first to filter candidates.
   - Exact dimension matches (T, W, L) score +5 points each.
   - Target wood/spec match (e.g., SYP, MCA, ZIP, OSB) score +3 points.
   - Text similarity (Jaccard token overlap or Levenshtein distance) for the remaining description words.
4. **Manual User Mapping (Dynamic Learning)**: When a document item has a matching score below a threshold (e.g., 10), store it as unmatched and prompt the user in the UI to select the correct material. Once selected, save a manual mapping in the `item_mappings` table (`project_id`, `invoice_description`, `material_id`). Future matches query this mapping table first.

---

### 3. Generalizing Sheet Mapping (No Code Changes)
To make mapping and parsing seamless for new projects without code modifications, implement a **Header-Matching Layout Discovery** mechanism:
- When a project spreadsheet template is uploaded, the parser reads Row 2 (the column headers) dynamically.
- It maps the column indices of required fields by scanning for header names:
  - "Type" or "Category" -> `type` column index
  - "Thickness" or "T" -> `thickness` column index
  - "Width" or "W" -> `width` column index
  - "Length" or "L" -> `length` column index
  - "Material Type" or "Description" -> `material_type` column index
  - "PO Qty" or "Qty" -> `qty` column index
  - "Invoice Num" or "Invoice #" -> `invoice_num` column index
  - "Total Delivered" -> `total_delivered` column index
  - Individual CO columns (e.g., columns labeled "CO1", "CO2", "CO 06/15/2026") are identified as any columns between "PO Qty" and "CO Qty".
  - Delivery columns are identified as any columns between "Invoice Num" and "Total Delivered" (usually date-formatted headers).
This removes hardcoded layout schemas (`COBIA_COLS`, `WILLOW_COLS`) entirely, allowing any new project sheet to be parsed and written to dynamically.

---

### 4. Quantity Adjustments (No Duplicate Rows)
- **Change Orders (COs)**:
  Instead of appending new rows, a Change Order adjusts the material's quantities.
  In the Excel sheet:
  1. Add a new column for the specific CO number (e.g. `CO 12`) in the Change Orders section.
  2. Insert the quantity change (`+` or `-`) in that column on the matched material's row.
  3. The `co_qty` cell on that row contains the Excel formula `=SUM(C{row}:AO{row})`.
  4. The `po_co_qty` cell contains the formula `=B{row}+AP{row}` (PO Qty + CO Qty).
  In the database:
  - Increment/decrement the `co_qty` field on the corresponding `Material` row.
  - Insert a record into the `co_adjustments` table linked to the `Material.id` to maintain historical audit trails.
- **Invoices/Deliveries**:
  Instead of duplicating material rows when an invoice is processed:
  1. Add a date column for the ship date in the Deliveries section (if it doesn't exist).
  2. Write the delivery quantity in that column. If multiple invoices are shipped on the same date, sum the quantities in that cell.
  3. Update the `invoice_num` cell with a comma-separated list of all mapped invoice numbers (e.g., `"INV-1002, INV-1005"`).
  4. The `total_delivered` cell recalculates using the formula `=SUM({del_start_col}{row}:{del_end_col}{row})`.

---

## R3: Excel Export Generation Investigation

### 1. Existing Backend Excel Services
The backend is equipped with a complete Excel reconstruction engine:
- **`services/excel_sync.py`** contains the function `sync_excel_for_project(db, project)` which generates the spreadsheet **entirely from scratch** using `openpyxl`.
- It sets up the multi-row headers, merged sections, and styling (Segoe UI font, specific background fills, thin borders).
- It writes the material records, maps CO adjustments to the CO columns, and records deliveries in date columns.
- It inserts formulas matching the `Client_Requirements_Doc.xlsx` structure (e.g. `=(B3*S3*U3*V3/12)*Z3/1000` for lumber total cost).
- **`routers/export.py`** exposes this service via `POST /api/export/{project_id}`, which runs `sync_excel_for_project` and returns the file stream.

---

### 2. Frontend Excel Export Mismatch
The current frontend client-side export in `utils/excelExport.js` uses SheetJS (`xlsx`):
- It constructs a flat grid of headers and data.
- It adds basic formulas like `SUM` and multiplications.
- **Limitation**: It is completely flat, missing the visual styling, merged section headers, nested categories (Lumber, LVL, Panels, Each), and custom row spacings of the original document. SheetJS Community Edition does not support styling (colors, fonts, borders).

---

### 3. Proposed Excel Export Design from Frontend

To perfectly replicate the `Client_Requirements_Doc.xlsx` structure, we propose two design paths:

#### Option A: Backend-Driven Export (Recommended)
Connect the React UI to the existing backend export service.
- **Implementation**:
  1. Modify the `handleExport` function in the frontend `ExcelExport.jsx` page.
  2. Trigger a REST request to `POST /api/export/{project_id}`.
  3. Receive the response as a binary blob and download it.
- **Advantages**:
  - Leverages the robust `openpyxl` engine that perfectly mirrors the layout, cell merges, fonts, and borders.
  - Avoids duplicating 800 lines of complex formatting rules in JavaScript.
  - Guarantees data consistency by querying the central database.

#### Option B: Frontend-Driven Export via ExcelJS (If offline is required)
If the export must be built on the client side:
- Replace SheetJS (`xlsx`) with `ExcelJS` (which supports formatting, merges, fonts, borders, and column width adjustments).
- Re-implement the section merging, cell grouping, and layout styling rules in JavaScript, inserting the materials list and writing Excel formulas into the cells dynamically.
