import sys
import os

# Add platform/backend to sys.path so we can import services
sys.path.append(r"c:\Users\Admin\Desktop\KNCC_EXCEL\platform\backend")

from app.services.pdf_parser import parse_pdf_document

pdf_path = r"c:\Users\Admin\Desktop\KNCC_EXCEL\Client\Willow way Village\Invoices\60126022.pdf"
print("Parsing starting...")
try:
    doc = parse_pdf_document(pdf_path, "INV")
    print("Parsing successful!")
    print(f"Number of line items: {len(doc.line_items)}")
    for item in doc.line_items:
        print(item)
except Exception as e:
    print(f"Exception raised: {e}")
