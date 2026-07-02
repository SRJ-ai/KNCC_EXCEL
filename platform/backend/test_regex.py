import re

lines = [
    'Lumber 9078 2 x 8   1  SYP #2             9078  12104 485.00 $ 5,870.44',
    'Lumber 982 2 x  8   9  SYP #2 PET 104-5/8 8838  11784 485.00 $ 5,715.24',
    'LVL  495           9  3-1/2X5-1/4 PSL/GLB 4455       6.88 $  30,650.40',
    'Each  515              SUBFLOOR ADHESIVE   515        5.50 $  2,832.50',
    'Panels 1904 4 x 8      7/16" ZIP                60928 595.00 $ 36,252.16'
]

pat = re.compile(
    r'^(Lumber|Panels|EWP|Each|Hardware|Invoice|LVL)\s+([\d,]+)\s+(.*?)\s+([\d,]+)(?:\s+([\d,]+))?\s+([\d,.]+)\s+\$\s*(-?[\d,]+\.\d{2})',
    re.I
)

for line in lines:
    m = pat.match(line.strip())
    if m:
        category, quantity, desc, fd1, fd2, price, total = m.groups()
        
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
        
        print(f"CAT: {category} | QTY: {quantity} | DESC: {desc} | DIMS: {dimensions} | PRICE: {price} | TOTAL: {total}")
    else:
        print(f"FAIL: {line}")
