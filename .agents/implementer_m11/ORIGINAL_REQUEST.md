## 2026-07-06T10:15:12Z

You are teamwork_preview_worker. Your working directory is C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\implementer_m11.
Your task is to implement Phase 1: Fix Data Persistence (R1) to align UUID keys and REST endpoints between frontend and backend:

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Step 1: Database Model Changes (String/UUID Keys)
In the backend models (`platform/backend/app/models/`), change the `id` columns and foreign keys referencing them (such as `project_id`, `material_id`, `document_id`) from `Integer` to `String` (or `String(36)`) or appropriate types. This enables both local SQLite (storing UUIDs as text) and remote Supabase PostgreSQL (which uses UUIDs) to operate without key type mismatch errors.
Specifically, update:
- `project.py`
- `material.py`
- `document.py`
- `delivery.py`
- `inventory.py`
- `vpo.py`
- `activity.py`
- `mapping.py`
Ensure that you import `uuid` and set a default UUID generator on the `id` columns so they auto-generate if not provided:
`id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))`

### Step 2: Route Parameter Updates
Modify the router endpoints (`platform/backend/app/routers/` and `platform/backend/app/dependencies.py`):
- Change `project_id: int` to `project_id: str` and `material_id: int` to `material_id: str` in all path parameters and dependency functions (e.g. `get_current_project`).
- In `platform/backend/app/routers/upload.py`:
  - Remove `proj_id_int = int(project_id)` from the `/confirm` endpoint, and use `project_id` as a string throughout.
  - Update all helper functions like `_save_co_adjustments` and `_load_excel_row_refs` to accept `project_id` as `str`.

### Step 3: Frontend REST Alignment
In `platform/frontend/src/context/PlatformContext.jsx`:
- Modify `refreshProjectData` to fetch `materials` and `documents` from the backend FastAPI REST endpoints:
  - `materials`: `${backendUrl}/api/materials/${pId}`
  - `documents`: `${backendUrl}/api/documents/${pId}`
- Populate the frontend `pos`, `invoices`, and `cos` states by filtering the fetched `documents` list:
  - `pos` <- `documents.filter(d => d.doc_type === 'PO')`
  - `invoices` <- `documents.filter(d => d.doc_type === 'INV')`
  - `cos` <- `documents.filter(d => d.doc_type === 'CO')`
- Ensure the Authorization Bearer headers are properly passed using the Supabase session access token.

### Step 4: Persist invoice_refs on Confirmation
In `confirm_upload` in `upload.py`:
- When an Invoice (INV) is confirmed, update the matched `Material` row's `invoice_refs` field by appending the invoice number (comma-separated, e.g. `inv1, inv2`), ensuring duplicates are avoided.
- Save and commit the changes to the database.

### Step 5: Build and Test Verification
- Propose and run the build and test commands (like `pytest` or package scripts) to verify backend compilation and endpoint behavior.
- Confirm that uploading and confirming a PO works without 500 errors and successfully updates the database.

Please write a detailed summary of your edits and findings to C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\implementer_m11\changes.md and write a handoff report at C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\implementer_m11\handoff.md. Use the handoff protocol: Observation, Logic Chain, Caveats, Conclusion, Verification.
Finally, send a message to your parent conversation ID (the caller agent) with a summary of the changes and the path to your handoff report.
