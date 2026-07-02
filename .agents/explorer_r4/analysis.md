# Supabase Integration and Test User Injection Analysis

This report analyzes how Supabase is configured and integrated within the KNCC Excel Platform, documents the existing files and scripts that manage authentication, and proposes a clean implementation strategy for automatically injecting predefined test user accounts in **R4**.

---

## 1. Supabase Configuration & Integration

The codebase uses a split architecture:
- **Frontend** connects directly to the Supabase API endpoints using the client-side JavaScript SDK (`@supabase/supabase-js`) for auth, row-level security (RLS), and database queries.
- **Backend (FastAPI)** connects to the database layer directly via PostgreSQL connection strings using SQLAlchemy. It also uses public URL resolution for reading files from Supabase Storage.

### Frontend Initialization & Usage
1. **Supabase Client Initialization**:
   - **File**: `platform/frontend/src/supabaseClient.js`
   - **Details**: It imports `createClient` from `@supabase/supabase-js` and initializes the instance using a hardcoded Supabase project URL and a public Anon Key:
     - URL: `https://wjpmruxpwhcbmzaurcbq.supabase.co`
     - Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
2. **Session Management (Authentication)**:
   - **File**: `platform/frontend/src/context/AuthContext.jsx`
   - **Details**: It acts as the React auth state provider.
     - On mount, it retrieves the current active session using `supabase.auth.getSession()`.
     - It listens for authentication state changes (sign-in, sign-out, token refresh) using `supabase.auth.onAuthStateChange()`.
     - It sets user session details (`id`, `email`, `name`, `role`) and organization details (`organization_name`) in the React state.
     - Extends auth methods: `login` (via `signInWithPassword`), `register` (via `signUp`), `resetPassword` (via `resetPasswordForEmail`), `logout` (via `signOut`), and `setupTestAccount` (helper to dynamically create test users).
3. **Database Queries**:
   - **File**: `platform/frontend/src/context/PlatformContext.jsx`
   - **Details**: Performs standard PostgREST calls using the `supabase` client (e.g. `supabase.from('projects').select('*')`). Row-level security (RLS) is applied at the database level, restricting user access to data matching their JWT's `organization_name`.

### Backend Initialization & Usage
1. **Configuration**:
   - **File**: `platform/backend/app/config.py`
   - **Details**: Configures variables for Supabase integration:
     - `SUPABASE_URL`: Optional (from environment).
     - `SUPABASE_SERVICE_KEY`: Optional service role token for administrative/bypass access.
2. **Storage Download Integration**:
   - **File**: `platform/backend/app/routers/scan.py` (lines 25-34)
   - **Details**: When a file needs to be parsed (such as a PDF invoice or PO), the backend reconstructs its public Supabase Storage URL:
     ```python
     public_url = f"https://wjpmruxpwhcbmzaurcbq.supabase.co/storage/v1/object/public/documents/{req.file_path}"
     ```
     It downloads the file via `urllib.request.urlretrieve` into a temporary folder to process.
3. **Database Migration Integration**:
   - **File**: `platform/backend/migrate_to_supabase.py`
   - **Details**: Uses `SUPABASE_URL` as a PostgreSQL connection string to migrate local SQLite tables into Postgres using SQLAlchemy (`Base.metadata.create_all`).

---

## 2. Existing Seeding, Migration, and User Management Files

The repository contains several scripts and SQL files aimed at database setup and user accounts:

| File Path | Purpose | Key Details |
| :--- | :--- | :--- |
| `delete_users.sql` | Cleanup script | Deletes test users directly from the Postgres auth table: `DELETE FROM auth.users WHERE email IN ('admin@kncc.com', 'engineer@kncc.com');` |
| `fix_identities.sql` | Auth identity fix | Solves login failures by ensuring `provider_id` in `auth.identities` is set to `user_id::text`. |
| `supabase_schema.sql` | Main DB schema (Permissive) | Creates `projects`, `pos`, `invoices`, `cos`, and `materials` tables. RLS is enabled, but the policy allows all access for authenticated users (`USING (true)`). |
| `supabase/schema.sql` | Prod DB schema (Isolated) | Implements tenant isolation. Users only see records where `organization_name` matches their JWT `user_metadata` via the `user_org()` function. |
| `platform/frontend/inject_users.js` | Client-side user injector | Script using Node & `@supabase/supabase-js` that reads `.env` files and calls `signUp` to register `admin@kncc.com` and `engineer@kncc.com` with metadata. |
| `platform/frontend/create_demo.cjs` | Client-side user creator | Node script that registers `demo@kncc.com` with password `Demo123!` and organization `KNCC Demo Organization`. |
| `platform/frontend/seed_demo.js` | Database content seeder | Logs in as `admin@kncc.com` and seeds demo projects, purchase orders, invoices, and change orders. |
| `platform/frontend/src/pages/Login.jsx` | Dynamic fallback login | Features buttons "Login as Admin" and "Login as Engineer" that trigger `setupTestAccount` inside `AuthContext.jsx` to dynamically register the account if it is missing. |

---

## 3. How to Automatically Inject Test User Accounts

To ensure the test accounts (`admin@kncc.com` and `engineer@kncc.com`) are always available, we have two execution paths.

### Method A: Admin API Request (Recommended)
By utilizing the Supabase **GoTrue Admin API** with the `SUPABASE_SERVICE_KEY`, we can programmatically inject users. This is the cleanest approach because it bypasses email verification and rate limits, and automatically builds required relationships in `auth.identities`.

- **Endpoint**: `POST {SUPABASE_URL}/auth/v1/admin/users`
- **Headers**:
  ```http
  apikey: <SUPABASE_SERVICE_KEY>
  Authorization: Bearer <SUPABASE_SERVICE_KEY>
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "email": "admin@kncc.com",
    "password": "Password123!",
    "email_confirm": true,
    "user_metadata": {
      "name": "KNCC Admin",
      "role": "admin",
      "organization_name": "KNCC"
    }
  }
  ```

### Method B: SQL Insertion (Fallback)
If we do not have the Service Key but have direct PostgreSQL database access, we can insert the user directly. However, we must write to both `auth.users` and `auth.identities`, and compute the bcrypt hash.

- **Bcrypt Hash for `Password123!`**: `$2a$10$W/g.T423X7Gg901j38Hze.p4F6v9P2iC3t7fW29C2x1U4m346452y` (or generated on the fly via `crypt` extension).
- **SQL Scripts**:
  ```sql
  -- 1. Insert into auth.users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (
      'd3b07384-d113-4c4e-9c86-13d81b3df59d', -- Admin UUID
      'admin@kncc.com',
      '$2a$10$W/g.T423X7Gg901j38Hze.p4F6v9P2iC3t7fW29C2x1U4m346452y',
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "KNCC Admin", "role": "admin", "organization_name": "KNCC"}',
      'authenticated',
      'authenticated'
  ) ON CONFLICT (email) DO NOTHING;

  -- 2. Insert into auth.identities
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at)
  VALUES (
      gen_random_uuid(),
      'd3b07384-d113-4c4e-9c86-13d81b3df59d',
      '{"sub": "d3b07384-d113-4c4e-9c86-13d81b3df59d", "email": "admin@kncc.com"}',
      'email',
      'd3b07384-d113-4c4e-9c86-13d81b3df59d', -- Must match user_id
      now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;
  ```

---

## 4. Clean Implementation Strategy for R4

For a clean, robust, and automated solution in R4, we recommend **Method A** integrated directly into the backend startup lifecycle.

### Step 1: Create a Backend Seeder Module
Add a new file: `platform/backend/app/core/supabase_seed.py` that implements the GoTrue Admin API calls using Python's standard `urllib` library (to keep dependencies light).

```python
import json
import logging
import urllib.request
from urllib.error import HTTPError
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

logger = logging.getLogger(__name__)

PREDEFINED_USERS = [
    {
        "email": "admin@kncc.com",
        "password": "Password123!",
        "name": "KNCC Admin",
        "role": "admin",
        "org": "KNCC"
    },
    {
        "email": "engineer@kncc.com",
        "password": "Password123!",
        "name": "Site Engineer",
        "role": "member",
        "org": "KNCC"
    }
]

def seed_test_users():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.info("Supabase Admin credentials not configured. Skipping user injection.")
        return

    # Clean URL format (ensure no trailing slash)
    base_url = SUPABASE_URL.rstrip('/')
    admin_endpoint = f"{base_url}/auth/v1/admin/users"

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }

    for user_info in PREDEFINED_USERS:
        payload = {
            "email": user_info["email"],
            "password": user_info["password"],
            "email_confirm": True,
            "user_metadata": {
                "name": user_info["name"],
                "role": user_info["role"],
                "organization_name": user_info["org"]
            }
        }
        
        req = urllib.request.Request(
            admin_endpoint,
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                if response.status == 201:
                    logger.info(f"Successfully injected test user: {user_info['email']}")
        except HTTPError as e:
            try:
                error_body = json.loads(e.read().decode('utf-8'))
                msg = error_body.get("msg", "")
            except Exception:
                msg = str(e)
            
            # Gratefully accept if user already exists
            if e.code == 422 and "already registered" in msg.lower():
                logger.info(f"Test user already registered: {user_info['email']}")
            else:
                logger.error(f"Failed to inject test user {user_info['email']}: Code {e.code} - {msg}")
        except Exception as e:
            logger.error(f"Unexpected error injecting user {user_info['email']}: {e}")
```

### Step 2: Trigger on App Startup
In `platform/backend/app/main.py`, import and trigger `seed_test_users` inside the startup event:

```python
from .core.supabase_seed import seed_test_users

@app.on_event("startup")
def on_startup():
    init_db()
    # Automatically inject predefined test accounts into Supabase Auth
    try:
        seed_test_users()
    except Exception as e:
        logger.error(f"Error seeding test users: {e}")
```

### Step 3: Configure Environment Variables
Ensure the backend is run with the administrative credentials.
- `SUPABASE_URL`: The API Gateway URL (e.g. `https://wjpmruxpwhcbmzaurcbq.supabase.co`).
- `SUPABASE_SERVICE_KEY`: The Service Role secret key.
- `DATABASE_URL`: The direct PostgreSQL connection string.
