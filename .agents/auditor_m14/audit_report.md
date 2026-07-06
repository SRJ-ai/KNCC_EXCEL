# Forensic Audit Report

**Work Product**: KNCC Excel Reconciler Platform (Phase 1, 2, and 3 changes)
**Profile**: General Project
**Verdict**: CLEAN

---

## 1. R1: Fix Data Persistence

### Database Keys & UUID Support
- **Check**: Verification of primary and foreign keys in SQLAlchemy models (`platform/backend/app/models/`).
- **Observation**:
  - `Project` (`project.py`): `id` is a `String` column, with default set to `lambda: str(uuid.uuid4())`.
  - `Material` (`material.py`): `id` is `String` (UUID); `project_id` is a foreign key pointing to `projects.id` typed as `String`.
  - `Document` (`document.py`): `id` is `String` (UUID); `project_id` is a foreign key pointing to `projects.id` typed as `String`.
  - `VPO` (`vpo.py`): `id` is `String` (UUID); `project_id` is a foreign key pointing to `projects.id` typed as `String`.
  - `Activity` (`activity.py`): `id` is `String` (UUID); `project_id` is a foreign key pointing to `projects.id` typed as `String`.
  - `COAdjustment` (`material.py`): `id` is `String` (UUID); `material_id` is a foreign key pointing to `materials.id` typed as `String`.
- **Verdict**: **PASS**. All identifiers support UUIDs and are typed as String.

### Route Signatures & Parameters
- **Check**: Verification of endpoint parameters in routers.
- **Observation**:
  - In `platform/backend/app/routers/projects.py`:
    - `get_project(project_id: str, ...)`
    - `delete_project(project_id: str, ...)`
    - `import_excel(project_id: str, ...)`
  - In `platform/backend/app/routers/materials.py`:
    - `get_materials(project_id: str, ...)`
    - `get_summary(project_id: str, ...)`
    - `update_material(project_id: str, material_id: str, ...)`
  - In `platform/backend/app/routers/documents.py`:
    - `get_documents` uses `project.id` (String).
    - `get_pdf` and `get_parsed` use `doc_id: str`.
  - In `platform/backend/app/routers/upload.py`:
    - `preview_upload` accepts `project_id: str` from form parameters.
    - `confirm_upload` accepts `project_id: str` from form parameters.
- **Verdict**: **PASS**. Route signatures accept string project/material IDs rather than integers, ensuring compatibility with UUIDs.

### Frontend API Fetch
- **Check**: Checking if `refreshProjectData` in `PlatformContext.jsx` queries the REST APIs instead of Supabase directly.
- **Observation**:
  - In `platform/frontend/src/context/PlatformContext.jsx` (lines 87–120):
    ```javascript
    const refreshProjectData = async () => {
      if (!activeProject) return;
      try {
        const pId = activeProject.id;
        const { data: { session } } = await supabase.auth.getSession();
        ...
        const [matsRes, docsRes] = await Promise.all([
          fetch(`${backendUrl}/api/materials/${pId}`, { headers }),
          fetch(`${backendUrl}/api/documents/${pId}`, { headers }),
        ]);
        const matsData = matsRes.ok ? await matsRes.json() : [];
        const docsData = docsRes.ok ? await docsRes.json() : [];
        setMaterials(matsData);
        setDocuments(docsData);
        ...
    ```
- **Verdict**: **PASS**. The frontend queries backend REST APIs for materials and documents using JWT token authorization instead of directly accessing Supabase.

### Invoice Reference Updates
- **Check**: Verification of `invoice_refs` updates on confirmation.
- **Observation**:
  - In `confirm_upload` of `upload.py` (lines 671–680), for `doc_type == "INV"`:
    ```python
    mat = db.query(Material).filter(Material.id == matched_material_id).first()
    if mat and doc_data.number:
        import re as re_inv
        current_refs = re_inv.split(r'[,\n]+', mat.invoice_refs or "")
        existing_refs = [r.strip() for r in current_refs if r.strip()]
        if doc_data.number not in existing_refs:
            existing_refs.append(doc_data.number)
            mat.invoice_refs = ", ".join(existing_refs)
    ```
- **Verdict**: **PASS**. When confirming invoices, the matched material's `invoice_refs` column is successfully updated by splitting, deduplicating, and appending the new invoice number.

---

## 2. R2: Intelligent Mapping

### Dynamic Excel Loading & Discovery
- **Check**: Check `_load_excel_row_refs` in `upload.py` for dynamic header scanning.
- **Observation**:
  - In `platform/backend/app/routers/upload.py` (lines 245–367):
    - Sheet lookup checks for unrecognized projects and falls back to a sheet matching case-insensitively, or the first non-VPO sheet.
    - Scans row 2 for keywords (e.g., `"thickness"`, `"width"`, `"qty"`, `"cost"`, etc.) and falls back to row 1 if row 2 lacks keywords.
    - Dynamically maps index values and scans rows dynamically up to row 200, allowing generalization to unrecognized projects.
- **Verdict**: **PASS**. The loading logic scans headers dynamically and generalizes to unrecognized projects without hardcoding columns or sheet names.

### Fuzzy Matching Heuristics
- **Check**: Verification of matcher heuristics in `matcher.py`.
- **Observation**:
  - `normalize_text` cleans descriptions, maps shortcuts (PT/MCA/SYP) to standard names.
  - `parse_dimension_val` parses decimal values and fractions (e.g. `2-1/2` or `2 1/2`).
  - `DIM_REGEX` searches for patterns like `2x6x12` case-insensitively.
  - `score_match` scores items based on:
    - Category match: `+10`
    - Dimension matches: `+5` per matched dimension (using float proximity check `abs(inv - mat) < 0.01`)
    - Keyword match: `+3`
    - Word overlaps: `+2` per word (excluding filler words).
- **Verdict**: **PASS**. Heuristics are fully functional, parsing fractions and decimals, cleaning texts, and computing structured match scores.

### Change Order Confirmation Logic
- **Check**: Verification of `_save_co_adjustments` behavior.
- **Observation**:
  - In `_save_co_adjustments` of `upload.py` (lines 44–117):
    - For each CO item, it scores against all project materials.
    - If a match is found (score >= threshold):
      - `best.co_qty = (best.co_qty or 0.0) + item.quantity`
      - `best.po_co_qty = (best.qty or 0.0) + (best.co_qty or 0.0)`
      - Calculates and updates derived totals (`lf_pcs`, `bf_sf`, etc.).
    - If no match is found (unrecognized item):
      - Creates a new `Material` with `project_id`, `type`, `co_qty`, `po_co_qty`, dimensions, and `cost_mbf`.
      - Computes totals.
      - Adds new material to DB (`db.add(best)`) and appends it to `materials` list to prevent duplicate inserts on subsequent matching iterations.
    - Saves a `COAdjustment` record referencing the material.
- **Verdict**: **PASS**. Existing materials are adjusted, and unrecognized items are inserted as new materials without duplication.

---

## 3. R3: Excel Export

### Frontend Export Button
- **Check**: Verification of export API call and download handler.
- **Observation**:
  - In `platform/frontend/src/pages/ExcelExport.jsx` (lines 13–65):
    - The button calls `fetch(`${backendUrl}/api/export/${activeProject.id}`, { method: 'POST', headers })` using the active session token in the authorization header.
    - Handles the response blob: `const blob = await res.blob();`
    - Downloads the file locally via a dynamic `a` tag and revokes the object URL.
- **Verdict**: **PASS**.

### Excel Dynamic Sheet Naming
- **Check**: Tab name synchronization in `excel_sync.py`.
- **Observation**:
  - In `platform/backend/app/services/excel_sync.py` (lines 629–695):
    ```python
    name_upper = project.name.upper()
    is_cobia = "COBIA" in name_upper
    if is_cobia:
        sheet_name = SHEET_COBIA
        ...
    else:
        if "WILLOW" in name_upper:
            sheet_name = SHEET_WILLOW
        else:
            sheet_name = project.name
        ...
    ws_project = wb.active
    ws_project.title = sheet_name
    ```
    - For unrecognized projects, the sheet name dynamically equals the project's actual name.
- **Verdict**: **PASS**.

---

## 4. Integrity Scan

- **Check**: Hardcoded results or facade implementations.
- **Observation**:
  - No facade functions (e.g. functions returning mock constants instead of logic) exist in the source codebase.
  - Test suites (`test_*.py` files) contain expectations for asserting correctness, but the backend routers and services use authentic database operations, `pdfplumber` parsing, and `openpyxl` writing.
- **Verdict**: **CLEAN**. No integrity violations found.
