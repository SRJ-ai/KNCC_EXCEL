import sys
# Add platform/backend to path
sys.path.append(r"c:\Users\Admin\Desktop\KNCC_EXCEL\platform\backend")

from app.routers.upload import _load_excel_row_refs
print("Loading excel row refs...")
try:
    res = _load_excel_row_refs("Willow Way Village")
    print("Successfully loaded! Count:", len(res))
except Exception as e:
    print("Failed with exception:", e)
