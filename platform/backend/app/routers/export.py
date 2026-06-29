from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import openpyxl
import os
import tempfile
import uuid

router = APIRouter()

class ExportDataRequest(BaseModel):
    project_name: str
    materials: list
    pos: list
    cos: list

@router.post("/client-requirements")
async def generate_client_requirements(req: ExportDataRequest):
    template_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "Client_Requirements_Template.xlsx")
    
    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail="Template not found on server")
        
    try:
        wb = openpyxl.load_workbook(template_path)
        
        # We will attempt to write to the 'Cobia Cove Appartments' or 'Willow Way Apts' sheet
        # Or just the first active sheet if project name doesn't match
        sheet_name = "Cobia Cove Appartments" if "cobia" in req.project_name.lower() else "Willow Way Apts"
        
        if sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
        else:
            ws = wb.active

        # 1. Clear existing data starting from row 3 (leaving headers)
        for row in range(3, ws.max_row + 1):
            for col in range(1, 100): # Clear A to CW
                ws.cell(row=row, column=col).value = None

        # 2. Populate Materials
        current_row = 3
        for mat in req.materials:
            # Type (A)
            ws.cell(row=current_row, column=1).value = "Material"
            # QTY (B)
            ws.cell(row=current_row, column=2).value = mat.get('quantity', 0)
            
            # Dimensions logic based on description or dimensions field
            dims = mat.get('dimensions', '')
            t, w, l = "", "", ""
            if dims and "X" in dims.upper():
                parts = dims.upper().split('X')
                if len(parts) >= 3:
                    t, w, l = parts[0], parts[1], parts[2]
            
            # Thick (AR / 44 for Cobia, S / 19 for Willow)
            if sheet_name == "Cobia Cove Appartments":
                ws.cell(row=current_row, column=44).value = t
                ws.cell(row=current_row, column=46).value = w
                ws.cell(row=current_row, column=47).value = l
                ws.cell(row=current_row, column=48).value = mat.get('description', '')
                ws.cell(row=current_row, column=51).value = mat.get('unit_price', 0) # Cost/MBF
                ws.cell(row=current_row, column=52).value = mat.get('amount', 0)     # Total Cost
            else:
                ws.cell(row=current_row, column=19).value = t
                ws.cell(row=current_row, column=21).value = w
                ws.cell(row=current_row, column=22).value = l
                ws.cell(row=current_row, column=23).value = mat.get('description', '')
                ws.cell(row=current_row, column=26).value = mat.get('unit_price', 0)
                ws.cell(row=current_row, column=27).value = mat.get('amount', 0)

            current_row += 1

        # Save to temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        wb.save(tmp.name)
        wb.close()
        
        return FileResponse(
            tmp.name, 
            filename=f"Client_Requirements_{req.project_name.replace(' ', '_')}.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
