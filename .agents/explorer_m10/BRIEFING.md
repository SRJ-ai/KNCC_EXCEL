# BRIEFING — 2026-07-06T10:18:00Z

## Mission
Investigate the codebase for KNCC Excel/Materials tracking system, focusing on data persistence issues, document mapping (Willow Way/Cobia Cove mapping logic and generalized intelligent matching/quantity adjustment), and Excel export generation matching Client_Requirments_Doc.xlsx.

## 🔒 My Identity
- Archetype: explorer
- Roles: teamwork_preview_explorer
- Working directory: C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\explorer_m10
- Original parent: 908cbde3-aa9a-4a4f-b341-990529153c8e
- Milestone: m10

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Operational mode: CODE_ONLY (no external web search)

## Current Parent
- Conversation ID: 908cbde3-aa9a-4a4f-b341-990529153c8e
- Updated: 2026-07-06T10:18:00Z

## Investigation State
- **Explored paths**:
  - `platform/backend/app/routers/upload.py`
  - `platform/backend/app/routers/materials.py`
  - `platform/backend/app/routers/projects.py`
  - `platform/backend/app/routers/documents.py`
  - `platform/backend/app/routers/export.py`
  - `platform/backend/app/models/material.py`
  - `platform/backend/app/models/project.py`
  - `platform/backend/app/models/delivery.py`
  - `platform/backend/app/database.py`
  - `platform/backend/app/config.py`
  - `platform/backend/app/main.py`
  - `platform/backend/app/dependencies.py`
  - `platform/backend/app/services/excel_sync.py`
  - `platform/backend/app/services/excel_generator.py`
  - `platform/backend/app/services/matcher.py`
  - `platform/backend/app/services/pdf_parser.py`
  - `platform/frontend/src/context/PlatformContext.jsx`
  - `platform/frontend/src/pages/MaterialGrid.jsx`
  - `platform/frontend/src/pages/ExcelExport.jsx`
  - `platform/frontend/src/utils/excelExport.js`
- **Key findings**:
  - **R1: Fix Data Persistence**: In local dev, the backend writes to SQLite (`kncc_platform.db`), but the frontend reads from remote Supabase, causing confirmed files to not appear. If configured to connect to Supabase, the backend crashes because the frontend passes UUIDs, which fail the integer coercion (`int(project_id)`) on the backend SQLAlchemy models. Column names also mismatch between SQLAlchemy `Material` and Supabase `materials`. Invoice refs are never updated on material records during invoice confirmations.
  - **R2: Intelligent Local Mapping**: Willow Way and Cobia Cove layouts, sheet names, and data ranges are hardcoded across multiple files (parsers, importers, and exporters). Generalization can be achieved by reading Row 2 headers dynamically (Header-Matching Layout Discovery) and matching headers like "Thickness" or "PO Qty" to columns. Matching accuracy can be boosted using case-insensitive dimension regexes, abbreviation normalizations, wood spec overlap weights, and a manual mapping DB fallback. Quantities can be adjusted without duplicate rows by writing to dynamic CO columns and date-based delivery columns linked with formulas.
  - **R3: Excel Export**: The backend has a fully functional Excel generator using `openpyxl` (`services/excel_sync.py` and `routers/export.py`), whereas the frontend's client-side exporter generates flat SheetJS files without any styles or proper formula hierarchy. The recommended design is for the frontend's "Download .xlsx" button to trigger a REST request to `POST /api/export/{project_id}` and stream the file.
- **Unexplored areas**: None.

## Key Decisions Made
- Confirmed that backend-driven Excel generation via openpyxl is superior to client-side SheetJS for mimicking the target sheet's styling and hierarchy.
- Synthesized findings and documented them in analysis.md and handoff.md.

## Artifact Index
- C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\explorer_m10\analysis.md — Detailed analysis report
- C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\explorer_m10\handoff.md — Handoff report following protocol
