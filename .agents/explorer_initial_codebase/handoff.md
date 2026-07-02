# Handoff Report - Initial Codebase Exploration

This report documents the initial codebase exploration and analysis of the KNCC Excel Platform repository.

---

## 1. Observation

During the exploration, the following key items were directly observed:

### File and Directory Structure
The repository is laid out as a React + FastAPI monorepo:
* **Frontend**: `platform/frontend/` (contains Vite, React Router, Tailwind, AG-Grid).
* **Backend**: `platform/backend/` (contains FastAPI app modules, local SQLite DB `kncc_platform.db`, and `uploads/` directory with 151 cached PDFs).
* **Vercel integration**: `vercel.json` and `api/index.py` route all `/api/*` traffic to the FastAPI app.
* **Render integration**: `render.yaml` defines a web service for the FastAPI backend and a static host for the React frontend.
* **Sample Data**: Located in `Client/Client_Requirments_Doc.xlsx` and project subdirectories:
  * `Client/Cobia Cove/`
  * `Client/Willow way Village/`

### SQLite Database Seed Data
A custom inspection script was run using the project virtual environment to verify the tables and counts:
```
Table Counts:
  projects: 2
  materials: 180
  documents: 150
  vpos: 198
  activities: 150
  co_adjustments: 0
  deliveries: 56
  inventory: 4
  organizations: 2
  users: 2
  item_mappings: 0

Projects:
  ID: 1, Name: Willow Way Village, Job: 60126, Status: Active, Tax: 1.065, OrgID: 1
  ID: 2, Name: Cobia Cove Apartments, Job: 68981, Status: Active, Tax: 1.07, OrgID: 1

Organizations:
  ID: 2, Name: KNCC Demo Org
  ID: 1, Name: Test Org

Users:
  ID: 1, Email: admin@kncc.com, Name: Demo Admin, Role: admin, OrgID: 2
  ID: 2, Email: engineer@kncc.com, Name: Demo Engineer, Role: member, OrgID: 2
```

### Database Key Definitions Mismatch
* Verbatim SQLite model PK (`platform/backend/app/models/project.py:9`):
  ```python
  id = Column(Integer, primary_key=True, index=True)
  ```
* Verbatim Supabase SQL PK (`supabase_schema.sql:8`):
  ```sql
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  ```
* Verbatim Supabase migration script (`platform/backend/migrate_to_supabase.py:53`):
  ```python
  Base.metadata.create_all(bind=supabase_engine)
  ```

---

## 2. Logic Chain

### Reasoning on the Seed Data Organization Mismatch:
1. **Observation**: Projects in SQLite are registered with `organization_id = 1` (`Test Org`), but the users are registered with `organization_id = 2` (`KNCC Demo Org`).
2. **Observation**: The FastAPI route `GET /api/projects/` retrieves projects using the filter:
   `db.query(Project).filter(Project.organization_id == current_user.organization_id).all()`
3. **Inference**: A user logged in as `admin@kncc.com` or `engineer@kncc.com` will receive an empty list of projects, rendering the dashboard blank.
4. **Conclusion**: The demo seed accounts are misaligned with the seeded project organization records.

### Reasoning on Schema Type Mismatch:
1. **Observation**: SQLite models define `id` columns as integers (`Integer`), but the Postgres schema files in `supabase/` and root define them as UUIDs (`UUID`).
2. **Observation**: `migrate_to_supabase.py` runs `Base.metadata.create_all` which automatically generates the database schema on Supabase from the SQLAlchemy models.
3. **Inference**: This script forces Supabase/Postgres to use integer keys matching the SQLite layout, making it incompatible with the UUID schema files and the `user_org()` RLS policies.
4. **Conclusion**: There is a critical discrepancy in the database abstraction layers that will prevent a clean migration to Supabase unless resolved.

---

## 3. Caveats

* We did not establish a live connection to the remote Supabase database instance to inspect its tables, nor did we test the migration script `migrate_to_supabase.py` against a live instance.
* We assumed that the local SQLite database file `kncc_platform.db` represents the target state for local offline development.

---

## 4. Conclusion

The initial codebase exploration is complete. The system layout is mapped, the locations of all files are identified, and the exact database and API schemas are documented in `analysis.md`. Two critical codebase issues have been identified:
1. **Organization ID Mismatch**: Prevents demo users from seeing their projects in the UI.
2. **Key Type Incompatibility**: SQLite uses integer primary keys, while Supabase schema uses UUID primary keys.

---

## 5. Verification Method

To verify these findings independently:

1. **Verify the SQLite Database Seed Mismatch**:
   Run the following PowerShell command in the project root:
   ```powershell
   .\.venv\Scripts\python -c "import sqlite3; conn = sqlite3.connect('platform/backend/kncc_platform.db'); print('Project orgs:', conn.execute('select name, organization_id from projects').fetchall()); print('User orgs:', conn.execute('select email, organization_id from users').fetchall())"
   ```
   *Expected Output*: Projects will list `organization_id = 1` while users will list `organization_id = 2`.

2. **Verify the E2E Test Suite Execution**:
   Start the backend FastAPI server locally:
   ```powershell
   cd platform/backend
   ..\..\.venv\Scripts\uvicorn app.main:app --port 8000
   ```
   In a separate terminal, run the test script:
   ```powershell
   cd platform/backend
   ..\..\.venv\Scripts\python test_e2e.py
   ```
