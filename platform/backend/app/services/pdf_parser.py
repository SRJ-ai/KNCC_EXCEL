"""
PDF Parser — fixed:
  FIX #5:  More resilient regex — handles variable whitespace, same-line dims, CO header variants.
  FIX #11: Dimension regex now case-insensitive (matches 2x6x12 and 2X6X12).
  FIX #14: Negative number parsing handles spaces inside parentheses like ( 1,234.56 ).
"""
import re
import os
import pdfplumber
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional


class LineItemModel(BaseModel):
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


class DocumentDataModel(BaseModel):
    doc_type: str
    project_name: str
    date: Optional[datetime] = None
    number: str = ""
    line_items: List[LineItemModel] = []
    subtotal: float = 0
    tax: float = 0
    tax_rate: float = 0.0  # e.g. 0.06 for 6%
    total_amount: float = 0


def parse_number(s: str) -> float:
    """
    FIX #14: Handles parenthesised negatives with internal spaces e.g. ( 1,234.56 ).
    """
    if not s:
        return 0
    s = str(s).strip().replace(",", "").replace("$", "")
    # Handle  (  1234.56  )  with any internal whitespace
    paren_match = re.match(r'^\(\s*([\d.]+)\s*\)$', s)
    if paren_match:
        return -float(paren_match.group(1))
    s = s.replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return 0


def parse_date(s: str) -> Optional[datetime]:
    if not s:
        return None
    s = s.strip()
    for fmt in ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


import pdfplumber

def extract_text_from_pdf(filepath: str) -> str:
    try:
        with pdfplumber.open(filepath) as pdf:
            parts = []
            for page in pdf.pages:
                t = page.extract_text(layout=True)
                if t:
                    parts.append(t)
            return "\n".join(parts)
    except Exception as e:
        print(f"Error extracting {filepath}: {e}")
        return ""


def _extract_dimensions(text_around_line: str) -> str:
    """
    FIX #5 + FIX #11: Search for dimension pattern in a block of text.
    Matches both 2X6X12 (uppercase) and 2x6x12 (lowercase).
    """
    dm = re.search(r'\b(\d{1,2})[Xx](\d{1,2})[Xx](\d{1,3})\b', text_around_line)
    if dm:
        return f"{dm.group(1)}X{dm.group(2)}X{dm.group(3)}"
    return ""


def _extract_tax_rate(text: str) -> float:
    """
    FIX #4: Dynamically extract tax rate from document text.
    Looks for patterns like "Tax 6.00%", "Sales Tax: 6%", "Tax Rate: 6.00%".
    """
    patterns = [
        r'[Ss]ales?\s*[Tt]ax\s*[:\s@]\s*([\d.]+)\s*%',
        r'[Tt]ax\s*[Rr]ate\s*[:\s]\s*([\d.]+)\s*%',
        r'[Tt]ax\s+([\d.]+)\s*%',
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            try:
                return float(m.group(1)) / 100
            except ValueError:
                pass
    return 0.0


def parse_pdf_document(filepath: str, doc_type: str) -> DocumentDataModel:
    text = extract_text_from_pdf(filepath)
    text_upper = text.upper()

    # Identify project
    project_name = "Unknown"
    if "COBIA COVE" in text_upper:
        project_name = "Cobia Cove"
    elif "WILLOW WAY" in text_upper:
        project_name = "Willow Way"

    doc = DocumentDataModel(doc_type=doc_type, project_name=project_name)
    lines = text.split("\n")

    # FIX #4: Extract tax rate from document
    tax_rate = _extract_tax_rate(text)
    doc.tax_rate = tax_rate

    if doc_type == "INV":
        # FIX #5: More flexible invoice number extraction
        m = re.search(r'INVOICE\s*(?:NO|NUM|NUMBER|#)?\.?\s*[:\s]?\s*(\d{5,})', text, re.IGNORECASE)
        if m:
            doc.number = m.group(1)

        # Ship date extraction — try multiple label patterns
        m2 = re.search(r'(?:Ship\s*Date|Shipped|Ship\s*On|Date\s*Shipped)\s*[:\s]*(\d{1,2}/\d{1,2}/\d{4})', text, re.IGNORECASE)
        if m2:
            doc.date = parse_date(m2.group(1))

        # FIX #5: More resilient line item regex
        # Pattern: QTY  UOM  ITEM_CODE  DESCRIPTION  FOOTAGE  FOOTAGE_UOM  PRICE/PUOM  AMOUNT
        line_pattern = re.compile(
            r'^([\d,]+)\s+(PC|EA|LF)\s+(\S+)\s+(.*?)\s+([\d,]+)\s+(BF|SF|LF|EA)\s+([\d,.]+)/(MBF|MSF|PC|EA|LF)\s+(-?[\d,]+\.?\d*)',
            re.IGNORECASE
        )
        for i, line in enumerate(lines):
            m = line_pattern.match(line.strip())
            if m:
                item = LineItemModel(
                    quantity=parse_number(m.group(1)),
                    uom=m.group(2).upper(),
                    item_code=m.group(3),
                    description=m.group(4).strip(),
                    footage=parse_number(m.group(5)),
                    footage_uom=m.group(6).upper(),
                    unit_price=parse_number(m.group(7)),
                    price_uom=m.group(8).upper(),
                    amount=parse_number(m.group(9)),
                )
                # FIX #5 + #11: Search current line AND next 2 lines for dimensions
                search_block = line + " " + " ".join(lines[i+1:i+3])
                item.dimensions = _extract_dimensions(search_block)
                doc.line_items.append(item)

        # Extract totals
        m_tax = re.search(r'(?:Tax|Sales Tax)\s+([\d,]+\.?\d*)', text, re.IGNORECASE)
        if m_tax:
            doc.tax = parse_number(m_tax.group(1))
        m_total = re.search(r'(?:Total|Amount Due)\s+\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if m_total:
            doc.total_amount = parse_number(m_total.group(1))

    elif doc_type == "CO":
        # FIX #5: Handle CO #, CO#, CHANGE ORDER NO., Change Order Number variants
        m = re.search(r'(?:CHANGE\s+ORDER\s*(?:NO|NUM|NUMBER|#)?\.?|CO\s*#?)\s*[:\s]?\s*(\d+)', text, re.IGNORECASE)
        if m:
            doc.number = m.group(1)

        m_date = re.search(r'Date\s*[:\s]\s*(\d{1,2}/\d{1,2}/\d{4})', text, re.IGNORECASE)
        if m_date:
            doc.date = parse_date(m_date.group(1))

        # CO line items:
        # Format 1 (Original): footage  UOM  price  qty  UOM  amount/UOM  description
        co_pattern_1 = re.compile(
            r'([\d,]+)\s+(BF|SF|LF|EA)\s+([\d,.]+)\s+([\d,]+)\s+(PC|EA|LF)\s+(-?[\d,]+\.?\d*)\s*/(MBF|MSF|PC|EA|LF)\s+(.*)',
            re.IGNORECASE
        )
        # Format 2 (New): Ordered_Qty UOM | Description | Footage Footage_UOM | Price/Price_UOM | Amount
        co_pattern_2 = re.compile(
            r'([\d,]+)\s*(LF|PC|EA|BF)\s*\|?\s*(.*?)\s+([\d,.]+)\s*(BF|SF|LF|EA)\s+([\d,.]+)\s*/\s*(MBF|MSF|PC|EA|LF)\s+(-?[\d,]+\.?\d*)',
            re.IGNORECASE
        )
        for i, line in enumerate(lines):
            m1 = co_pattern_1.search(line.strip())
            if m1:
                item = LineItemModel(
                    footage=parse_number(m1.group(1)),
                    footage_uom=m1.group(2).upper(),
                    unit_price=parse_number(m1.group(3)),
                    quantity=parse_number(m1.group(4)),
                    uom=m1.group(5).upper(),
                    amount=parse_number(m1.group(6)),
                    price_uom=m1.group(7).upper(),
                    description=m1.group(8).strip(),
                )
                search_block = line + " " + " ".join(lines[i+1:i+3])
                item.dimensions = _extract_dimensions(search_block)
                doc.line_items.append(item)
                continue
                
            m2 = co_pattern_2.search(line.strip())
            if m2:
                item = LineItemModel(
                    quantity=parse_number(m2.group(1)),
                    uom=m2.group(2).upper(),
                    description=m2.group(3).strip(),
                    footage=parse_number(m2.group(4)),
                    footage_uom=m2.group(5).upper(),
                    unit_price=parse_number(m2.group(6)),
                    price_uom=m2.group(7).upper(),
                    amount=parse_number(m2.group(8)),
                )
                search_block = line + " " + " ".join(lines[i+1:i+3])
                item.dimensions = _extract_dimensions(search_block)
                doc.line_items.append(item)

    elif doc_type == "PO":
        m = re.search(r'(?:P\.?O\.?\s*(?:NO|NUMBER|#)?\.?|Purchase\s+Order\s*(?:No|#)?)\s*[:\s]?\s*(\d{5,})', text, re.IGNORECASE)
        if m:
            doc.number = m.group(1)
        m_date = re.search(r'Date\s*[:\s]*(\d{1,2}/\d{1,2}/\d{4})', text, re.IGNORECASE)
        if m_date:
            doc.date = parse_date(m_date.group(1))

        po_pattern = re.compile(
            r'^(Lumber|Panels|EWP|Each|Hardware|Invoice|LVL)\s+([\d,]+)\s+(.*?)\s+([\d,]+)(?:\s+([\d,]+))?\s+([\d,.]+)\s+\$\s*(-?[\d,]+\.\d{2})',
            re.IGNORECASE
        )

        for line in lines:
            m_po = po_pattern.match(line.strip())
            if m_po:
                category, quantity_str, desc, fd1, fd2, price_str, total_str = m_po.groups()
                
                # Dimension extraction
                dimensions = ""
                if category.lower() == "panels":
                    dm2 = re.search(r'^(\d+)\s*[xX]\s*([\d.]+)\b', desc)
                    if dm2:
                        dimensions = f"{dm2.group(1)}X{int(float(dm2.group(2)))}"
                else:
                    dm3 = re.search(r'^(\d+)\s*[xX]\s*([\d.]+)\s+(\d+)\b', desc)
                    if dm3:
                        dimensions = f"{dm3.group(1)}X{int(float(dm3.group(2)))}X{dm3.group(3)}"
                    else:
                        dm2 = re.search(r'^(\d+)\s*[xX]\s*([\d.]+)\b', desc)
                        if dm2:
                            dimensions = f"{dm2.group(1)}X{int(float(dm2.group(2)))}"

                # Calculate footage / footage_uom / price_uom
                footage = parse_number(fd1)
                footage_uom = "LF" if category.lower() != "panels" else "SF"
                uom = "EA" if category.lower() == "each" else "PC"
                price_uom = "MBF" if category.lower() == "lumber" else ("MSF" if category.lower() == "panels" else "LF")

                item = LineItemModel(
                    quantity=parse_number(quantity_str),
                    uom=uom,
                    item_code="",
                    description=desc.strip(),
                    footage=footage,
                    footage_uom=footage_uom,
                    unit_price=parse_number(price_str),
                    price_uom=price_uom,
                    amount=parse_number(total_str),
                    dimensions=dimensions
                )
                doc.line_items.append(item)

    return doc
