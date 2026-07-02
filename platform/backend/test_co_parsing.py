import os
import re
import pdfplumber

def get_pdfs_from_dir(directory):
    pdfs = []
    if os.path.exists(directory):
        for root, _, files in os.walk(directory):
            for file in files:
                if file.lower().endswith('.pdf'):
                    pdfs.append(os.path.join(root, file))
    return pdfs

def test():
    ROOT_DIR = r"c:\Users\Admin\Desktop\KNCC_EXCEL"
    willow_dir = os.path.join(ROOT_DIR, "Client", "Willow way Village")
    cobia_dir = os.path.join(ROOT_DIR, "Client", "Cobia Cove")
    
    # Let's test the regexes on all CO files
    co_pattern_new = re.compile(
        r'([\d,]+)\s*(LF|PC|EA|BF)\s*\|?\s*(.*?)\s+([\d,.]+)\s*(BF|SF|LF|EA)\s+([\d,.]+)\s*/\s*(MBF|MSF|PC|EA|LF)\s+(-?[\d,]+\.?\d*)',
        re.IGNORECASE
    )
    
    for label, directory in [("Willow", willow_dir), ("Cobia", cobia_dir)]:
        pdfs = get_pdfs_from_dir(directory)
        for pdf_path in pdfs:
            filename = os.path.basename(pdf_path)
            if "co" in filename.lower() and "cobia" not in filename.lower():
                print(f"Testing {filename}...")
                with pdfplumber.open(pdf_path) as pdf:
                    text = "\n".join((p.extract_text(layout=True) or "") for p in pdf.pages)
                lines = text.split("\n")
                matched_count = 0
                for line in lines:
                    m = co_pattern_new.search(line.strip())
                    if m:
                        matched_count += 1
                        print(f"  Matched: {line.strip()}")
                        print(f"    G1(qty): {m.group(1)}, G2(uom): {m.group(2)}, G3(desc): {m.group(3)}, G4(footage): {m.group(4)}, G5(fuom): {m.group(5)}, G6(price): {m.group(6)}, G7(puom): {m.group(7)}, G8(amt): {m.group(8)}")
                print(f"Total matched for {filename}: {matched_count}\n")

if __name__ == "__main__":
    test()
