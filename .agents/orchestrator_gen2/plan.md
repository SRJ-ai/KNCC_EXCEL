# Development Plan — 2026-07-02T21:40:57+05:30

## Objective
Implement and verify the four follow-up requirements:
1. **R1: Dynamic Excel Generation**: Generate `client_req_doc` Excel file from scratch, populating rows/columns and formulas without using a pre-filled template.
2. **R2: Data Persistence**: Persist application state using Supabase/local storage to retain uploaded PO/CO data, mappings, and results on page reload.
3. **R3: Interactive Row Changes**: Prompt user for confirmation before applying any row/material change from a CO/invoice.
4. **R4: Supabase Account Injection**: Automatically inject predefined test user accounts into Supabase auth for testing.

## Decomposition & Milestones
- **M5: Supabase Test User Account Injection (R4)**
  - Implement a mechanism (e.g. backend script, CLI, SQL function, or API endpoint) to automatically inject predefined test user accounts into Supabase authentication.
  - Verify that injected accounts can log in successfully.
- **M6: Backend & Frontend Data Persistence (R2)**
  - Store uploaded PO/CO data, visual mappings, and generated results in Supabase PostgreSQL or local storage.
  - Fix page reload state clearing in the React SPA.
- **M7: Dynamic Excel Generation from Scratch (R1)**
  - Re-write Excel export logic to build the Excel document programmatically from scratch using openpyxl.
  - Add all required formulas (Total Cost, Delivery %, Issues, etc.) to the generated sheets.
- **M8: Interactive Row Change Confirmations (R3)**
  - Update the React UI to detect change orders that modify rows/materials.
  - Show a confirmation modal or interactive prompt to get user approval before applying changes to the database/state.
- **M9: E2E Integration Verification & Forensic Integrity Audit**
  - Run all E2E tests, verifying layout correctness and application behavior.
  - Perform Forensic Auditor checks to ensure clean implementation.

## Coordination & Verification Strategy
- **Exploration**: Spawn Explorers to analyze the current system architecture, database schema, authentication structure, Excel generation libraries, and React frontend components.
- **Implementation**: Spawn Workers for each milestone.
- **Review**: Spawn Reviewers to check implementation correctness, security, and styling.
- **Audit**: Run Forensic Auditor to prevent integrity violations.
