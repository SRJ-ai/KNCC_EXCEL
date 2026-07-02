# Codebase State Persistence Analysis

## Executive Summary
The KNCC Excel platform suffers from page-reload and navigation data loss during the document upload and preview workflow because transient staging states (step index, uploaded file details, and parsed visual mappings) are stored purely in React component-local `useState` memory inside `UploadCenter.jsx`. This analysis details the exact data flow, explains the root causes of the data loss, and proposes two persistence strategies (Local Storage and Supabase Database Staging) to make the upload wizard resilient.

---

## 1. Current Storage & Management Flow

PO/CO/Invoice data passes through three phases in the system: **Upload**, **Staging/Preview**, and **Confirmation/Commit**.

| Data Type | Stage | Storage Location | Management Mechanism |
|---|---|---|---|
| **Raw PDF File** | Uploaded | Supabase Storage (Cloud) & Backend Disk (`UPLOAD_DIR`) | The file is uploaded to the Supabase `documents` bucket under `${user_id}/${timestamp}.pdf` via `@supabase/supabase-js`, and concurrently posted to backend `/api/upload/` which stores it in `platform/backend/data/uploads` for processing. |
| **Visual Mappings & Staging Items** | Staging / Preview | React Component-local State (`UploadCenter.jsx`) | Generated dynamically on the backend `/api/upload/preview` by parsing the PDF and matching lines to Excel requirements. Returned as transient JSON and held in the frontend `preview` state variable. No database write occurs for staging data. |
| **Confirmed & Generated Results** | Committed / Saved | SQLite / Supabase Database | Written upon `/api/upload/confirm`. Backend commits a `Document` record (with `parsed_data_json`), creates `Material` entries (for POs), creates `COAdjustment` entries (for COs), and records `Delivery` mapping entries (for Invoices). |

### Detailed Call Flow

```
[Frontend (UploadCenter.jsx)]
  │
  ├── 1. Upload PDF file
  │    ├── Write: Supabase Storage Bucket ('documents')
  │    └── Write: Backend filesystem (POST /api/upload/ saves to UPLOAD_DIR)
  │
  ├── 2. Get Staging Preview
  │    └── Read: POST /api/upload/preview
  │         ├── Backend parses PDF from UPLOAD_DIR
  │         ├── Backend matches lines to Excel cells via _match_line_to_material
  │         └── Returns transient JSON mapping payload (preview_items)
  │
  ├── 3. Render Preview (Step 1)
  │    └── Transiently stored in React `useState` memory (preview)
  │
  └── 4. Apply Changes
       └── POST /api/upload/confirm
            ├── Backend reads file, commits metadata to `documents` table
            ├── Inserts `materials` (PO), `co_adjustments` (CO), or `deliveries` (INV)
            └── Returns success metadata, stored in frontend `lastResult` state
```

---

## 2. Root Cause of Frontend Data Loss

There are two primary user actions that trigger data loss: **Browser Refresh (Page Reload)** and **Sidebar Navigation**.

### A. Browser Refresh (Page Reload)
- **What happens**: The entire JavaScript context, including React Context providers (`AuthProvider`, `PlatformProvider`) and component-local states, is torn down and re-initialized.
- **State Recovery status**:
  - `PlatformContext` successfully recovers the `activeProject` state by reading `localStorage.getItem('kncc_active_project')` on mount.
  - However, the transient states of the `UploadCenter.jsx` component (`step`, `preview`, `uploadedFile`, `docType`, `lastResult`) are not saved anywhere. Consequently, they re-initialize to default values (`step = 0`, `preview = null`), taking the user back to the upload screen and forcing them to re-upload.

### B. Sidebar Navigation (Navigating Away)
- **What happens**: React Router unmounts the `UploadCenter` component to render the newly requested route (e.g., `MaterialGrid` or `Dashboard`).
- **State Recovery status**:
  - Since React component states are bound to the component's mount lifecycle, unmounting destroys all local `useState` variables in memory.
  - When the user clicks the "Upload Center" button on the sidebar again, the component mounts fresh. The staging state is completely gone.

---

## 3. Analysis of Frontend and Backend Components

### Frontend Context: `ProjectContext.jsx` vs `PlatformContext.jsx`
- **`ProjectContext.jsx`**: An obsolete context defining `ProjectProvider` and `useProject` which fetches data from `${API_BASE}/projects/`. **This context is not imported or used anywhere in the codebase.**
- **`PlatformContext.jsx`**: The active, global application context. It uses the `supabase` client to directly read/write project metadata, materials, change orders, and documents. It handles persisting `activeProject` to `localStorage` but does not support any staging or draft storage for upload files.

### Frontend Component: `UploadCenter.jsx`
- Holds the following critical transient states in local hooks (lines 44-53):
  ```javascript
  const [step, setStep]           = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [docType, setDocType]     = useState('PO');
  const [preview, setPreview]     = useState(null);
  const [lastResult, setLastResult] = useState(null);
  ```
- Lacks lifecycle hooks (`useEffect`) to restore state on mount or synchronize state changes to a persistent cache.

### Backend Routes: `upload.py` and `scan.py`
- **`upload.py`**:
  - Implements `/api/upload/` (Step 1), `/api/upload/preview` (Step 1.5), and `/api/upload/confirm` (Step 2).
  - Expects files to remain in `UPLOAD_DIR` between the preview and confirm steps. If the backend restarts or serverless container recycles during staging, the file in `/tmp/uploads` is lost, causing `/confirm` to fail.
- **`scan.py`**:
  - Exposes `/api/scan/document`, which downloads files from the public Supabase storage bucket, parses them, and returns formatted materials.
  - This route is modular but redundant, as `UploadCenter.jsx` currently bypasses it in favor of the `upload.py` preview flow.

---

## 4. Proposed State Persistence Strategies

To resolve this issue, we can persist the staging state using either **Client-side Local Storage** or **Supabase Database Staging**.

### Strategy 1: Client-Side Local Storage (Recommended for simplicity & performance)

Staging states are stored in the browser's `localStorage` namespace, segmented by the `activeProject.id` to prevent cross-project state pollution.

#### Flow diagram:
```
[State Change] ────> Sync to localStorage: `kncc_upload_[project_id]_[state_name]`
[On Mount]     ────> Read from localStorage to hydrate `useState` variables
[On Confirm/Discard] ──> Clear state in memory & remove items from localStorage
```

#### Proposed Changes in `UploadCenter.jsx`:

1. **Hydration Hook (on mount / project change)**:
   ```javascript
   useEffect(() => {
     if (!activeProject) {
       handleReset(); // Reset states to defaults
       return;
     }

     const projectId = activeProject.id;
     const savedStep = localStorage.getItem(`kncc_upload_${projectId}_step`);
     const savedDocType = localStorage.getItem(`kncc_upload_${projectId}_docType`);
     const savedUploadedFile = localStorage.getItem(`kncc_upload_${projectId}_uploadedFile`);
     const savedPreview = localStorage.getItem(`kncc_upload_${projectId}_preview`);
     const savedLastResult = localStorage.getItem(`kncc_upload_${projectId}_lastResult`);

     if (savedStep !== null) setStep(Number(savedStep));
     if (savedDocType !== null) setDocType(savedDocType);
     if (savedUploadedFile !== null) setUploadedFile(JSON.parse(savedUploadedFile));
     if (savedPreview !== null) setPreview(JSON.parse(savedPreview));
     if (savedLastResult !== null) setLastResult(JSON.parse(savedLastResult));
   }, [activeProject?.id]);
   ```

2. **Persistence Hooks (state change synchronizers)**:
   ```javascript
   useEffect(() => {
     if (!activeProject) return;
     localStorage.setItem(`kncc_upload_${activeProject.id}_step`, step);
   }, [step, activeProject?.id]);

   useEffect(() => {
     if (!activeProject) return;
     localStorage.setItem(`kncc_upload_${activeProject.id}_docType`, docType);
   }, [docType, activeProject?.id]);

   useEffect(() => {
     if (!activeProject) return;
     if (uploadedFile) {
       localStorage.setItem(`kncc_upload_${activeProject.id}_uploadedFile`, JSON.stringify(uploadedFile));
     } else {
       localStorage.removeItem(`kncc_upload_${activeProject.id}_uploadedFile`);
     }
   }, [uploadedFile, activeProject?.id]);

   useEffect(() => {
     if (!activeProject) return;
     if (preview) {
       localStorage.setItem(`kncc_upload_${activeProject.id}_preview`, JSON.stringify(preview));
     } else {
       localStorage.removeItem(`kncc_upload_${activeProject.id}_preview`);
     }
   }, [preview, activeProject?.id]);

   useEffect(() => {
     if (!activeProject) return;
     if (lastResult) {
       localStorage.setItem(`kncc_upload_${activeProject.id}_lastResult`, JSON.stringify(lastResult));
     } else {
       localStorage.removeItem(`kncc_upload_${activeProject.id}_lastResult`);
     }
   }, [lastResult, activeProject?.id]);
   ```

3. **Clearing Staging States (on Confirm/Discard/Reset)**:
   ```javascript
   const clearStagingStorage = () => {
     if (!activeProject) return;
     const projectId = activeProject.id;
     localStorage.removeItem(`kncc_upload_${projectId}_step`);
     localStorage.removeItem(`kncc_upload_${projectId}_docType`);
     localStorage.removeItem(`kncc_upload_${projectId}_uploadedFile`);
     localStorage.removeItem(`kncc_upload_${projectId}_preview`);
     localStorage.removeItem(`kncc_upload_${projectId}_lastResult`);
   };
   ```
   Add a call to `clearStagingStorage()` inside `handleDiscard()`, `handleReset()`, and at the end of the `handleConfirm()` success sequence.

---

### Strategy 2: Supabase Staging Database (Recommended for multi-device collaboration)

Staging states are written to a dedicated table in Supabase. This allows a user to upload a document on one computer and review the diff on another, keeping the workspace synchronized.

#### Proposed SQL Schema Migration:
```sql
CREATE TABLE IF NOT EXISTS public.upload_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    step INTEGER DEFAULT 0,
    uploaded_file JSONB,
    preview JSONB,
    last_result JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_project_draft UNIQUE (project_id)
);

-- Enable RLS and create policy
ALTER TABLE public.upload_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.upload_drafts FOR ALL USING (true);
```

#### Proposed Changes in `PlatformContext.jsx` (Global draft handlers):
```javascript
  const fetchUploadDraft = async (projectId) => {
    const { data, error } = await supabase
      .from('upload_drafts')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    return data;
  };

  const saveUploadDraft = async (projectId, draftData) => {
    await supabase.from('upload_drafts').upsert({
      project_id: projectId,
      user_id: user?.id,
      ...draftData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'project_id' });
  };

  const deleteUploadDraft = async (projectId) => {
    await supabase.from('upload_drafts').delete().eq('project_id', projectId);
  };
```

#### Proposed Changes in `UploadCenter.jsx` (Integrating server-side staging):
- **On Mount / project change**: Fetch draft from Supabase and hydrate.
- **On Upload Complete & Preview fetched**: Call `saveUploadDraft(activeProject.id, { step: 1, doc_type: docType, uploaded_file: uploadedFile, preview: previewData })`.
- **On Confirm / Discard**: Call `deleteUploadDraft(activeProject.id)`.

---

## 5. Strategy Comparison & Recommendation

| Criteria | Strategy 1: Local Storage | Strategy 2: Supabase Staging |
|---|---|---|
| **Implementation Complexity** | **Very Low** (Pure frontend change, ~30 lines in `UploadCenter.jsx`). | **Medium** (Database migrations, RLS policies, new context methods, async operations). |
| **Performance** | **Instantaneous** (Read/write from local memory). | **Latency-dependent** (Requires API queries to Supabase on state change/mount). |
| **Cross-Device Sync** | No (Stored locally in user browser). | **Yes** (Shared database state). |
| **Data Safety** | Medium (Clearing browser storage removes it). | **High** (Stored persistently in PostgreSQL). |
| **Backend File Survival** | Medium (Relies on files staying in `/tmp/uploads` on FastAPI backend; if server recycles, `/confirm` fails). | **High** (Backend can be modified to download the file directly from Supabase Storage instead of local `UPLOAD_DIR`). |

### Recommendation
**Strategy 1 (Local Storage)** is the recommended path for immediate resolution. It solves the core problem of navigation and browser refresh loss with zero friction, zero database modifications, and zero API round-trips. 

If future requirements mandate multi-device review flows or long-term draft storage, **Strategy 2 (Supabase)** should be adopted. Additionally, migrating backend `/confirm` in `upload.py` to download files from Supabase Storage using the path in `uploadedFile` is highly recommended to eliminate reliance on local backend disk storage (WAL / tmp folders).
