"""
PDF Parser — Matheus Lumber Company invoice format (Willow Way / Cobia Cove).

Invoice layout (plain text, no layout=True needed):
  Line "...INVOICE NO. INVOICE DATE DUE DATE"
  Line "Remit To:"
  Line "HAUSER, ID 83854" (or other city)
  Line "60126001   11/20/2025   12/10/2025"   ← invoice# + inv_date + due_date
  ...
  Line "Ship Date  Routing  Entered by/Assistant  FOB  Customer P.O. No."
  Line "11/07/2025 MILL TRUCK  DREW TURBIN  DELIVERED  P0348-0001"  ← ship date
  Line "QTY  UOM  ITEM#  DESCRIPTION  FOOTAGE  UNIT PRICE  AMOUNT"
  <line items follow>
  Line "F.S.S.T. FL0014 7.0000 %  836.24"  ← tax
  Line "24,960 BF  13,104.00  836.24  13,940.24"  ← summary totals

Line-item format:
  4,160 PC 2410458SYP SYP DRY #2 STUD PET 104-5/8"  24,960 BF 525.000/MBF 13,104.00
  (61S )  2X4X9   ← dimension note on next line

LVL format:
  2,160 LF 312514GLB 3-1/2X5-1/4 GLULAM  2,160 LF 6.880/LF 14,860.80
  (600 )  495/9'   ← lot/shipped note
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
    tax_rate: float = 0.0
    total_amount: float = 0


def parse_number(s: str) -> float:
    if not s:
        return 0
    s = str(s).strip().replace(",", "").replace("$", "")
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


def extract_text_from_pdf(filepath: str) -> str:
    """Extract plain text from all pages. Uses plain extract_text (not layout=True)
    so column-spanning values land on the same line."""
    try:
        with pdfplumber.open(filepath) as pdf:
            parts = []
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
            return "\n".join(parts)
    except Exception as e:
        print(f"Error extracting {filepath}: {e}")
        return ""


def _extract_dimensions(text_block: str) -> str:
    """
    Extract dimension pattern like 2X4X9, 3-1/2X5-1/4, 4X8.
    Handles fractions in dimensions.
    """
    dim_val_rx = r'(\d+(?:[\s\-]\d+/\d+)?|\d+)'
    # 3-part: TxWxL
    dm3 = re.search(
        fr'\b{dim_val_rx}\s*[Xx]\s*{dim_val_rx}\s*[Xx]\s*{dim_val_rx}\b',
        text_block
    )
    if dm3:
        return f"{dm3.group(1)}X{dm3.group(2)}X{dm3.group(3)}"
    # 2-part: WxH or TxW
    dm2 = re.search(fr'\b{dim_val_rx}\s*[Xx]\s*{dim_val_rx}\b', text_block)
    if dm2:
        return f"{dm2.group(1)}X{dm2.group(2)}"
    return ""


def _extract_tax_rate(text: str) -> float:
    """Extract tax rate from text patterns like '7.0000 %' or 'Sales Tax 6%'."""
    # Matheus invoices use: F.S.S.T. FL0014 7.0000 %  836.24
    m = re.search(r'F\.S\.S\.T\..*?([\d.]+)\s*%', text, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1)) / 100
        except ValueError:
            pass
    # Generic patterns
    for pat in [
        r'[Ss]ales?\s*[Tt]ax\s*[:\s@]\s*([\d.]+)\s*%',
        r'[Tt]ax\s*[Rr]ate\s*[:\s]\s*([\d.]+)\s*%',
        r'([\d.]+)\s*%\s+(?:Tax|TAX)',
    ]:
        m = re.search(pat, text)
        if m:
            try:
                return float(m.group(1)) / 100
            except ValueError:
                pass
    return 0.0


def _parse_matheus_invoice(lines: List[str], text: str) -> dict:
    """
    Parse Matheus Lumber Company invoice format.
    Returns dict with: number, date (ship_date), items, subtotal, tax, total_amount, tax_rate
    """
    result = {
        "number": "",
        "date": None,
        "items": [],
        "subtotal": 0.0,
        "tax": 0.0,
        "total_amount": 0.0,
        "tax_rate": 0.0,
    }

    # ── Invoice number + invoice date ───────────────────────────────────────
    # The line after "INVOICE NO. INVOICE DATE DUE DATE" is:
    #   "Remit To:" then after "HAUSER, ID 83854" comes:
    #   "60126001   11/20/2025   12/10/2025"
    # So we look for a line that starts with a 8-digit invoice number followed by a date
    inv_num_pattern = re.compile(r'^(\d{7,8})\s+(\d{1,2}/\d{1,2}/\d{4})')
    for line in lines:
        m = inv_num_pattern.match(line.strip())
        if m:
            result["number"] = m.group(1)
            # m.group(2) is the invoice date — we'll use ship date instead
            break

    # If not found try standard "INVOICE NO: XXXX" inline
    if not result["number"]:
        m = re.search(r'INVOICE\s*(?:NO|NUM|NUMBER|#)?\.?\s*[:\s]?\s*(\d{5,8})', text, re.IGNORECASE)
        if m:
            result["number"] = m.group(1)

    # ── Ship date ───────────────────────────────────────────────────────────
    # Line after "Ship Date  Routing  ..." contains the actual ship date
    in_ship_section = False
    for line in lines:
        if re.search(r'Ship\s*Date\s+Routing', line, re.I):
            in_ship_section = True
            continue
        if in_ship_section:
            m = re.match(r'(\d{1,2}/\d{1,2}/\d{4})', line.strip())
            if m:
                result["date"] = parse_date(m.group(1))
            break  # only first line after header

    # ── Tax rate ────────────────────────────────────────────────────────────
    result["tax_rate"] = _extract_tax_rate(text)

    # ── Line items ──────────────────────────────────────────────────────────
    # Pattern: QTY  UOM  ITEM#  DESCRIPTION  FOOTAGE FOOTAGE_UOM  PRICE/PUOM  AMOUNT
    # QTY can be comma-formatted. UOM = PC, LF, EA. FOOTAGE_UOM = BF, LF, SF.
    # PRICE = digits/decimal. PUOM = MBF, LF, PC, EA.
    # Examples:
    #   4,160 PC 2410458SYP SYP DRY #2 STUD PET 104-5/8"  24,960 BF 525.000/MBF 13,104.00
    #   2,160 LF 312514GLB 3-1/2X5-1/4 GLULAM  2,160 LF 6.880/LF 14,860.80
    #   192 PC 2814SYP SYP DRY #2/BTR S4S  3,584 BF 485.000/MBF 1,738.24
    line_pattern = re.compile(
        r'^([\d,]+)\s+(PC|EA|LF)\s+(\S+)\s+(.*?)\s+([\d,]+(?:\.\d+)?)\s+(BF|SF|LF|EA)\s+'
        r'([\d,]+(?:\.\d+)?)\s*/\s*(MBF|MSF|PC|EA|LF)\s+([\d,]+\.\d{2})',
        re.IGNORECASE
    )

    in_items = False
    items_done = False
    for i, line in enumerate(lines):
        raw = line.strip()

        # Start parsing after "QTY UOM ITEM# DESCRIPTION FOOTAGE UNIT PRICE AMOUNT" header
        if re.match(r'QTY\s+UOM\s+ITEM#', raw, re.I):
            in_items = True
            continue

        if not in_items or items_done:
            continue

        # End of items: tax/summary line
        if re.match(r'F\.S\.S\.T\.|FOOTAGE\s+SUB\s+TOTAL', raw, re.I):
            items_done = True
            # Try to extract tax from this FSSST line
            m_tax_line = re.search(r'([\d.]+)\s*%\s+([\d,]+\.?\d*)', raw)
            if m_tax_line:
                result["tax"] = parse_number(m_tax_line.group(2))
            continue

        # Skip parenthetical notes like "(61S )  2X4X9" or "SHIPPED 240/9'"
        if re.match(r'^\(|^SHIPPED|^ABOVE|^F\.S\.', raw, re.I):
            continue

        m = line_pattern.match(raw)
        if m:
            qty = parse_number(m.group(1))
            uom = m.group(2).upper()
            item_code = m.group(3)
            description = m.group(4).strip()
            footage = parse_number(m.group(5))
            footage_uom = m.group(6).upper()
            unit_price = parse_number(m.group(7))
            price_uom = m.group(8).upper()
            amount = parse_number(m.group(9))

            # Look ahead 2 lines for dimension notes like "(61S ) 2X4X9"
            look_ahead = " ".join(lines[i+1:i+3])
            dims = _extract_dimensions(description + " " + look_ahead)

            result["items"].append(LineItemModel(
                quantity=qty,
                uom=uom,
                item_code=item_code,
                description=description,
                footage=footage,
                footage_uom=footage_uom,
                unit_price=unit_price,
                price_uom=price_uom,
                amount=amount,
                dimensions=dims,
            ))

    # ── Summary totals ──────────────────────────────────────────────────────
    # "24,960 BF  13,104.00  836.24  13,940.24"  (footage bf  subtotal  tax  total)
    summary_pattern = re.compile(
        r'([\d,]+)\s+(?:BF|SF|LF)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})'
    )
    m_sum = summary_pattern.search(text)
    if m_sum:
        result["subtotal"] = parse_number(m_sum.group(2))
        result["tax"]      = parse_number(m_sum.group(3))
        result["total_amount"] = parse_number(m_sum.group(4))

    return result


def parse_pdf_document(filepath: str, doc_type: str) -> DocumentDataModel:
    text = extract_text_from_pdf(filepath)
    text_upper = text.upper()

    # Identify project
    project_name = "Unknown"
    if "COBIA COVE" in text_upper:
        project_name = "Cobia Cove"
    elif "WILLOW WAY" in text_upper or "WILLOW_WAY" in text_upper:
        project_name = "Willow Way"

    doc = DocumentDataModel(doc_type=doc_type, project_name=project_name)
    lines = text.split("\n")

    if doc_type == "INV":
        parsed = _parse_matheus_invoice(lines, text)
        doc.number       = parsed["number"]
        doc.date         = parsed["date"]
        doc.tax_rate     = parsed["tax_rate"]
        doc.subtotal     = parsed["subtotal"]
        doc.tax          = parsed["tax"]
        doc.total_amount = parsed["total_amount"]
        doc.line_items   = parsed["items"]

    elif doc_type == "CO":
        # FIX #5: Handle CO #, CO#, CHANGE ORDER NO., Change Order Number variants
        m = re.search(
            r'(?:CHANGE\s+ORDER\s*(?:NO|NUM|NUMBER|#)?\.?|CO\s*#?)\s*[:\s]?\s*(\d+)',
            text, re.IGNORECASE
        )
        if m:
            doc.number = m.group(1)

        m_date = re.search(r'Date\s*[:\s]\s*(\d{1,2}/\d{1,2}/\d{4})', text, re.IGNORECASE)
        if m_date:
            doc.date = parse_date(m_date.group(1))

        doc.tax_rate = _extract_tax_rate(text)

        # CO line items — two formats
        co_pattern_1 = re.compile(
            r'([\d,]+)\s+(BF|SF|LF|EA)\s+([\d,.]+)\s+([\d,]+)\s+(PC|EA|LF)\s+(-?[\d,]+\.?\d*)\s*/(MBF|MSF|PC|EA|LF)\s+(.*)',
            re.IGNORECASE
        )
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
        m = re.search(
            r'(?:P\.?O\.?\s*(?:NO|NUMBER|#)?\.?|Purchase\s+Order\s*(?:No|#)?)\s*[:\s]?\s*(\d{5,})',
            text, re.IGNORECASE
        )
        if m:
            doc.number = m.group(1)
        m_date = re.search(r'Date\s*[:\s]*(\d{1,2}/\d{1,2}/\d{4})', text, re.IGNORECASE)
        if m_date:
            doc.date = parse_date(m_date.group(1))

        doc.tax_rate = _extract_tax_rate(text)

        dim_frac = r'\d+(?:[- ]\d+/\d+)?'
        po_pattern_lvl = re.compile(
            fr'^(LVL)\s+([\d,]+)\s+([\d.]+)\s+({dim_frac}\s*[xX]\s*{dim_frac})\s+(.*?)\s+([\d,]+)\s+([\d,.]+)\s+\$\s*(-?[\d,]+\.?\d{{2}})',
            re.IGNORECASE
        )
        po_pattern_std = re.compile(
            r'^(Lumber|Panels|Each|Hardware|Invoice)\s+([\d,]+)\s+(.*?)\s+([\d,]+)(?:\s+([\d,]+))?\s+([\d,.]+)\s+\$\s*(-?[\d,]+\.\d{2})',
            re.IGNORECASE
        )

        for line in lines:
            line = line.strip()
            if not line:
                continue

            m_lvl = po_pattern_lvl.match(line)
            if m_lvl:
                cat, qty, length_str, dims, desc, lf_total, price, total = m_lvl.groups()
                doc.line_items.append(LineItemModel(
                    quantity=parse_number(qty),
                    uom="PC",
                    item_code=cat.upper(),
                    description=f"{dims} {desc.strip()}".strip(),
                    footage=parse_number(lf_total),
                    footage_uom="LF",
                    unit_price=parse_number(price),
                    price_uom="LF",
                    amount=parse_number(total),
                    dimensions=f"0X0X{length_str}",
                ))
                continue

            m_std = po_pattern_std.match(line)
            if m_std:
                cat, qty, desc, fd1, fd2, price, total = m_std.groups()
                desc = re.sub(r'^(?i:MATERIAL\s+[a-z]+)\s+', '', desc)
                dimensions = ""
                cat_lower = cat.lower()

                if cat_lower == "panels":
                    dm2 = re.search(r'\b(\d+)\s*[xX]\s*(\d+)\b', desc)
                    if dm2:
                        dimensions = f"{dm2.group(1)}X{dm2.group(2)}"
                        desc = (desc[:dm2.start()] + desc[dm2.end():]).strip()
                else:
                    dm3 = re.search(
                        r'(\d+(?:[- ]\d+/\d+)?)\s*[xX]\s*(\d+(?:[- ]\d+/\d+)?)(?:\s+|[xX])(\d+(?:[- ]\d+/\d+)?)\b',
                        desc
                    )
                    if dm3:
                        dimensions = f"{dm3.group(1)}X{dm3.group(2)}X{dm3.group(3)}"
                        desc = (desc[:dm3.start()] + desc[dm3.end():]).strip()
                    else:
                        dm2 = re.search(
                            r'(\d+(?:[- ]\d+/\d+)?)\s*[xX]\s*(\d+(?:[- ]\d+/\d+)?)\b', desc
                        )
                        if dm2:
                            dimensions = f"{dm2.group(1)}X{dm2.group(2)}"
                            desc = (desc[:dm2.start()] + desc[dm2.end():]).strip()

                footage_uom = "SF" if cat_lower == "panels" else "LF"
                uom = "EA" if cat_lower == "each" else "PC"
                price_uom = "MBF" if cat_lower == "lumber" else ("MSF" if cat_lower == "panels" else "EA")

                doc.line_items.append(LineItemModel(
                    quantity=parse_number(qty), uom=uom, item_code=cat.upper(),
                    description=desc.strip(), footage=parse_number(fd1),
                    footage_uom=footage_uom, unit_price=parse_number(price),
                    price_uom=price_uom, amount=parse_number(total),
                    dimensions=dimensions,
                ))

        m_sub = re.search(r'Sub\s*Total\s*(?:=|\$|:\s*\$)\s*([\d,]+\.\d{2})', text, re.IGNORECASE)
        if m_sub:
            doc.subtotal = parse_number(m_sub.group(1))

        m_tax = re.search(r'Tax\s*(?:=.*?%)?\s*(?:\$)\s*([\d,]+\.\d{2})', text, re.IGNORECASE)
        if m_tax:
            doc.tax = parse_number(m_tax.group(1))

        m_total = re.search(r'Total\s*(?:=|\$|:\s*\$)\s*([\s\d,]+\.\d{2})', text, re.IGNORECASE)
        if m_total:
            doc.total_amount = parse_number(m_total.group(1))

    return doc
