# KNCC Excel Platform - Initial Codebase Analysis

## Core Summary
The KNCC Excel Platform is a monorepo containing a React + Vite + Tailwind CSS frontend and a FastAPI backend, designed to parse PDF construction documents (invoices, change orders, purchase orders), reconcile them with a master material spreadsheet (`Client_Requirments_Doc.xlsx`), and sync the results back to Excel. The system is designed to support local development using SQLite and production deployment on Vercel/Render with Supabase.

---

## 1. Project Directory Layout

The workspace root directory is structured as follows:

```
c:\Users\Admin\Desktop\KNCC_EXCEL\
├── .agents/                      # Agent metadata and reports
│   └── explorer_initial_codebase/ # This explorer agent's folder
├── .github/                      # GitHub Actions CI/CD workflows
├── .venv/                        # Root python virtual environment
├── .vercel/                      # Vercel deployment cache and configurations
├── Client/                       # Directory containing master spreadsheets and project folders
│   ├── Cobia Cove/               # Project folders containing raw PDFs
│   └── Willow way Village/       # Project folders containing raw PDFs
├── Uploads/                      # Root uploads directory (empty)
├── api/                          # Vercel Serverless Function entrypoint
│   └── index.py                  # Redirects API traffic to platform/backend/app/main.py
├── legacy_scripts/               # Old desktop automation/scripts (Tkinter GUI, old parsers)
├── node_modules/                 # Root JS node modules
├── platform/                     # Main platform development folder
│   ├── backend/                  # FastAPI python application
│   │   ├── app/                  # Main backend modules (routers, models, services, etc.)
│   │   ├── exports/              # Directory for generated/exported files
│   │   ├── uploads/              # Local upload directory containing scanned PDFs
│   │   └── kncc_platform.db      # SQLite local development database
│   └── frontend/                 # React SPA (Vite, React Router, Tailwind, AG-Grid)
├── delete_users.sql              # Helper sql script to clean users
├── fix_identities.sql            # Helper sql script to fix auth identities in Supabase
├── jobs.json                     # GitHub Actions run job logs (UTF-16LE)
├── package.json                  # Root dependencies
├── pyproject.toml                # Root python pyproject packaging configuration
├── recover.py                    # Script used to recover code from logs
├── render.yaml                   # Render deployment configuration for Web Service & static sites
├── requirements.txt              # Backend python package dependencies list
├── supabase_schema.sql           # Database schema initialization script (Postgres/Supabase)
├── test_login.js                 # Authentication test script
├── uv.lock                       # Lockfile for python packages
└── vercel.json                   # Vercel monorepo routing and build configuration
```

---

## 2. Location of Sample Files

### Master Requirements Spreadsheet
* **Path**: `Client/Client_Requirments_Doc.xlsx`
* **Backup**: `Client/Client_Requirments_Doc_BACKUP.xlsx`
* **Template**: `platform/backend/app/templates/Client_Requirements_Template.xlsx`
* **Sheets in spreadsheet**:
  * `VPO's`
  * `Cobia Cove Appartments`
  * `Willow Way Apts`

### PDFs (Invoices, Change Orders, and Purchase Orders)
Raw PDF files are split between the `Client/` subdirectories and the local backend `platform/backend/uploads/` directory:
* **Cobia Cove PDFs**:
  * Root path: `Client/Cobia Cove/`
  * Change Orders: `Client/Cobia Cove/Cobia Cove Change Orders/` (e.g. `COBIA CO #007.pdf`)
  * Purchase Orders: `Client/Cobia Cove/Cobia Cove PO's/` (e.g. `Cobia Cove Housewrap- Capsol (1).pdf`)
  * Invoices: `Client/Cobia Cove/Invoices (3)/Invoices/` (e.g. `68981001.pdf`)
* **Willow Way Village PDFs**:
  * Invoices: `Client/Willow way Village/Invoices/` (e.g. `60126001.pdf`)
  * Change Orders: `Client/Willow way Village/Willow Way Village CO's/` (e.g. `WILLOW WAY CO #014.pdf`)
* **Backend Upload Cache**:
  * Path: `platform/backend/uploads/`
  * Contains copy of all **151** uploaded and processed PDFs for active reconciliation (matching the invoice and CO numbers in the local SQLite DB).

---

## 3. Database Schemas

The application has two distinct database configurations:
1. **SQLite Database (`platform/backend/kncc_platform.db`)**: Used locally, using integer auto-increment primary keys.
2. **Postgres/Supabase Database**: Configured via the SQL files and migration scripts, using UUID primary keys and Row-Level Security (RLS) policies.

### SQLite SQLAlchemy Models (`platform/backend/app/models/`)

* **`organizations`** (`Organization`)
  * `id`: `Integer` (PK)
  * `name`: `String` (Unique, indexed)
  * `created_at`: `DateTime`

* **`users`** (`User`)
  * `id`: `Integer` (PK)
  * `email`: `String` (Unique, indexed)
  * `hashed_password`: `String`
  * `name`: `String`
  * `role`: `String` (default `'member'`)
  * `is_active`: `Boolean` (default `True`)
  * `organization_id`: `Integer` (FK -> `organizations.id`)
  * `created_at`: `DateTime`

* **`projects`** (`Project`)
  * `id`: `Integer` (PK)
  * `name`: `String`
  * `job_number`: `String` (indexed)
  * `tax_rate`: `Float` (default `1.06`)
  * `status`: `String` (default `'Active'`)
  * `organization_id`: `Integer` (FK -> `organizations.id`)
  * `created_at`: `DateTime`
  * `updated_at`: `DateTime`

* **`materials`** (`Material`)
  * `id`: `Integer` (PK)
  * `project_id`: `Integer` (FK -> `projects.id`)
  * `type`: `String` (Item code or category - Lumber, Panels, etc.)
  * `qty`: `Float` (Original PO qty)
  * `co_qty`: `Float` (Total qty adjusted via COs)
  * `po_co_qty`: `Float` (Total combined qty: `qty + co_qty`)
  * `thickness`: `Float`
  * `width`: `Float`
  * `length`: `Float`
  * `material_type`: `String` (e.g., Description)
  * `lf_pcs`: `Float`
  * `bf_sf`: `Float`
  * `cost_mbf`: `Float`
  * `total_cost`: `Float`
  * `total_cost_tax`: `Float`
  * `invoice_refs`: `String` (Newline-separated list of invoiced references)

* **`co_adjustments`** (`COAdjustment`)
  * `id`: `Integer` (PK)
  * `material_id`: `Integer` (FK -> `materials.id`)
  * `co_number`: `String`
  * `co_date`: `String`
  * `qty_change`: `Float`
  * `description`: `String`

* **`documents`** (`Document`)
  * `id`: `Integer` (PK)
  * `project_id`: `Integer` (FK -> `projects.id`)
  * `doc_type`: `String` (PO, INV, CO)
  * `filename`: `String`
  * `doc_number`: `String` (used for duplicate guard)
  * `parsed_data_json`: `Text`
  * `created_at`: `DateTime`

* **`deliveries`** (`Delivery`)
  * `id`: `Integer` (PK)
  * `material_id`: `Integer` (FK -> `materials.id`)
  * `document_id`: `Integer` (FK -> `documents.id`, nullable)
  * `invoice_number`: `String`
  * `ship_date`: `DateTime`
  * `quantity`: `Float`
  * `qty_multiplier`: `Float` (default `1.0`, dimension-scale factor)
  * `uom`: `String`

* **`inventory`** (`Inventory`)
  * `id`: `Integer` (PK)
  * `material_id`: `Integer` (FK -> `materials.id`, unique)
  * `bundles`: `Float`
  * `uom`: `String`
  * `pcs_per_bundle`: `Float`
  * `inv_pcs`: `Float`
  * `issues`: `Float`
  * `variance_code`: `String`
  * `reason`: `String`

* **`vpos`** (`VPO`)
  * `id`: `Integer` (PK)
  * `project_id`: `Integer` (FK -> `projects.id`)
  * `vpo_date`: `DateTime`
  * `qty`: `Float`
  * `uom`: `String`
  * `description`: `String`
  * `footage`: `Float`
  * `price`: `Float`
  * `amount`: `Float`
  * `tax`: `Float`
  * `total`: `Float`
  * `co_ref`: `String`
  * `co_number`: `String`
  * `remarks`: `String`

* **`activities`** (`Activity`)
  * `id`: `Integer` (PK)
  * `project_id`: `Integer` (FK -> `projects.id`, nullable)
  * `action`: `String`
  * `detail`: `Text`
  * `created_at`: `DateTime`

* **`item_mappings`** (`ItemMapping`)
  * `id`: `Integer` (PK)
  * `project_id`: `Integer` (FK -> `projects.id`)
  * `invoice_description`: `String`
  * `material_id`: `Integer` (FK -> `materials.id`)

---

### Supabase / Postgres Database Schema Details

There are two Postgres/Supabase schemas defined in the codebase:

1. **`supabase_schema.sql` (Root level)**:
   * Maps SQLAlchemy models to Postgres directly.
   * Defines: `projects` (UUID PK), `pos` (UUID PK), `invoices` (UUID PK), `cos` (UUID PK), `materials` (UUID PK).
   * RLS policies are enabled on all tables, granting full access (`true`) to authenticated users.

2. **`supabase/schema.sql` and `supabase/migrations/`**:
   * Introduces multi-tenancy based on `organization_name`.
   * Tables: `projects` (UUID PK), `purchase_orders` (Text PK, e.g. `'PO-1001'`), `invoices` (Text PK, e.g. `'INV-901'`), `change_orders` (Text PK), `documents` (UUID PK).
   * Migration `20260629000002_materials.sql` adds a `materials` table.
   * Multi-tenancy RLS function `user_org()` extracts `organization_name` from the user's JWT metadata. RLS policy forces `organization_name = user_org()`.

**Important Schema Mismatch**:
The migration script `platform/backend/migrate_to_supabase.py` executes `Base.metadata.create_all(bind=supabase_engine)` on the Supabase database. This will create SQL tables in Postgres that match the **SQLite models exactly** (with Integer IDs and relationships) instead of using the UUID-based, tenant-isolated schemas in the `supabase/` folders.

---

## 4. API Endpoints

The backend routes are registered in `platform/backend/app/routers/__init__.py` under the `/api` prefix:

### 1. Authentication Router (`/api/auth`)
* `POST /register`: Registers a new user and organization.
* `POST /login`: Log in to retrieve an access token.
* `GET /me`: Returns details of the logged-in user.

### 2. Projects Router (`/api/projects`)
* `GET /`: Get all projects belonging to the user's organization.
* `POST /`: Create a new project.
* `GET /{project_id}`: Fetch project details by ID.
* `DELETE /{project_id}`: Delete a project.
* `POST /{project_id}/import-excel`: Import project data from a spreadsheet. Falls back to `Client/Client_Requirments_Doc.xlsx` if no spreadsheet is uploaded.

### 3. Upload Router (`/api/upload`)
* `POST /`: Upload PDF documents. Returns the classified type (`PO`, `INV`, `CO`). Saves file to local `UPLOAD_DIR`.
* `POST /preview`: Preview the changes (injected as a diff list mapped to `Client_Requirments_Doc.xlsx` rows) before confirming.
* `POST /confirm`: Confirm the upload, parse and write records to the DB (`Document`, `COAdjustment`, etc.), log activity, and update database quantities.

### 4. Materials Router (`/api/materials`)
* `GET /{project_id}`: Fetch materials list and reconciliation details.
* `GET /{project_id}/summary`: Fetch project budget, actual, tax, PO costs, invoice costs, and variance.
* `PATCH /{project_id}/{material_id}`: Update specific properties of a material.

### 5. Documents Router (`/api/documents`)
* `GET /{project_id}`: Get metadata for all uploaded documents for a project.
* `GET /pdf/{project_id}/{doc_id}`: Stream the raw PDF binary.
* `GET /parsed/{project_id}/{doc_id}`: Get parsed JSON structure from the PDF.

### 6. Deliveries Router (`/api/deliveries`)
* `GET /{project_id}`: Fetch all deliveries.
* `GET /{project_id}/progress`: Fetch delivery quantity metrics and percentages per material.
* `GET /{project_id}/timeline`: Get delivery timeline events.

### 7. VPOs Router (`/api/vpos`)
* `GET /{project_id}`: Fetch all VPO rows.

### 8. Export Router (`/api/export`)
* `POST /client-requirements`: Generates and streams back an updated Excel sheet containing injected deliveries, COs, and recalculated formulas.
* `POST /unmatched-items`: Returns Excel file containing unmatched items.

### 9. Activity Router (`/api/activity`)
* `GET /`: Get organization activity logs.
* `GET /{project_id}`: Get project activity logs.

### 10. Mappings Router (`/api/mappings`)
* `GET /`: Get item mappings.
* `POST /`: Add or update an item mapping (invoice description -> material row).

### 11. Scan Router (`/api/scan`)
* `POST /document`: Runs `document_parser.py` (downloads PDF from Supabase storage) and returns parsed preview. (Legacy/alternative endpoint, not used in the current Vite frontend UI).

---

## 5. Configurations

* **Vercel (`vercel.json`)**: Configures monorepo deployment. Directs static web requests to Vite (`platform/frontend/dist`) and rewrites `/api/*` to the Python Serverless Function `/api/index.py`.
* **Render (`render.yaml`)**: Deploys backend Python app (`uvicorn app.main:app`) and serves frontend static site.
* **Environment variables (`platform/frontend/.env` / `.env.local`)**:
  * `VITE_SUPABASE_URL`: `https://wjpmruxpwhcbmzaurcbq.supabase.co`
  * `VITE_SUPABASE_ANON_KEY`: Supabase client-safe anonymous API key.
  * `VITE_BACKEND_URL`: `https://kncc-backend.onrender.com` (for production calls).

---

## 6. Key Issues & Critical Discrepancies Identified

1. **Seed Data Organization Mismatch**:
   * **Observation**: In the SQLite database `kncc_platform.db`, both seeded users (`admin@kncc.com` and `engineer@kncc.com`) are assigned `organization_id = 2` (`KNCC Demo Org`). However, the seeded projects (`Willow Way Village` and `Cobia Cove Apartments`) are assigned `organization_id = 1` (`Test Org`).
   * **Impact**: When logging into the system, the project selection/dashboard displays an empty list because the projects are queried with `filter(Project.organization_id == current_user.organization_id)`.
   * **Fix Recommendation**: Update the project organization assignments or user organization assignments during initialization/seeding in `platform/backend/app/main.py`.

2. **Schema Mismatch (SQLite integer IDs vs. Supabase UUIDs)**:
   * **Observation**: SQLite models use integer primary keys (e.g. `id = Column(Integer, primary_key=True)`). However, the migration SQL scripts and Supabase schemas in `supabase/` define columns with UUID primary keys (e.g. `id UUID DEFAULT uuid_generate_v4()`).
   * **Impact**: If `migrate_to_supabase.py` creates tables based on SQLAlchemy models using `Base.metadata.create_all`, it forces Supabase to use SQLite's schema layout (integer PKs), breaking compatibility with the hand-written SQL migrations and multi-tenancy JWT filters that rely on the schema files.
