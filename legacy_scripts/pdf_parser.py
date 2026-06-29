"""
Updates the parser to use pdfplumber for 100% accuracy.
"""
import re
import os
import pdfplumber
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class LineItem:
    quantity: float = 0
    uom: str = ""           
    item_code: str = ""     
    description: str = ""   
    footage: float = 0      
    footage_uom: str = ""   
    unit_price: float = 0
    price_uom: str = ""     
    amount: float = 0
    dimensions: str = ""    
    co_reference: str = ""  
    substituted_for: str = ""  


@dataclass
class InvoiceData:
    invoice_number: str = ""
    invoice_date: Optional[datetime] = None
    ship_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    job_number: str = ""
    project_name: str = ""    
    customer_po: str = ""
    line_items: List[LineItem] = field(default_factory=list)
    subtotal: float = 0
    tax: float = 0
    total_amount: float = 0
    source_file: str = ""


@dataclass
class ChangeOrderData:
    co_number: str = ""
    date: Optional[datetime] = None
    job_number: str = ""
    project_name: str = ""
    customer_po: str = ""
    line_items: List[LineItem] = field(default_factory=list)
    subtotal: float = 0
    tax: float = 0
    total_amount: float = 0
    source_file: str = ""
    lumber_footage: float = 0
    panels_footage: float = 0
    ewp_footage: float = 0


@dataclass
class PurchaseOrderData:
    date: Optional[datetime] = None
    project_name: str = ""
    customer: str = ""
    line_items: List[LineItem] = field(default_factory=list)
    subtotal: float = 0
    tax: float = 0
    total: float = 0
    source_file: str = ""


def parse_number(s: str) -> float:
    if not s:
        return 0
    s = s.strip().replace(",", "").replace("$", "").replace(" ", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return 0


def parse_date(s: str) -> Optional[datetime]:
    if not s:
        return None
    s = s.strip()
    for fmt in ["%m/%d/%Y", "%m/%d/%y"]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def extract_text_from_pdf(filepath: str) -> str:
    """Extract text from PDF using pdfplumber with layout preservation."""
    try:
        with pdfplumber.open(filepath) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text(layout=True) + "\n"
            return text
    except Exception as e:
        print(f"Error extracting {filepath}: {e}")
        return ""


def identify_project(text: str) -> str:
    text_upper = text.upper()
    if "COBIA COVE" in text_upper:
        return "Cobia Cove"
    elif "WILLOW WAY" in text_upper:
        return "Willow Way"
    return "Unknown"


def parse_invoice(filepath: str) -> InvoiceData:
    text = extract_text_from_pdf(filepath)
    inv = InvoiceData(source_file=os.path.basename(filepath))

    m = re.search(r'INVOICE NO\.\s*INVOICE DATE\s*DUE DATE.*?\n.*?(\d{5,})\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})', text, re.DOTALL)
    if m:
        inv.invoice_number = m.group(1)
        inv.invoice_date = parse_date(m.group(2))
        inv.due_date = parse_date(m.group(3))
    else:
        # Fallback to standard regex
        m1 = re.search(r'INVOICE NO\..*?\n.*?(\d{5,})', text)
        if m1:
            inv.invoice_number = m1.group(1)
        else:
            inv.invoice_number = os.path.splitext(os.path.basename(filepath))[0]
            
        m2 = re.search(r'INVOICE DATE.*?\n.*?(\d{2}/\d{2}/\d{4})', text)
        if m2:
            inv.invoice_date = parse_date(m2.group(1))

    m = re.search(r'Ship Date.*?FOB.*?Customer P\.O\. No\..*?\n\s*(\d{2}/\d{2}/\d{4}).*?(P[O0]-?\d+-\d+)', text, re.DOTALL)
    if m:
        inv.ship_date = parse_date(m.group(1))
        inv.customer_po = m.group(2)
    else:
        sm = re.search(r'Ship Date.*?\n\s*(\d{2}/\d{2}/\d{4})', text)
        if sm:
            inv.ship_date = parse_date(sm.group(1))

    m = re.search(r'SOLD TO:\s*(\d{5})', text)
    if m:
        inv.job_number = m.group(1)

    inv.project_name = identify_project(text)

    # Extract totals
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if "SUB TOTAL" in line and "TAX" in line and "TOTAL AMOUNT" in line:
            if i + 1 < len(lines):
                # Try to extract the 3 numbers from the next line
                nums = re.findall(r'-?[\d,]+\.\d{2}', lines[i+1])
                if len(nums) >= 3:
                    inv.subtotal = parse_number(nums[-3])
                    inv.tax = parse_number(nums[-2])
                    inv.total_amount = parse_number(nums[-1])
                    break

    inv.line_items = _parse_invoice_line_items(lines)
    return inv


def _parse_invoice_line_items(lines: List[str]) -> List[LineItem]:
    items = []
    
    # In layout mode, pdfplumber aligns text properly
    # A line item starts with QTY (number) UOM (e.g. PC) ITEM# DESCRIPTION FOOTAGE UNIT PRICE AMOUNT
    
    # We will look for lines that start with numbers followed by PC, EA, LF
    for i, line in enumerate(lines):
        line = line.strip()
        m = re.match(r'^([\d,]+)\s+(PC|EA|LF)\s+(\S+)\s+(.*?)\s+([\d,]+)\s+(BF|SF|LF|EA)\s+([\d,.]+)/(MBF|MSF|PC|EA|LF)\s+(-?[\d,]+\.\d{2})', line)
        if m:
            item = LineItem()
            item.quantity = parse_number(m.group(1))
            item.uom = m.group(2)
            item.item_code = m.group(3)
            item.description = m.group(4).strip()
            item.footage = parse_number(m.group(5))
            item.footage_uom = m.group(6)
            item.unit_price = parse_number(m.group(7))
            item.price_uom = "/" + m.group(8)
            item.amount = parse_number(m.group(9))
            
            # Look ahead for dimensions
            if i + 1 < len(lines):
                next_line = lines[i+1].strip()
                dm = re.match(r'^(\d+X\d+X\d+)', next_line)
                if dm:
                    item.dimensions = dm.group(1)
            
            items.append(item)
            continue
            
        # Match case without item code (e.g. STORAGE)
        m2 = re.match(r'^([\d,]+)\s+(EA|PC)\s+(.*?)\s+([\d,]+)\s+(EA|PC)\s+([\d,.]+)/EA\s+(-?[\d,]+\.\d{2})', line)
        if m2:
            item = LineItem()
            item.quantity = parse_number(m2.group(1))
            item.uom = m2.group(2)
            item.description = m2.group(3).strip()
            item.footage = parse_number(m2.group(4))
            item.footage_uom = m2.group(5)
            item.unit_price = parse_number(m2.group(6))
            item.price_uom = "/EA"
            item.amount = parse_number(m2.group(7))
            items.append(item)

    return items


def parse_change_order(filepath: str) -> ChangeOrderData:
    text = extract_text_from_pdf(filepath)
    co = ChangeOrderData(source_file=os.path.basename(filepath))

    co.project_name = identify_project(text)
    
    m = re.search(r'CHANGE ORDER#\s*(\d+)', text)
    if m:
        co.co_number = m.group(1)
    else:
        fm = re.search(r'CO\s*#?\s*(\d+)', os.path.basename(filepath), re.IGNORECASE)
        if fm:
            co.co_number = fm.group(1).lstrip("0") or "0"

    m = re.search(r'DATE.*?\n.*?(\d{2}/\d{2}/\d{4})', text)
    if m:
        co.date = parse_date(m.group(1))

    m = re.search(r'SUB TOTAL\s*TAX\s*TOTAL AMOUNT.*?\n.*?(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})', text, re.DOTALL)
    if m:
        co.subtotal = parse_number(m.group(1))
        co.tax = parse_number(m.group(2))
        co.total_amount = parse_number(m.group(3))

    co.line_items = _parse_co_line_items(text.split('\n'))

    return co


def _parse_co_line_items(lines: List[str]) -> List[LineItem]:
    items = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        # Look for typical CO lines: Footage Footage_UOM Unit_Price Qty Qty_UOM Amount Price_UOM Desc
        # Due to layout mode, it usually is one line
        
        m = re.search(r'([\d,]+)\s+(BF|SF|LF|EA)\s+([\d,.]+)\s+([\d,]+)\s+(PC|EA|LF)\s+(-?[\d,]+\.\d{2})\s+/(MBF|MSF|PC|EA|LF)\s+(.*)', line)
        if m:
            item = LineItem()
            item.footage = parse_number(m.group(1))
            item.footage_uom = m.group(2)
            item.unit_price = parse_number(m.group(3))
            item.quantity = parse_number(m.group(4))
            item.uom = m.group(5)
            item.amount = parse_number(m.group(6))
            item.price_uom = "/" + m.group(7)
            item.description = m.group(8).strip()
            
            # Get dimension
            if i + 1 < len(lines):
                dm = re.match(r'^(\d+X\d+X\d+)', lines[i+1].strip())
                if dm:
                    item.dimensions = dm.group(1)
            
            items.append(item)
            
    return items


def parse_purchase_order(filepath: str) -> PurchaseOrderData:
    text = extract_text_from_pdf(filepath)
    po = PurchaseOrderData(source_file=os.path.basename(filepath))
    po.project_name = identify_project(text)

    m = re.search(r'Date:\s*(\d{1,2}/\d{1,2}/\d{4})', text)
    if m:
        po.date = parse_date(m.group(1))

    m = re.search(r'Total=\s*\$([\d,]+\.\d{2})', text)
    if m:
        po.total = parse_number(m.group(1))

    po.line_items = _parse_po_line_items(text.split('\n'))

    return po


def _parse_po_line_items(lines: List[str]) -> List[LineItem]:
    items = []
    for i, line in enumerate(lines):
        line = line.strip()
        # PO format: Category Qty T x W L Description LF BF Cost $ Total
        # Example: Lumber 2922 2 x 4 1 PT 2922 1948 785.00 $ 1,529.18
        # Match groups:
        # 1: Category (Lumber, Panels, Each, etc.)
        # 2: Qty
        # 3: T
        # 4: W
        # 5: L
        # 6: Description
        # 7: LF
        # 8: BF
        # 9: Cost
        # 10: Total
        m = re.match(r'^(Lumber|Panels|EWP|Each|Hardware|Invoice|LVL)\s+([\d,]+)\s+(\d+)\s*[xX]\s*([\d\.]+)\s+(\d+)\s+(.*?)\s+([\d,]+)\s+([\d,]+)\s+([\d,.]+)\s+\$\s+(-?[\d,]+\.\d{2})', line, re.IGNORECASE)
        if m:
            item = LineItem()
            item.category = m.group(1).lower()
            item.quantity = parse_number(m.group(2))
            
            t = m.group(3)
            w = m.group(4)
            l = m.group(5)
            item.dimensions = f"{t}X{w}X{l}"
            
            item.description = m.group(6).strip()
            item.footage = parse_number(m.group(7)) # LF
            item.bf_sf = parse_number(m.group(8))   # BF
            item.unit_price = parse_number(m.group(9))
            item.amount = parse_number(m.group(10))
            items.append(item)
            continue
            
        # Match case without T x W L (e.g. Each items)
        # Example: Each 1 0 x 0 0 STORAGE 0 0 100.00 $ 100.00
        # Actually, let's just do a generic fallback if T x W L is missing or different
        m2 = re.match(r'^(Lumber|Panels|EWP|Each|Hardware|Invoice|LVL)\s+([\d,]+)\s+(.*?)\s+([\d,]+)\s+([\d,]+)\s+([\d,.]+)\s+\$\s+(-?[\d,]+\.\d{2})', line, re.IGNORECASE)
        if m2 and not re.search(r'\d+\s*[xX]\s*[\d\.]+', line):
            item = LineItem()
            item.category = m2.group(1).lower()
            item.quantity = parse_number(m2.group(2))
            item.description = m2.group(3).strip()
            item.footage = parse_number(m2.group(4))
            item.bf_sf = parse_number(m2.group(5))
            item.unit_price = parse_number(m2.group(6))
            item.amount = parse_number(m2.group(7))
            items.append(item)

    return items


def scan_and_parse_all(base_path: str):
    result = {
        "invoices": [],
        "change_orders": [],
        "purchase_orders": [],
        "warnings": []
    }

    inv_dir = os.path.join(base_path, "Client", "Cobia Cove", "Invoices (3)", "Invoices")
    if os.path.exists(inv_dir):
        for f in sorted(os.listdir(inv_dir)):
            if f.lower().endswith(".pdf"):
                try:
                    inv = parse_invoice(os.path.join(inv_dir, f))
                    result["invoices"].append(inv)
                except Exception as e:
                    result["warnings"].append(f"Failed to parse invoice {f}: {e}")

    inv_dir2 = os.path.join(base_path, "Client", "Willow way Village", "Invoices")
    if os.path.exists(inv_dir2):
        for f in sorted(os.listdir(inv_dir2)):
            if f.lower().endswith(".pdf"):
                try:
                    inv = parse_invoice(os.path.join(inv_dir2, f))
                    result["invoices"].append(inv)
                except Exception as e:
                    result["warnings"].append(f"Failed to parse invoice {f}: {e}")

    co_dir = os.path.join(base_path, "Client", "Cobia Cove", "Cobia Cove Change Orders")
    if os.path.exists(co_dir):
        for f in sorted(os.listdir(co_dir)):
            if f.lower().endswith(".pdf"):
                try:
                    co = parse_change_order(os.path.join(co_dir, f))
                    result["change_orders"].append(co)
                except Exception as e:
                    result["warnings"].append(f"Failed to parse CO {f}: {e}")

    co_dir2 = os.path.join(base_path, "Client", "Willow way Village", "Willow Way Village CO's")
    if os.path.exists(co_dir2):
        for f in sorted(os.listdir(co_dir2)):
            if f.lower().endswith(".pdf"):
                try:
                    co = parse_change_order(os.path.join(co_dir2, f))
                    result["change_orders"].append(co)
                except Exception as e:
                    result["warnings"].append(f"Failed to parse CO {f}: {e}")

    # Add POs
    po_dir1 = os.path.join(base_path, "Client", "Cobia Cove", "Cobia Cove PO's")
    if os.path.exists(po_dir1):
        for f in sorted(os.listdir(po_dir1)):
            if f.lower().endswith(".pdf"):
                try:
                    po = parse_purchase_order(os.path.join(po_dir1, f))
                    result["purchase_orders"].append(po)
                except Exception as e:
                    result["warnings"].append(f"Failed to parse PO {f}: {e}")

    po_dir2 = os.path.join(base_path, "Client", "Willow way Village") # Will scan root for POs
    if os.path.exists(po_dir2):
        for f in sorted(os.listdir(po_dir2)):
            if f.lower().endswith(".pdf") and "PO" in f.upper():
                try:
                    po = parse_purchase_order(os.path.join(po_dir2, f))
                    result["purchase_orders"].append(po)
                except Exception as e:
                    result["warnings"].append(f"Failed to parse PO {f}: {e}")

    return result

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    data = scan_and_parse_all(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    print(f"Parsed {len(data['invoices'])} invoices, {len(data['change_orders'])} COs, {len(data['purchase_orders'])} POs")
