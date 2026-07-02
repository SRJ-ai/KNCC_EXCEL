## 2026-07-02T16:15:28Z
Implement R4: Supabase Account Injection.
1. Add a startup lifecycle event or function in `platform/backend/app/main.py` to automatically inject the test accounts `admin@kncc.com` and `engineer@kncc.com` (both password `Password123!`) using the GoTrue Admin API `POST /auth/v1/admin/users` authorized via `SUPABASE_SERVICE_KEY` and using the URL from `SUPABASE_URL`.
2. The injection should run safely, check if the users already exist, use metadata fields (`role`, `name`, `organization_name`), and auto-confirm email (`email_confirm: true`).
3. Ensure it runs cleanly, handle errors gracefully so that if keys are missing it skips with a warning.
4. Write a script `platform/backend/inject_test_accounts.py` that can be run standalone to perform this injection for testing purposes.
5. Run backend unit tests to ensure no regressions. Write your changes and handoff report to `C:\Users\Admin\Desktop\KNCC_EXCEL\.agents\implementer_1`.
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work.
