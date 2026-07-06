# Original User Request

## Initial Request — 2026-07-01T01:02:49+05:30

Build a web application with a user interface to automate the extraction and mapping of data from PO (Purchase Order) and CO (Change Order) invoices. The application must visually display extracted data, handle secure authentication, persist data across sessions, and generate Excel files that exactly match the format specified in `Client_Requirments_Doc.xlsx`.

Working directory: `c:\Users\Admin\Desktop\KNCC_EXCEL`
Integrity mode: development

## Requirements

### R1. Authentication & Session Management
Implement a secure authentication system using JWTs (JSON Web Tokens). It must use session-based authentication with short-lived access tokens.

### R2. Data Persistence
The application state must be persisted (e.g., via backend database, local storage, or secure session management) so that if the user refreshes the page or navigates away and comes back, their uploaded PO/CO data, visual mappings, and generated results are retained and not lost.

### R3. Web Application UI
Build a web application interface that allows authenticated users to upload Purchase Order (PO) and Change Order (CO) PDFs in a step-by-step workflow.

### R4. PO Processing & Visualization
When a PO is uploaded, the system must extract the materials and costs (including added tax) and display them visually to the user in the UI so they can verify what was extracted.

### R5. Excel Generation
Provide functionality (e.g., a "Generate Excel" button) to generate and download an Excel file containing the mapped PO data. The structure and formatting of this generated Excel file must precisely match the format provided in `Client\Client_Requirments_Doc.xlsx`.

### R6. CO Processing & Visualization
After PO processing, when a CO (Change Order) is uploaded, the system must process it against the existing PO data. The UI must visually display exactly what materials were removed and what new materials were added as a result of the change order.

## Acceptance Criteria

### Security & State
- [ ] Programmatic verification: The application issues short-lived JWT access tokens upon login.
- [ ] Agent-as-judge: A UI testing agent can confirm that refreshing the browser or navigating away and back does not clear the current upload state, and the previously extracted PO/CO data remains visible.

### Data Formatting & Accuracy
- [ ] Programmatic verification: Using sample PO/CO PDFs from the repository, a script can successfully generate an Excel file.
- [ ] Programmatic verification: The generated Excel file's schema, headers, and structure exactly match `Client\Client_Requirments_Doc.xlsx`.

### Visual Workflow
- [ ] Agent-as-judge: A UI testing agent or script can confirm that uploading a PO results in materials and costs being displayed on the screen.
- [ ] Agent-as-judge: A UI testing agent can confirm that uploading a subsequent CO visually highlights which materials were added or removed.

## Follow-up — 2026-07-02T21:40:17+05:30

Build a web application that parses Purchase Orders (POs) and Change Orders (COs) to dynamically generate the `client_req_doc` Excel file entirely from scratch (without pre-filled templates). The system must securely persist data across page reloads, require user confirmation before applying row changes, and automatically provision test accounts in Supabase.

Working directory: c:\Users\Admin\Desktop\KNCC_EXCEL
Integrity mode: development

## Requirements

### R1. Dynamic Excel Generation
The system must generate the `client_req_doc` Excel file from scratch. Materials extracted from Purchase Orders should dynamically populate the rows and columns, along with all necessary formulas, without relying on a pre-filled template.

### R2. Data Persistence (Fixing Page Reload Data Loss)
The application state must be properly persisted using Supabase or local storage so that if the user refreshes the page or navigates away and comes back, their uploaded PO/CO data, visual mappings, and generated results are retained.

### R3. Interactive Row Changes
Any time a row or material change occurs (e.g., from a Change Order or Invoice), the system must explicitly prompt the user for confirmation before applying the change. The UI approach is left to the team's discretion.

### R4. Supabase Account Injection
The system must include a mechanism to automatically inject predefined test user accounts (with username and password) into the Supabase authentication system for testing purposes. The technical approach is left to the team's discretion.

## Acceptance Criteria

### Security & State
- [ ] Programmatic verification: A UI testing agent can confirm that refreshing the browser does not clear the current upload state, and the previously extracted PO/CO data remains visible.
- [ ] Programmatic verification: The provided script successfully creates the specified test accounts in Supabase and those accounts can successfully log in.

### Data Formatting & Accuracy
- [ ] Programmatic verification: Using a blank template or starting from scratch, the system generates an Excel file where PO materials are correctly populated into rows.
- [ ] Programmatic verification: The generated Excel file contains all required formulas (Total Cost, Delivery %, Issues, etc.) calculated correctly for the newly added rows.
- [ ] Agent-as-judge: A UI testing agent can confirm that the system pauses and asks for user confirmation before applying row changes from a Change Order.

## Follow-up — 2026-07-06T10:05:16Z

Fix the PDF upload and confirmation pipeline so that materials successfully appear in the Material Grid and Excel exports, and intelligently map POs, Invoices, and Change Orders to exactly match the formatting in `Client_Requirments_Doc.xlsx` (including Willow Way's specific formatting).

Working directory: C:\Users\Admin\Desktop\KNCC_EXCEL

Integrity mode: development

## Requirements

### R1. Fix Data Persistence
Fix the `/api/upload/confirm` endpoint so that uploaded PDF line items are successfully persisted into the database and instantly reflect in the frontend Material Grid.

### R2. Intelligent Local Mapping (For Existing & New Projects)
Implement intelligent local heuristics (regex, fuzzy matching, text similarity) to precisely map POs, Invoices, and Change Orders to the exact formatting defined in `Client_Requirments_Doc.xlsx` (covering Willow Way and Cobia Cove). Crucially, the logic must be generalized so that **new projects** and their documents can also be extracted and mapped seamlessly without requiring code changes.

### R3. Excel Export Generation
Build a feature to generate and download a brand new Excel file from the frontend. The generated file must perfectly mimic the original `Client_Requirments_Doc.xlsx` template structure but be populated with the live mapped project data.

## Acceptance Criteria

### R1 Verification
- [ ] Submitting a valid payload to `/api/upload/confirm` results in a 200 OK response (no 500 errors).
- [ ] Database query confirms the materials are successfully inserted into the `materials` table.

### R2 Verification
- [ ] A programmatic test script proves that raw PDF line items for "Willow Way" successfully match the corresponding template rows.
- [ ] A programmatic test script proves that a document for a brand-new, unrecognized project is successfully extracted and mapped without crashing.
- [ ] Invoices and Change Orders correctly adjust the quantities of the mapped materials instead of duplicating them.

### R3 Verification
- [ ] Triggering the Excel export generates a valid `.xlsx` file.
- [ ] The generated Excel file contains the exact column headers and sheet structure found in the original `Client_Requirments_Doc.xlsx` template.
