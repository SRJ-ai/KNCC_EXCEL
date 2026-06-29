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
    vendor: str | None = None
    amount: float | None = None
    project_name: str | None = None
    document_type: str | None = None
    document_number: str | None = None
    line_items: list = []
    status: str = "success"

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
        # Determine parser
        dt = req.document_type.upper()
        name_upper = req.file_name.upper()
        
        if "INVOICE" in name_upper or dt == "INVOICE":
            parsed = parse_invoice(local_path)
            return ScanResponse(
                project_name=parsed["project_name"],
                amount=parsed["total"],
                document_type="Invoice",
                document_number=parsed.get("invoice_number", ""),
                line_items=parsed["line_items"]
            )
        elif "CO" in name_upper or "CHANGE ORDER" in name_upper or dt == "CO":
            parsed = parse_co(local_path)
            return ScanResponse(
                project_name=parsed["project_name"],
                amount=parsed["total"],
                document_type="CO",
                document_number=parsed.get("co_number", ""),
                line_items=parsed["line_items"]
            )
        else: # Default PO
            parsed = parse_po(local_path)
            return ScanResponse(
                vendor=parsed["vendor"],
                project_name=parsed["project_name"],
                amount=parsed["total"],
                document_type="PO",
                line_items=parsed["line_items"]
            )

    finally:
        if os.path.exists(local_path):
            os.remove(local_path)
