# KNCC Excel Platform Implementation Plan

This document outlines the architecture, phases, milestones, and testing plan for building/refactoring the KNCC Excel mapping and data extraction platform.

## 1. Architecture Overview
The application follows a monorepo architecture:
- **Frontend**: React SPA built with Vite, Tailwind CSS, and AG-Grid. Uses Supabase Client or local auth wrappers to maintain sessions.
- **Backend**: FastAPI web framework routing all REST requests.
- **Database**:
  - Local: SQLite database (`kncc_platform.db`) for offline development.
  - Production: Supabase (PostgreSQL) with Row-Level Security (RLS) policies.
- **Excel Sync Engine**: Powered by `openpyxl` on the backend and `xlsx` on the frontend, reading the master requirements sheet (`Client_Requirments_Doc.xlsx`) and syncing extracted invoice/CO data with formula injection.

---

## 2. Core Implementation Phases & Milestones

### Milestone 1: Database Alignment and Key Incompatibility (Priority: High)
- **Objective**: Fix the organization ID mismatch and schema UUID/integer compatibility issue.
- **Tasks**:
  1. Update backend startup seed script (`app/main.py`) to align the organization IDs of seeded projects with the seeded KNCC Demo Org users.
  2. Map SQLAlchemy models in `migrate_to_supabase.py` and ensure they align with the Supabase schema using appropriate UUID keys, preventing primary key integer clashes.

### Milestone 2: PO/Invoice Database Persistence (Priority: High)
- **Objective**: Implement backend logic to write PO/Invoice data into SQLite/Postgres tables upon confirm.
- **Tasks**:
  1. Implement the `TODO` in `upload.py`'s `/confirm` endpoint to persist PO line items to the `materials` table, and Invoice line items to the `deliveries` table.
  2. Implement the `POST /api/export/{project_id}` endpoint in the export router to trigger `sync_excel_for_project` and return the Excel file.

### Milestone 3: Frontend Configuration & Persistence Fixes (Priority: Medium)
- **Objective**: Ensure the frontend interacts correctly with the local backend and retains session state.
- **Tasks**:
  1. Fix the hardcoded backend URL in `UploadCenter.jsx` to dynamically resolve using environment variables or a default local server fallback.
  2. Verify JWT access tokens are short-lived (e.g. 15 minutes instead of 7 days) in backend config and that browser refresh persists login state.

### Milestone 4: Dual-Track Validation & Integrity Audit (Priority: Critical)
- **Objective**: Confirm E2E test suites pass and verify that generated Excel sheets strictly match the layout.
- **Tasks**:
  1. Execute `test_e2e.py` against the running server.
  2. Run the Forensic Integrity Auditor to ensure no cheating is present in Excel exports.

---

## 3. Testing Plan

### E2E Testing
- Start local FastAPI app (`uvicorn app.main:app --port 8000`).
- Run `test_e2e.py` to upload sample files, confirm changes, and trigger sheet export.
- Verify exit codes are 0.

### Structural Excel Verification
- Inspect generated files and compare columns, formulas, and sheet structures against `Client/Client_Requirments_Doc.xlsx`.

### UI Session Persistence Verification
- Verify browser refreshes preserve active project state and visual mapping inputs.
