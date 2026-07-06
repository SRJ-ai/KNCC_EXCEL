# Changes Summary - Phase 2: Intelligent Local Mapping and Heuristics (R2)

## 1. Dynamic Header-Matching Layout Discovery
- **File Modified**: `platform/backend/app/routers/upload.py` (`_load_excel_row_refs`)
- **Details**:
  - Implemented case-insensitive sheet matching. If a project name is unrecognized (doesn't contain "COBIA" or "WILLOW"), it matches sheet names in `Client_Requirements_Doc.xlsx` by checking if the project name is a substring of the sheet name, or vice versa.
  - Added a fallback to the first sheet in the workbook, ignoring any sheet containing "VPO's".
  - Scans row 2 (falling back to row 1) to dynamically discover column letters/indices for key fields: "Type" (Division/Category), "Material Type"/"Description", "Thickness", "Width", "Length", "Qty", and "Cost".
  - Stores all discovered fields in the Excel row reference dictionaries.

## 2. Robust Fuzzy Matching & Heuristics
- **File Modified**: `platform/backend/app/services/matcher.py` & `platform/backend/app/routers/upload.py`
- **Details**:
  - Centralized matching logic and added new helper functions: `normalize_text`, `parse_dimension_val`, `parse_dimensions_string`, `extract_dimensions_from_text`, `get_dimensions`, and `score_match`.
  - Added `ItemMapping` table check as the highest priority in both `match_material` and `_match_line_to_material`.
  - Supported fraction and decimal dimension formats (e.g. `1-3/4 x 11-7/8 x 24` or `1.75 x 11.875 x 24`) using custom regex parser and float translation.
  - Implemented text normalization (PT/MCA -> TREATED, SYP -> SOUTHERN YELLOW PINE).
  - Implemented scoring engine: Category match = 10; dimensions matching = +5 each; wood species match = +3; description word overlap = +2 per word. Matches below threshold (10 for each/invoice, 15 for lumber/panels/lvl) are rejected.

## 3. Change Order & Invoice Anti-Duplication Adjustments
- **File Modified**: `platform/backend/app/routers/upload.py` (`_save_co_adjustments` and `confirm_upload`)
- **Details**:
  - Updated `_save_co_adjustments` to match CO items to existing materials.
  - If matched, directly adjust `co_qty` and `po_co_qty` of the existing material, preventing duplicate material rows.
  - If not matched, insert a new `Material` record with `qty=0.0`, `co_qty=item.quantity`, `po_co_qty=item.quantity`, and store its type, description, dimensions, and cost. Added the new material to the in-memory material list to avoid duplication if subsequent CO lines match it.
  - Updated Invoice confirmation (`INV`) to use the exact same matching logic to record `Delivery` records (including correct `qty_multiplier` calculation) and update the matched material's `invoice_refs` without duplicating rows.

## 4. Verification Test Suite
- **File Created**: `platform/backend/test_r2_mapping.py`
- **Details**:
  - Programmatically verifies:
    1. Willow Way PO PDF successfully matches corresponding template rows.
    2. Dynamic header matching and layout discovery for unrecognized projects (Oak Wood Estates) without crashing.
    3. Change Orders and Invoices correctly adjust quantities, link `Delivery` records, and update `invoice_refs` on mapped materials without duplicating rows.
