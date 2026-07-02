# Project: KNCC Excel Platform

## Architecture
The application is a React + FastAPI monorepo that processes PO, CO, and Invoice documents.
- **Frontend**: React SPA communicating with backend REST endpoints and using Supabase client library.
- **Backend**: FastAPI app using SQLAlchemy to interface with local SQLite (`kncc_platform.db`) or remote Supabase PostgreSQL.
- **Document Processing**: `pdfplumber` and custom regex parses PDFs and matches lines to material requirements.
- **Syncing & Exporting**: `openpyxl` copies templates and injects quantities and standard sheet formulas.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Seeding & Database Org Alignment | Align project org IDs with KNCC Demo Org users; address UUID vs integer models. | None | DONE |
| M2 | Backend Persistence & Export Endpoints | Implement PO/Invoice confirm DB writes; add project Excel export endpoint `/api/export/{project_id}`. | M1 | DONE |
| M3 | Frontend Environment & JWT Configuration | Make frontend URL dynamic; shorten JWT access token lifetime. | M2 | DONE |
| M4 | E2E Testing & Audit | Run E2E test scripts; verify Excel outputs and run Forensic Integrity Audit. | M3 | DONE |
| M5 | Supabase Test User Account Injection | Automatically inject predefined test user accounts (username and password) into Supabase auth. | None | DONE |
| M6 | Data Persistence & State Recovery | Persist application state using Supabase/local storage to prevent data loss on page reload. | M5 | DONE |
| M7 | Dynamic Excel Generation from Scratch | Generate client_req_doc Excel file from scratch with openpyxl including all formulas. | M6 | DONE |
| M8 | Interactive Row Change Confirmations | Prompt user in React UI for confirmation before applying row/material changes from COs. | M7 | DONE |
| M9 | E2E Integration Verification & Audit | Run all integration tests and perform Forensic Auditor checks. | M8 | DONE |

## Interface Contracts
### REST API ↔ Frontend
- `POST /api/auth/login`: returns `access_token` and JWT headers.
- `GET /api/projects/`: lists projects matching user's `organization_id`.
- `POST /api/upload/confirm`: accepts form data `filename`, `doc_type`, `project_id`. Commits parser line items to database.
- `POST /api/export/{project_id}`: generates excel using `sync_excel_for_project` and streams back Excel spreadsheet file.

## Code Layout
- `platform/frontend/src/`: React UI source code.
- `platform/backend/app/`: FastAPI modules.
- `platform/backend/app/routers/`: API route definition.
- `platform/backend/app/services/`: Business logic, document parsing, and Excel sync.
