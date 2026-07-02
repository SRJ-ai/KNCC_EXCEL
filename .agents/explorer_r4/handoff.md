# Handoff Report - explorer_r4

## 1. Observation

### Frontend Supabase Configuration and Auth State Management
- **File**: `platform/frontend/src/supabaseClient.js`
  - Line 5-6: Initializes Supabase Client using hardcoded values:
    ```javascript
    const supabaseUrl = 'https://wjpmruxpwhcbmzaurcbq.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcG1ydXhwd2hjYm16YXVyY2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDYzMjcsImV4cCI6MjA5ODAyMjMyN30.N6gYkDaLBG3ZMWl2DSvuyrFipnuu4DOeu8YJRXhj9pk';
    ```
- **File**: `platform/frontend/src/context/AuthContext.jsx`
  - Line 22-23: Fetches active sessions:
    ```javascript
    supabase.auth.getSession().then(({ data: { session } }) => {
    ```
  - Line 101-118: Implements `setupTestAccount` helper for fallback signup:
    ```javascript
      const setupTestAccount = async (email, password, role, name) => {
        try {
          // Try login first
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            // If it fails, sign up
            const { error: signUpError } = await supabase.auth.signUp({
              email, password,
              options: {
                data: { name, organization_name: 'KNCC', role }
              }
            });
    ```
- **File**: `platform/frontend/src/pages/Login.jsx`
  - Line 91-95: Triggers test logins based on buttons:
    ```javascript
      if (type === 'admin') {
        await setupTestAccount('admin@kncc.com', 'Password123!', 'admin', 'Admin User');
      } else {
        await setupTestAccount('engineer@kncc.com', 'Password123!', 'member', 'Site Engineer');
      }
    ```

### Backend Supabase Configuration and Storage Integration
- **File**: `platform/backend/app/config.py`
  - Line 49-50: Configures backend Supabase keys:
    ```python
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    ```
- **File**: `platform/backend/app/routers/scan.py`
  - Line 25-26: Reconstructs document public Storage URL:
    ```python
    # Reconstruct public Supabase URL
    public_url = f"https://wjpmruxpwhcbmzaurcbq.supabase.co/storage/v1/object/public/documents/{req.file_path}"
    ```
- **File**: `platform/backend/migrate_to_supabase.py`
  - Line 33: Builds a SQLAlchemy engine using `SUPABASE_URL`:
    ```python
    supabase_engine = create_engine(SUPABASE_URL)
    ```

### Existing Scripts Managing Users
- **File**: `delete_users.sql` (line 1):
  ```sql
  DELETE FROM auth.users WHERE email IN ('admin@kncc.com', 'engineer@kncc.com');
  ```
- **File**: `fix_identities.sql` (line 3-6):
  ```sql
  UPDATE auth.identities 
  SET 
      provider_id = user_id::text
  WHERE provider_id IS NULL OR provider_id = '';
  ```
- **File**: `platform/frontend/inject_users.js` (line 33-43):
  ```javascript
  const { data, error } = await supabase.auth.signUp({
    email: u.email,
    password: u.password,
    options: {
      data: {
        name: u.name,
        role: u.role,
        organization_name: 'KNCC'
      }
    }
  });
  ```

---

## 2. Logic Chain

1. **User Request**: Find how Supabase is configured and locate auth initialization/usage.
2. **Observation**: Supabase is configured via `supabaseClient.js` using hardcoded anon keys. Authentication state is handled via `AuthContext.jsx` using `@supabase/supabase-js`'s GoTrue functions. The backend connects directly to the Supabase database via PostgreSQL `DATABASE_URL` or `SUPABASE_URL` in `config.py` and `migrate_to_supabase.py`.
3. **Observation**: The test accounts to inject are `admin@kncc.com` and `engineer@kncc.com` (both using `Password123!`).
4. **Observation**: There are scripts like `inject_users.js` and `Login.jsx:setupTestAccount` that perform signup operations. However, these are client-side only and subject to rate limits and email confirmation delays if auto-confirm is disabled.
5. **Observation**: GoTrue provides an Admin API (`POST /auth/v1/admin/users`) that can bypass client limits, auto-confirm accounts (`email_confirm: true`), and configure metadata when authorized with the `SUPABASE_SERVICE_KEY`.
6. **Conclusion**: An automatic test user injection flow should be implemented at backend startup inside the FastAPI app using the GoTrue Admin API. This avoids rate-limiting, handles email auto-confirmation natively, and avoids schema integrity issues compared to direct SQL insertion.

---

## 3. Caveats

- **Supabase Credentials**: This backend seeder relies on the `SUPABASE_SERVICE_KEY` and the correct GoTrue API URL being set in the environment variables (`SUPABASE_URL`). If they are not supplied during development or CI/CD, the seeder will skip user injection.
- **GoTrue API changes**: If Supabase changes its underlying GoTrue Admin API paths (which is unlikely as they are standard), the HTTP request format might require updating.

---

## 4. Conclusion

The codebase currently configures Supabase in the React frontend via `supabaseClient.js` (hardcoded URL/Anon key) and utilizes it in `AuthContext.jsx` and `PlatformContext.jsx` for RLS. The backend directly connects to the DB engine. We can automatically inject test users (`admin@kncc.com` and `engineer@kncc.com`) by calling the GoTrue Admin API (`/auth/v1/admin/users`) during the backend FastAPI startup lifecycle, utilizing the `SUPABASE_SERVICE_KEY`.

---

## 5. Verification Method

To verify the findings and proposed implementation:
1. **Inspect Analysis File**: Read the completed analysis report at `platform/backend/app/config.py`, `platform/frontend/src/supabaseClient.js`, and `platform/frontend/src/context/AuthContext.jsx` to confirm the paths and configuration described.
2. **Simulate Admin API Request**:
   Send a mock request using `curl` (if in a non-restricted environment) or verify via a Python script to ensure `POST /auth/v1/admin/users` registers a user with metadata:
   ```bash
   curl -X POST "https://wjpmruxpwhcbmzaurcbq.supabase.co/auth/v1/admin/users" \
     -H "apikey: $SUPABASE_SERVICE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"email":"test_verify@kncc.com","password":"Password123!","email_confirm":true,"user_metadata":{"name":"Verify User","role":"admin","organization_name":"KNCC"}}'
   ```
3. **Verify Table Entry**: Run `SELECT * FROM auth.users WHERE email = 'test_verify@kncc.com'` to confirm the user was correctly created and auto-confirmed.
