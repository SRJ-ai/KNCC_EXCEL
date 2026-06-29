import re
import os
import pdfplumber
from datetime import datetime

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

def extract_text_from_pdf(filepath: str) -> str:
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
    return "Unknown Project"

def parse_line_items(lines):
    items = []
    for i, line in enumerate(lines):
        line = line.strip()
        # PO format: Category Qty T x W L Description LF BF Cost $ Total
        # Match groups: 1:Category 2:Qty 3:T 4:W 5:L 6:Description 7:LF 8:BF 9:Cost 10:Total
        m_po = re.match(r'^(Lumber|Panels|EWP|Each|Hardware|Invoice|LVL)\s+([\d,]+)\s+(\d+)\s*[xX]\s*([\d\.]+)\s+(\d+)\s+(.*?)\s+([\d,]+)\s+([\d,]+)\s+([\d,.]+)\s+\$\s+(-?[\d,]+\.\d{2})', line, re.IGNORECASE)
        if m_po:
            item = {
                "category": m_po.group(1).lower(),
                "quantity": parse_number(m_po.group(2)),
                "description": m_po.group(6).strip(),
                "footage": parse_number(m_po.group(7)),
                "unit_price": parse_number(m_po.group(9)),
                "amount": parse_number(m_po.group(10)),
                "dimensions": f"{m_po.group(3)}X{m_po.group(4)}X{m_po.group(5)}"
            }
            items.append(item)
            continue
            
        m_po_each = re.match(r'^(Lumber|Panels|EWP|Each|Hardware|Invoice|LVL)\s+([\d,]+)\s+(.*?)\s+([\d,]+)\s+([\d,]+)\s+([\d,.]+)\s+\$\s+(-?[\d,]+\.\d{2})', line, re.IGNORECASE)
        if m_po_each and not re.search(r'\d+\s*[xX]\s*[\d\.]+', line):
            item = {
                "category": m_po_each.group(1).lower(),
                "quantity": parse_number(m_po_each.group(2)),
                "description": m_po_each.group(3).strip(),
                "footage": parse_number(m_po_each.group(4)),
                "unit_price": parse_number(m_po_each.group(6)),
                "amount": parse_number(m_po_each.group(7)),
                "dimensions": ""
            }
            items.append(item)
            continue

        # Invoice QTY UOM ITEM# DESC FOOTAGE UOM UNIT_PRICE PRICE_UOM AMOUNT
        m = re.match(r'^([\d,]+)\s+(PC|EA|LF)\s+(\S+)\s+(.*?)\s+([\d,]+)\s+(BF|SF|LF|EA)\s+([\d,.]+)/(MBF|MSF|PC|EA|LF)\s+(-?[\d,]+\.\d{2})', line)
        if m:
            item = {
                "quantity": parse_number(m.group(1)),
                "uom": m.group(2),
                "item_code": m.group(3),
                "description": m.group(4).strip(),
                "footage": parse_number(m.group(5)),
                "unit_price": parse_number(m.group(7)),
                "amount": parse_number(m.group(9)),
                "dimensions": "",
                "category": "lumber"
            }
            if i + 1 < len(lines):
                dm = re.match(r'^(\d+X\d+X\d+)', lines[i+1].strip())
                if dm:
                    item["dimensions"] = dm.group(1)
            items.append(item)
            continue
            
        # Case without item code
        m2 = re.match(r'^([\d,]+)\s+(EA|PC)\s+(.*?)\s+([\d,]+)\s+(EA|PC)\s+([\d,.]+)/EA\s+(-?[\d,]+\.\d{2})', line)
        if m2:
            item = {
                "quantity": parse_number(m2.group(1)),
                "uom": m2.group(2),
                "description": m2.group(3).strip(),
                "footage": parse_number(m2.group(4)),
                "unit_price": parse_number(m2.group(6)),
                "amount": parse_number(m2.group(7)),
                "dimensions": "",
                "category": "each"
            }
            items.append(item)
    return items

def parse_po(filepath: str):
    text = extract_text_from_pdf(filepath)
    po = {
        "project_name": identify_project(text),
        "total": 0.0,
        "vendor": "Unknown",
        "line_items": parse_line_items(text.split('\n'))
    }
    m = re.search(r'Total=\s*\$([\d,]+\.\d{2})', text)
    if m:
        po["total"] = parse_number(m.group(1))
        
    v = re.search(r'(?:VENDOR|FROM|SUPPLIER)[\s:]*([A-Za-z0-9 ]+)', text.upper())
    if v:
        po["vendor"] = v.group(1).strip()
        
    return po

def parse_invoice(filepath: str):
    text = extract_text_from_pdf(filepath)
    inv = {
        "project_name": identify_project(text),
        "total": 0.0,
        "invoice_number": "",
        "line_items": parse_line_items(text.split('\n'))
    }
    m = re.search(r'TOTAL AMOUNT.*?\n.*?(-?[\d,]+\.\d{2})', text, re.DOTALL)
    if m:
        inv["total"] = parse_number(m.group(1))
    
    m_inv = re.search(r'INVOICE NO\..*?\n.*?(\d{5,})', text)
    if m_inv:
        inv["invoice_number"] = m_inv.group(1)
    
    return inv

def parse_co(filepath: str):
    text = extract_text_from_pdf(filepath)
    co = {
        "project_name": identify_project(text),
        "total": 0.0,
        "co_number": "",
        "line_items": parse_line_items(text.split('\n'))
    }
    m = re.search(r'CHANGE ORDER#\s*(\d+)', text)
    if m:
        co["co_number"] = m.group(1)
        
    m2 = re.search(r'TOTAL AMOUNT.*?\n.*?(-?[\d,]+\.\d{2})', text, re.DOTALL)
    if m2:
        co["total"] = parse_number(m2.group(1))
        
    return co
