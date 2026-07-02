# Codebase Analysis: Excel Generation (R1) & Change Orders (R3)

## Summary of Findings
The current Excel generation pipeline depends on copying a static legacy Excel template (`Client_Requirments_Doc.xlsx`) and overlaying data values and formulas. This creates a brittle dependency on pre-existing styles and layouts. In contrast, Change Order (CO) processing successfully parses PDF line items, matches them to database `Material` records, and updates database quantities, but fails to sync individual CO column data back to the exported spreadsheet. This document outlines:
1. An exhaustive specification to rewrite Excel generation from scratch using `openpyxl`.
2. A detailed analysis of how COs are currently processed, mapped, and synced.
3. A design proposal for the React UI to prompt users with a confirmation modal detailing the specific material rows and quantities that a CO will affect before committing changes.

---

## 1. Excel Generation Pipeline & Template Dependency (R1)

### File Locations
- **`platform/backend/app/services/excel_sync.py`**: Exports project sheets. It copies `Client_Requirments_Doc.xlsx` from `config.LEGACY_EXCEL` to `config.EXPORT_DIR`, injects delivery dates, matches materials to rows, writes quantities, and inserts 13 delivery/inventory formulas per row.
- **`platform/backend/app/routers/export.py`**: Handles on-the-fly export requests (`/client-requirements` with PO/CO/invoice payloads) and project-specific database exports (`/{project_id}` via `sync_excel_for_project`).
- **`platform/backend/app/services/excel_generator.py`**: Contains helper methods (`process_invoices_for_sheet`, `process_change_orders_for_sheet`) that apply fuzzy matching to find material rows and overlay transaction data.

### Current Template Dependency
The templates contain hardcoded sheet names and data structures:
1. **Sheet Names**:
   - `"Cobia Cove Appartments"`
   - `"Willow Way Apts"`
   - `"VPO's"`
2. **Hardcoded Row & Column Ranges**:
   - **Cobia Cove**: 4 data ranges: rows `3–118`, `123–152`, `157–170`, and `173–176`. Delivery start column is `BC`. Total Delivered starts at `DV`.
   - **Willow Way**: 1 data range: rows `3–78`. Delivery start column is `AD`. Total Delivered starts at `AV`.
   - **VPO's**: Rows start at `3`. Fields are Date, Description, Qty, UOM, Footage, Price, Amount, Tax, Total, CO Ref, CO #, Remarks.

If the file structure, sheet names, or data ranges of the template change slightly, or if the template file itself is missing, the Excel export pipeline crashes or corrupts data due to mismatching row indices and hardcoded offsets.

---

## 2. From-Scratch Excel Generation Specification (openpyxl)

To eliminate the template dependency, we must write a service that generates the workbook from scratch using `openpyxl`. 

### Sheet Structure & Column Layout Specifications
A blank workbook (`openpyxl.Workbook()`) is initialized and configured with sheet names derived from the project types:
- **Project Type: Cobia** $\rightarrow$ sheet `"Cobia Cove Appartments"`
- **Project Type: Willow** $\rightarrow$ sheet `"Willow Way Apts"`
- All projects $\rightarrow$ sheet `"VPO's"`

#### Column Maps for From-Scratch Generation
Each column must be mapped dynamically so that column indexes can be computed using `openpyxl.utils.get_column_letter()`.

| Column (Cobia) | Column (Willow) | Field / Formula Name | Description / Data Type |
|---|---|---|---|
| **A** | **A** | `type` | Material Category (Lumber, Panels, LVL, Each) |
| **B** | **B** | `qty` | Original PO Quantity (Numeric, `#,##0`) |
| **C to AO** | **C to P** | `co_cols` | Individual CO Columns (Quantities, e.g., `CO #1`, `CO #2`) |
| **AP** | **Q** | `co_qty` | `=SUM(C{row}:AO{row})` (Cobia) / `=SUM(C{row}:P{row})` (Willow) |
| **AQ** | **R** | `po_co_qty` | `=B{row}+AP{row}` (Cobia) / `=B{row}+Q{row}` (Willow) |
| **AR** | **S** | `thickness` | Dimensions - Thickness (Numeric) |
| **AS** | **T** | `x` | Separator "X" |
| **AT** | **U** | `width` | Dimensions - Width (Numeric) |
| **AU** | **V** | `length` | Dimensions - Length (Numeric) |
| **AV** | **W** | `material_type` | Material Description (String) |
| **AW** | **X** | `lf_pcs` | Total LF / Pieces (Calculated input) |
| **AX** | **Y** | `bf_sf` | Total Board Feet / Square Feet (Calculated input) |
| **AY** | **Z** | `cost_mbf` | Unit Cost per MBF/MSF/Piece (Currency, `$#,##0.00`) |
| **AZ** | **AA** | `total_cost` | `=Formula` based on Category (see Formulas below) |
| **BA** | **AB** | `total_cost_tax`| `=AZ{row}*tax_rate` (Cobia) / `=AA{row}*tax_rate` (Willow) |
| **BB** | **AC** | `invoice_num` | Invoice references list (String) |
| **BC to DU** | **AD to AU** | `delivery_dates`| Dynamic columns populated with Delivery Quantities |
| **DV** | **AV** | `total_delivered`| `=SUM(BC{row}:DU{row})` (Cobia) / `=SUM(AD{row}:AU{row})` (Willow)|
| **DW** | **AW** | `delivered_lf` | `={total_delivered}*AU{row}` (Cobia) / `*V{row}` (Willow) |
| **DX** | **AX** | `delivered_bf_sf`| `=Formula` based on Category (see Formulas below) |
| **DY** | **AY** | `delivered_cost` | `=Formula` based on Category (see Formulas below) |
| **DZ** | **AZ** | `delivered_cost_tax`| `={delivered_cost}*tax_rate` |
| **EA** | **BA** | `pct_delivery` | `=IFERROR({delivered_cost}/{total_cost},0)` |
| **EB** | **BB** | `inv_bundles` | Physical Inventory Bundles Count (Numeric) |
| **EC** | **BC** | `inv_uom` | Inventory Unit of Measure (String) |
| **ED** | **BD** | `pcs_bundle` | Pieces per bundle (Numeric) |
| **EE** | **BE** | `inv_pcs` | `=IF({inv_bundles}<>"",{inv_bundles}*{pcs_bundle},0)` |
| **EF** | **BF** | `issues` | `={total_delivered}-{inv_pcs}` |
| **EG** | **BG** | `issues_lf` | `={issues}*AU{row}` (Cobia) / `*V{row}` (Willow) |
| **EH** | **BH** | `issues_bf_sf` | `=Formula` based on Category (see Formulas below) |
| **EI** | **BI** | `pct_issued` | `=IFERROR({issues_bf_sf}/{total_delivered},0)` |
| **EJ** | **BJ** | `issues_cost` | `=IFERROR({issues_bf_sf}*{cost_mbf}/1000,0)` |
| **EK** | **BK** | `issues_cost_tax`| `={issues_cost}*tax_rate` |
| **EL** | **BL** | `variance_code` | Variance Code (String) |
| **EM** | **BM** | `reason` | Explanation / Remarks (String) |

---

### Verbatim Formula Specifications (Cobia Example shown, Row `r`)
Let $r$ denote the active row index.

1. **`co_qty`**: `=SUM(C{r}:AO{r})`
2. **`po_co_qty`**: `=B{r}+AP{r}`
3. **`total_cost`**:
   - If type is `Lumber`: `=((AQ{r}*AR{r}*AT{r}*AU{r})/12)*AY{r}/1000`
   - If type is `Panels`: `=(AQ{r}*AR{r}*AT{r})*AY{r}/1000`
   - If type is `LVL`: `=(AQ{r}*AU{r})*AY{r}`
   - If type is `Each` / `Invoice`: `=AQ{r}*AY{r}`
4. **`total_cost_tax`**: `=AZ{r}*Project.tax_rate` (Project tax rate, e.g. 1.06)
5. **`total_delivered`**: `=SUM(BC{r}:DU{r})`
6. **`delivered_lf`**: `=DV{r}*AU{r}`
7. **`delivered_bf_sf`**:
   - If type is `Lumber`: `=(DV{r}*AR{r}*AT{r}*AU{r})/12`
   - If type is `Panels`: `=DV{r}*AR{r}*AT{r}`
   - If type is `LVL`: `=DW{r}`
   - If type is `Each` / `Invoice`: `=DV{r}`
8. **`delivered_cost`**:
   - If type in (`Lumber`, `Panels`): `=DX{r}*AY{r}/1000`
   - If type is `LVL`: `=DW{r}*AY{r}`
   - If type is `Each` / `Invoice`: `=DV{r}*AY{r}`
9. **`delivered_cost_tax`**: `=DY{r}*Project.tax_rate`
10. **`pct_delivery`**: `=IFERROR(DY{r}/AZ{r},0)`
11. **`inv_pcs`**: `=IF(EB{r}<>"",EB{r}*ED{r},0)`
12. **`issues`**: `=DV{r}-EE{r}`
13. **`issues_lf`**: `=EF{r}*AU{r}`
14. **`issues_bf_sf`**:
    - If type is `Lumber`: `=(EF{r}*AR{r}*AT{r}*AU{r})/12`
    - If type is `Panels`: `=EF{r}*AR{r}*AT{r}`
    - If type is `LVL` / `Each` / `Invoice`: `=EF{r}`
15. **`pct_issued`**: `=IFERROR(EH{r}/DV{r},0)`
16. **`issues_cost`**: `=IFERROR(EH{r}*AY{r}/1000,0)`
17. **`issues_cost_tax`**: `=EJ{r}*Project.tax_rate`

---

### Step-by-Step openpyxl Code Implementation Plan

#### Step 2.1: Workbook Initialization & Global Styles Configuration
Create a new blank workbook, set up default grid lines, and define standard styling structures:
```python
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
# Remove default sheet
default_sheet = wb.active
wb.remove(default_sheet)

# Setup Styles
font_regular = Font(name='Segoe UI', size=10)
font_bold = Font(name='Segoe UI', size=10, bold=True)
font_title = Font(name='Segoe UI', size=16, bold=True)
font_header = Font(name='Segoe UI', size=10, bold=True, color='FFFFFF')

fill_header = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid') # Dark Slate Blue
fill_co_header = PatternFill(start_color='D9E1F2', end_color='D9E1F2', fill_type='solid') # Light Steel Blue for CO columns
fill_sub_total = PatternFill(start_color='F2F2F2', end_color='F2F2F2', fill_type='solid') # Light Gray

border_thin = Border(
    left=Side(style='thin', color='BFBFBF'),
    right=Side(style='thin', color='BFBFBF'),
    top=Side(style='thin', color='BFBFBF'),
    bottom=Side(style='thin', color='BFBFBF')
)
border_double_bottom = Border(
    top=Side(style='thin', color='000000'),
    bottom=Side(style='double', color='000000')
)

align_center = Alignment(horizontal='center', vertical='center')
align_left = Alignment(horizontal='left', vertical='center')
align_right = Alignment(horizontal='right', vertical='center')
```

#### Step 2.2: Sheet Creation & Layout Setup
Create worksheets (`"Cobia Cove Appartments"` or `"Willow Way Apts"` based on Project and Organization metadata) and configure gridlines:
```python
ws = wb.create_sheet(title=project_sheet_name)
ws.views.sheetView[0].showGridLines = True
```

#### Step 2.3: Generate Header Rows (Row 1 and 2)
1. **Row 1 (Title Block)**: Merge columns A to Z, insert project title text, apply `font_title`.
2. **Row 2 (Column Headers)**:
   - Identify active Change Orders (`co_adjustments`) in the database for the project and write their numbers sequentially into columns `C` through `AO` (Cobia) or `C` through `P` (Willow). Apply `fill_co_header` and `align_center`.
   - Identify unique Delivery Dates in the database (`deliveries`), sort them chronologically, and write them sequentially as date values starting at column `BC` (Cobia) or `AD` (Willow).
   - Write all other column headers. Apply `fill_header`, `font_header`, and `align_center`. Set header rows height to `28`.

#### Step 2.4: Populate Data Rows
For each `Material` associated with the project in the database:
1. Write the static material property fields (`type`, `qty`, `thickness`, `width`, `length`, `material_type`, `cost_mbf`) into their mapped columns.
2. For each CO column (cols C–AO or C–P), query if a `COAdjustment` matches this material and CO number. Write the adjustment quantity.
3. For each delivery date column, query if any `Delivery` records match this material and ship date. Accumulate the `quantity * qty_multiplier` and write to the cell.
4. Programmatically write the formulas for the remaining columns. Format the cells:
   - Currency format: `cell.number_format = '$#,##0.00'` (`cost_mbf`, `total_cost`, `total_cost_tax`, `delivered_cost`, `delivered_cost_tax`, `issues_cost`, `issues_cost_tax`).
   - Percentage format: `cell.number_format = '0.0%'` (`pct_delivery`, `pct_issued`).
   - Number format: `cell.number_format = '#,##0'` (`qty`, `co_qty`, `po_co_qty`, `total_delivered`, `inv_pcs`, `issues`).
   - Border formatting: Apply `border_thin`.

#### Step 2.5: Bottom Summary / Totals Row
Insert a final Totals Row immediately below the last material data row:
- Write `"Total"` in Column A.
- Write SUM formulas for `qty`, `co_qty`, `po_co_qty`, `total_cost`, `total_cost_tax`, individual CO columns, delivery date columns, `total_delivered`, `delivered_cost`, `delivered_cost_tax`, `issues`, `issues_cost`, and `issues_cost_tax`.
- Apply `border_double_bottom`, `font_bold`, and set row height to `20`.

#### Step 2.6: Auto-fit Column Widths
Iterate through the worksheet columns and set their width automatically:
```python
for col in ws.columns:
    max_len = 0
    for cell in col:
        # Check if cell has value and ignore long formula strings
        if cell.value and not str(cell.value).startswith('='):
            max_len = max(max_len, len(str(cell.value)))
    col_letter = get_column_letter(col[0].column)
    ws.column_dimensions[col_letter].width = max(max_len + 3, 10)
```

---

## 3. Change Order (CO) Processing & Mapping (R3)

Change Orders represent modifications in scope or quantities and are currently parsed and processed as follows:

### 1. Document Extraction & Parsing
- Extracted using `pdfplumber` in `services/pdf_parser.py`.
- Identified as `"CO"` by searching for keywords like `"CHANGE ORDER"`, `"CO #"`, `"CO#"`, `"CHANGE ORDER NO."`, or `"Change Order Number"`.
- The parser matches items using two distinct regex patterns:
  - **Pattern 1 (Original)**: `footage UOM price qty UOM amount/UOM description`
  - **Pattern 2 (New Block)**: `Ordered_Qty UOM | Description | Footage Footage_UOM | Price/Price_UOM | Amount`

### 2. Fuzzy Matching & Mapping
In `routers/upload.py` under the `/preview` endpoint:
- Parsed line items are matched against existing database `Material` records for the target project using `_match_line_to_material(item, materials, excel_rows)`.
- **Score Weights**:
  - Description overlapping words (>2 characters long): $+2$ per matching word.
  - Dimensions (Thickness, Width, Length) match: $+5$ for each component (up to $+15$).
  - Item code matches material category/type: $+4$.
- If the best match score $\ge 4$, it is considered mapped. The matching Excel Row Reference is retrieved from a cache containing row-mappings loaded from the requirements sheet.

### 3. Database Reconciliation
In `routers/upload.py` under the `/confirm` endpoint, when the user confirms the CO:
- A `Document` entry is saved with `parsed_data_json`.
- `_save_co_adjustments(db, project_id, doc_data, doc_id)` is invoked.
- For each CO line item:
  - It finds the best matching material with a strict threshold (best score $\ge 6$).
  - It creates a `COAdjustment` record storing `qty_change`, `co_number`, `co_date`, and `description`.
  - If matched, the material's `co_qty` is incremented by the item quantity, and `po_co_qty` is updated:
    $$\text{co\_qty} \leftarrow \text{co\_qty} + \text{quantity}$$
    $$\text{po\_co\_qty} \leftarrow \text{qty} + \text{co\_qty}$$
- A log entry is added to `activities`.

### Major Architectural Sync Gap
While the backend correctly parses, maps, and stores the `COAdjustment` records and updates the `co_qty` of the materials, **the exported requirements sheet is not updated with individual CO quantities**.
In `excel_sync.py`, the sync process only writes `Delivery` quantities into date columns. It does NOT:
1. Populate the individual CO columns (Columns C to P or AO).
2. Write notes indicating the CO source details for these changes.
Consequently, when a user exports their project spreadsheet, the individual CO column grids appear completely blank, and the `co_qty` / `po_co_qty` values are overwritten by the original template constants, losing all DB modifications.

---

## 4. React UI Change Order Confirmation Prompt Design

To ensure changes are never applied silently or by mistake, we design a confirmation step in the frontend React application.

### Current UI Flow
1. User uploads a PDF in `UploadCenter.jsx`.
2. The file is analyzed, and the `/preview` endpoint returns a rich diff.
3. React renders `UploadPreviewPage.jsx` which displays the differences.
4. Clicking "Apply Changes" immediately executes `handleConfirm` which calls `/api/upload/confirm`, committing changes to the DB.

### Intercepting the Confirmation Flow
We modify `UploadPreviewPage.jsx` to intercept the confirmation if `doc_type === 'CO'`.

```jsx
// inside UploadPreviewPage.jsx
const [showCOConfirm, setShowCOConfirm] = useState(false);

const handleApplyClick = () => {
  if (doc_type === 'CO') {
    setShowCOConfirm(true);
  } else {
    onConfirm();
  }
};
```

### Confirmation Modal UI Structure
When `showCOConfirm` is active, a modal overlay renders. This modal summarizes:
1. The list of **materials that will be modified** (including descriptions and dimensions).
2. The **exact Excel rows affected**.
3. The **delta quantity** (+ / - adjustment) and the calculated cost impact.
4. Any items that **could not be matched** to any PO lines (which will be marked as "Unmapped" and require manual mapping).

#### Confirmation Modal Visual Mockup Design
The modal will be styled to match the dark glass-card design of the platform:

```jsx
{showCOConfirm && (
  <div className="co-confirm-modal-overlay animate-fade-in">
    <div className="co-confirm-modal glass-card animate-scale-up">
      <div className="co-confirm-header">
        <AlertTriangle size={24} color="#F59E0B" />
        <div>
          <h2>Apply Change Order #{doc_number}?</h2>
          <p>Review the exact material row adjustments that will be applied to your project database and requirements sheet.</p>
        </div>
      </div>

      <div className="co-confirm-content">
        <div className="co-confirm-summary-box">
          <div>
            <strong>Cost Impact:</strong> 
            <span style={{ color: totalValue >= 0 ? '#10B981' : '#EF4444', marginLeft: '6px' }}>
              {totalValue >= 0 ? '+' : ''}${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <strong>Affected Rows:</strong> {preview_items.length} spreadsheet rows
          </div>
        </div>

        <div className="co-confirm-list-header">Affected Materials & Sheets</div>
        <div className="co-confirm-affected-list">
          {preview_items.map((item, idx) => {
            const isDecrease = item.line_item?.quantity < 0;
            return (
              <div key={idx} className="co-confirm-affected-item">
                <div className="co-confirm-row-ref">
                  <FileSpreadsheet size={13} color="#10B981" />
                  <span>{item.excel_row_ref || "Unmapped (No Excel Match)"}</span>
                </div>
                <div className="co-confirm-item-details">
                  <div className="co-confirm-item-desc">{item.line_item?.description}</div>
                  <div className="co-confirm-item-dims">{item.line_item?.dimensions || 'No Dimensions'}</div>
                </div>
                <div className={`co-confirm-qty-delta ${isDecrease ? 'decrease' : 'increase'}`}>
                  {item.line_item?.quantity > 0 ? '+' : ''}
                  {item.line_item?.quantity} {item.line_item?.uom || 'pcs'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="co-confirm-footer">
        <button 
          className="co-confirm-btn-cancel" 
          onClick={() => setShowCOConfirm(false)}
          disabled={confirming}
        >
          Cancel
        </button>
        <button 
          className="co-confirm-btn-proceed" 
          onClick={() => {
            setShowCOConfirm(false);
            onConfirm();
          }}
          disabled={confirming}
        >
          {confirming ? "Applying..." : "Yes, Apply Adjustments"}
        </button>
      </div>
    </div>
  </div>
)}
```

### Confirmation Modal CSS styling
```css
.co-confirm-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
}

.co-confirm-modal {
  width: 600px;
  max-width: 90vw;
  max-height: 85vh;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.co-confirm-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.co-confirm-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: #f4f4f5;
}

.co-confirm-header p {
  font-size: 0.875rem;
  color: #a1a1aa;
  margin: 0.25rem 0 0 0;
}

.co-confirm-content {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1.5rem;
}

.co-confirm-summary-box {
  display: flex;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #e4e4e7;
  margin-bottom: 1.25rem;
}

.co-confirm-list-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #71717a;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.co-confirm-affected-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.co-confirm-affected-item {
  display: grid;
  grid-template-columns: 180px 1fr 80px;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  font-size: 0.8rem;
}

.co-confirm-row-ref {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #34d399;
  font-weight: 600;
}

.co-confirm-item-details {
  display: flex;
  flex-direction: column;
}

.co-confirm-item-desc {
  color: #e4e4e7;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.co-confirm-item-dims {
  color: #71717a;
  font-size: 0.75rem;
}

.co-confirm-qty-delta {
  text-align: right;
  font-weight: 700;
}

.co-confirm-qty-delta.increase {
  color: #34d399;
}

.co-confirm-qty-delta.decrease {
  color: #f87171;
}

.co-confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 1rem;
}

.co-confirm-btn-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
  padding: 0.6rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.co-confirm-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f4f4f5;
}

.co-confirm-btn-proceed {
  background: #3b82f6;
  border: none;
  color: #fff;
  padding: 0.6rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.co-confirm-btn-proceed:hover {
  background: #2563eb;
}
```
This UI pattern provides a safe, context-aware checkpoint, ensuring users review exactly which spreadsheet rows are changed before any Change Orders are processed.
