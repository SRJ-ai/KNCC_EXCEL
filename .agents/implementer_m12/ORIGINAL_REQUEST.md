## 2026-07-06T10:22:22Z
You are teamwork_preview_worker. Your working directory is C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\implementer_m12.
Your task is to implement Phase 2: Intelligent Local Mapping and Heuristics (R2) for existing and new projects.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Step 1: Dynamic Header-Matching Layout Discovery
Modify the Excel template loading in `platform/backend/app/routers/upload.py` (specifically `_load_excel_row_refs`):
- If the project name is unrecognized (doesn't contain "COBIA" or "WILLOW"), list all sheets in the Excel workbook.
- Match sheet names using case-insensitive/substring comparison against the project name. If no sheet matches, default to the first sheet in the workbook (ignoring "VPO's").
- On the selected sheet, scan the header row (row 2, falling back to row 1) to dynamically discover column letters/indices for key fields: "Type" (Division/Category), "Material Type"/"Description", "Thickness", "Width", "Length", "Qty", and "Cost".
- Use these dynamically discovered indices to load row references, allowing unrecognized projects to map templates dynamically.

### Step 2: Robust Fuzzy Matching & Heuristics
Update `_match_line_to_material` in `upload.py` and the matcher service in `app/services/matcher.py`:
- Use `ItemMapping` table as the first priority match.
- Implement text normalizations (PT/MCA -> Treated, SYP -> Southern Yellow Pine, etc.).
- Extract dimensions using case-insensitive regex supporting fraction or decimal formats for T x W x L.
- Match categories, dimensions, and descriptions with custom scoring (e.g. category match = 10, matching dimensions = +5 each, wood-species keyword match = +3).
- Return the best match if the score exceeds the threshold.

### Step 3: Change Order & Invoice Quantity Adjustments (Anti-Duplication)
- In `_save_co_adjustments` inside `upload.py`:
  - Search if the CO item matches any existing database Material.
  - If a match is found, add the change quantity directly to `co_qty` and update `po_co_qty` of the matched Material. Do NOT insert duplicate material rows.
  - If NO match is found, create a **new** `Material` row in the database for the project with `qty = 0.0`, `co_qty = item.quantity`, `po_co_qty = item.quantity`, and set its type, description, dimensions, and cost. Add it to the database so it appears in the grid.
- Ensure that Invoice confirmation also uses the same matching logic to insert `Delivery` records linked to the matching material ID and updates `Material.invoice_refs` without duplicating rows.

### Step 4: Verification Scripts
- Write or run programmatic test scripts to prove:
  1. Willow Way raw PDF line items successfully match corresponding template rows.
  2. PDF upload and mapping for a brand-new, unrecognized project runs and parses without crashing.
  3. Change Orders and Invoices correctly adjust quantities of mapped materials instead of duplicating them.
- Run `pytest` or Python commands to execute these tests. Document results.

Please write a detailed summary of your edits and findings to C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\implementer_m12\changes.md and write a handoff report at C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\implementer_m12\handoff.md. Use the handoff protocol: Observation, Logic Chain, Caveats, Conclusion, Verification.
Finally, send a message to your parent conversation ID (the caller agent) with a summary of the changes and the path to your handoff report.
