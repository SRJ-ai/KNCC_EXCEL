# Handoff Report — explorer_r2

## 1. Observation
- In `platform/frontend/src/pages/UploadCenter.jsx` (lines 44-52), the staging states are stored locally:
  ```javascript
  const [step, setStep]           = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [docType, setDocType]     = useState('PO');
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview]     = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  ```
- In `platform/frontend/src/context/PlatformContext.jsx`, `activeProject` is persisted via local storage:
  ```javascript
  const [activeProject, setActiveProject] = useState(() => {
    const saved = localStorage.getItem('kncc_active_project');
    return saved ? JSON.parse(saved) : null;
  });
  ```
  But there are no functions or hooks in `PlatformContext` or `UploadCenter` for caching the staging states.
- In `platform/frontend/src/context/ProjectContext.jsx`, there are definitions for a context:
  ```javascript
  const ProjectContext = createContext(null);
  ```
  However, search results show this context is never imported in any file inside `platform/frontend/src`.
- In `platform/backend/app/routers/upload.py`, `/api/upload/preview` generates the transient mappings dynamically (lines 220-356) and `/api/upload/confirm` writes the confirmed data to the backend DB using SQLAlchemy (lines 359-514). Staging preview JSON is not stored in the database.

---

## 2. Logic Chain
1. *Step 1*: When the user starts the upload flow, `UploadCenter.jsx` calls `/api/upload/preview` and receives a parsed JSON payload with visual mapping structures.
2. *Step 2*: The component transitions to Step 1 (Preview mode) and stores this JSON in its local state (`preview`).
3. *Step 3*: Since the staging states are held solely in `UploadCenter`'s React `useState` memory, if a page reload occurs, the React environment is destroyed, resetting all state variables back to their default values (e.g. `step` to `0`, `preview` to `null`).
4. *Step 4*: Similarly, when the user navigates away using the sidebar routes, the React Router unmounts the `UploadCenter` component, cleaning up its local state memory. Returning to the page mounts the component from scratch, causing data loss.
5. *Step 5*: To prevent this data loss, the staging states must be persisted to a location that survives browser refreshes and component unmounts. Caching in `localStorage` keyed by `kncc_upload_[activeProject.id]_[state]` will keep the state safe and easily recoverable upon mount.

---

## 3. Caveats
- Relying on `/tmp/uploads` on the backend disk for the duration of the staging step is a potential point of failure. If the backend is running in a serverless container (e.g., Vercel) or a platform like Render where containers cycle periodically, the local file in `UPLOAD_DIR` could be deleted between `/preview` and `/confirm`. The proposed local storage frontend solution fixes the frontend reload issue but does not prevent backend container recycle file loss. A complete solution would store the file in Supabase storage and have the backend download it from there during `/confirm` (using the path stored in the `uploadedFile` object).

---

## 4. Conclusion
Page-reload and navigation data loss is caused by transient upload/preview states being stored purely in local React component state variables inside `UploadCenter.jsx`, which unmounts or resets on navigation/refresh. The recommended solution is to persist the staging states in browser `localStorage` keyed by the project ID. Alternatively, we can use a dedicated Supabase staging table for full cross-device synchronization.

---

## 5. Verification Method
1. Open the frontend and select a project.
2. Navigate to "Upload Center", select "Purchase Order", and upload a sample lumber PDF.
3. Once the AI finishes parsing and shows the review page (Step 1), refresh the page. Check if the page goes back to the select file screen (Step 0) instead of preserving the review diff.
4. Navigate away to the "Materials" page on the sidebar, then click "Upload Center". Check if the preview state is lost.
5. Verify that `platform/frontend/src/context/ProjectContext.jsx` is indeed unused by running the grep query `useProject` across the code.
