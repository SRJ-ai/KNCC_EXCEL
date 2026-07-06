# Project Execution Plan - Follow-up 2026-07-06T10:05:16Z

## Objectives
1. **R1: Fix Data Persistence**: Repair `/api/upload/confirm` to insert/commit uploaded PDF line items in the database.
2. **R2: Intelligent Mapping**: Implement regex/fuzzy/similarity mapping that matches PDF line items to templates (Willow Way / Cobia Cove) and generalizes to brand-new projects. Prevent duplicated rows for Invoices/COs (adjust quantities instead).
3. **R3: Excel Export**: Generate a new Excel file containing live mapped project data with exact structures, column headers, and formulas of `Client_Requirments_Doc.xlsx`.

## Milestones & Status
| Milestone | Name | Objective | Target Files | Status |
|-----------|------|-----------|--------------|--------|
| M10 | Codebase Exploration | Investigate routes, database models, schemas, current parsing & mapping service, and Excel generation code. | `platform/backend/app/` & `platform/frontend/` | PLANNED |
| M11 | Fix /api/upload/confirm Persistence | Fix DB insert/commit in the upload confirm handler. | Backend routers & services | PLANNED |
| M12 | Intelligent Mapping & Heuristics | Implement generalized matching & invoice/CO quantity adjustment. | Backend services, parsers | PLANNED |
| M13 | Excel Export Feature | Create export functionality mimicking the client doc perfectly. | Frontend and/or backend export code | PLANNED |
| M14 | Verification & Forensic Audit | Run tests, verify requirements, execute auditor checks. | Entire codebase | PLANNED |

## Strategy
1. **Assessment Phase (M10)**: Spawn `teamwork_preview_explorer` to locate the exact source files, verify database schemas, examine logs, and design the precise integration plan.
2. **Implementation Phase (M11, M12, M13)**: Spawn `teamwork_preview_worker` to apply fixes and features step-by-step.
3. **Review & Challenge Phase (M14)**: Spawn `teamwork_preview_reviewer`, `teamwork_preview_challenger`, and `teamwork_preview_auditor` to verify correctness, check all criteria, and run forensic tests.
