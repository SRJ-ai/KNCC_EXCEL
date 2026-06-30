from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import urllib.request
import tempfile
import os
from app.services.document_parser import parse_po, parse_invoice, parse_co

router = APIRouter()

class ScanRequest(BaseModel):
    file_path: str
    file_name: str
    document_type: str = "PO" # 'PO', 'Invoice', 'CO'

class ScanResponse(BaseModel):
    type: str
    metadata: dict
    materials: list

@router.post("/document", response_model=ScanResponse)
async def scan_document(req: ScanRequest):
    if not req.file_path:
        raise HTTPException(status_code=400, detail="Missing file path")

    # Reconstruct public Supabase URL
    public_url = f"https://wjpmruxpwhcbmzaurcbq.supabase.co/storage/v1/object/public/documents/{req.file_path}"
    
    # Download file
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf" if req.file_name.lower().endswith('.pdf') else ".xlsx") as tmp:
            urllib.request.urlretrieve(public_url, tmp.name)
            local_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

    try:
        dt = req.document_type.upper()
        name_upper = req.file_name.upper()
        
        result_type = "UNKNOWN"
        metadata = {"supplier": "Matheus Lumber", "status": "Approved"}
        materials = []

        if "INVOICE" in name_upper or dt == "INVOICE":
            parsed = parse_invoice(local_path)
            result_type = "INVOICE"
            metadata.update({
                "invoice_number": parsed.get("invoice_number", ""),
                "amount": parsed.get("total", 0),
                "date": datetime.now().strftime("%Y-%m-%d")
            })
            materials = parsed.get("line_items", [])
            
        elif "CO" in name_upper or "CHANGE ORDER" in name_upper or dt == "CO":
            parsed = parse_co(local_path)
            result_type = "CO"
            metadata.update({
                "co_number": parsed.get("co_number", f"CO-{datetime.now().strftime('%m.%d.%Y')}"),
                "amount": parsed.get("total", 0),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "title": f"Change Order parsed from {req.file_name}"
            })
            materials = parsed.get("line_items", [])
            
        else:
            parsed = parse_po(local_path)
            result_type = "PO"
            metadata.update({
                "po_number": f"PO-{datetime.now().strftime('%H%M')}",
                "amount": parsed.get("total", 0),
                "date": datetime.now().strftime("%Y-%m-%d"),
                "description": "Lumber Package"
            })
            materials = parsed.get("line_items", [])

        # Format materials for the frontend
        formatted_materials = []
        for i, item in enumerate(materials):
            formatted_materials.append({
                "id": f"mat-{result_type}-{datetime.now().timestamp()}-{i}",
                "item_code": item.get("item_code", item.get("description", "ITEM")),
                "description": item.get("description", ""),
                "quantity": item.get("quantity", 0),
                "uom": item.get("uom", "EA"),
                "unit_price": item.get("unit_price", 0),
                "amount": item.get("amount", 0),
                "dimensions": item.get("dimensions", ""),
                "footage": item.get("footage", ""),
                "category": item.get("category", "lumber")
            })

        return ScanResponse(
            type=result_type,
            metadata=metadata,
            materials=formatted_materials
        )

    finally:
        if os.path.exists(local_path):
            os.remove(local_path)
