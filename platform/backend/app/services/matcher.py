"""
Matcher service — Phase 2: Intelligent Local Mapping and Heuristics (R2)
"""
import re
from typing import Optional, Tuple

DIM_REGEX = re.compile(
    r'\b(\d+(?:[\s\-]\d+/\d+|\.\d+)?)\s*[Xx]\s*(\d+(?:[\s\-]\d+/\d+|\.\d+)?)\s*[Xx]\s*(\d+(?:[\s\-]\d+/\d+|\.\d+)?)\b'
)


def normalize_text(text: str) -> str:
    if not text:
        return ""
    t = text.upper().strip()
    t = re.sub(r'\b(PT|MCA)\b', 'TREATED', t)
    t = re.sub(r'\bSYP\b', 'SOUTHERN YELLOW PINE', t)
    return t


def parse_dimension_val(val_str: str) -> Optional[float]:
    if not val_str:
        return None
    val_str = val_str.strip()
    try:
        return float(val_str)
    except ValueError:
        pass
    
    m = re.match(r'^(?:(\d+)[- ]+)?(\d+)/(\d+)$', val_str)
    if m:
        whole = float(m.group(1)) if m.group(1) else 0.0
        num = float(m.group(2))
        denom = float(m.group(3))
        if denom != 0:
            return whole + num / denom
    return None


def parse_dimensions_string(dims_str: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    if not dims_str:
        return None, None, None
    parts = re.split(r'\s*[Xx]\s*', dims_str.strip())
    if len(parts) >= 3:
        t = parse_dimension_val(parts[0])
        w = parse_dimension_val(parts[1])
        l = parse_dimension_val(parts[2])
        # Treat 0 as None for T/W — used by LVL encoding "0X0X<length>"
        if t == 0.0: t = None
        if w == 0.0: w = None
        return t, w, l
    if len(parts) == 2:
        # 2-part like "4X8" — thickness and width, no length
        t = parse_dimension_val(parts[0])
        w = parse_dimension_val(parts[1])
        return t, w, None
    m = re.match(r'^\s*([\d\.\-\s/]+)\s*[Xx]\s*([\d\.\-\s/]+)\s*[Xx]\s*([\d\.\-\s/]+)\s*$', dims_str)
    if m:
        t = parse_dimension_val(m.group(1))
        w = parse_dimension_val(m.group(2))
        l = parse_dimension_val(m.group(3))
        if t == 0.0: t = None
        if w == 0.0: w = None
        return t, w, l
    return None, None, None


def extract_dimensions_from_text(text: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    if not text:
        return None, None, None
    m = DIM_REGEX.search(text)
    if m:
        t = parse_dimension_val(m.group(1))
        w = parse_dimension_val(m.group(2))
        l = parse_dimension_val(m.group(3))
        return t, w, l
    return None, None, None


def get_dimensions(desc: str, dims: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    t, w, l = parse_dimensions_string(dims)
    if t is None or w is None or l is None:
        t_d, w_d, l_d = extract_dimensions_from_text(desc)
        if t_d is not None and w_d is not None and l_d is not None:
            return t_d, w_d, l_d
    return t, w, l


def classify_item_category(desc: str, item_code: str = "") -> str:
    desc = desc.upper()
    code = item_code.upper()
    if any(k in desc for k in ["LVL", "PSL", "GLB", "GLULAM", "LSL"]): return "lvl"
    if any(k in desc for k in ["OSB", "PLYWOOD", "PLY", "ZIP", "CDX", "GYPSUM", "SHEATHING"]): return "panels"
    if any(k in desc for k in ["SILL SEAL", "ADHESIVE", "TAPE", "FLASHING", "TYVEK",
                                "WRAP", "SEALANT", "CAULK", "DYNAFLEX", "THRESHOLD",
                                "BT20", "COMPOUND"]): return "each"
    if any(k in desc for k in ["SYP", "MCA", "TREATED", "LUMBER"]): return "lumber"
    if any(k in code for k in ["SYP", "MCA", "LUMBER"]): return "lumber"
    if any(k in code for k in ["LVL", "PSL", "EWP"]): return "lvl"
    if any(k in code for k in ["OSB", "PLY", "ZIP", "PANELS"]): return "panels"
    if any(k in code for k in ["SILL", "TAPE", "TYVEK", "CAULK", "ADHES", "EACH", "HARDWARE"]): return "each"
    return "lumber"


def score_match(inv_desc: str, inv_dims: str, inv_code: str, mat_type: str, mat_thickness: Optional[float], mat_width: Optional[float], mat_length: Optional[float], mat_desc: str) -> int:
    inv_desc_norm = normalize_text(inv_desc)
    mat_desc_norm = normalize_text(mat_desc)
    
    score = 0
    
    # Category match = 10
    inv_category = classify_item_category(inv_desc, inv_code)
    mat_category = classify_item_category(mat_desc, "")
    if mat_type:
        mat_category = classify_item_category(mat_type, "")

    if inv_category == mat_category:
        score += 10
    elif inv_category in mat_category or mat_category in inv_category:
        score += 5
        
    # Extract dimensions
    inv_t, inv_w, inv_l = get_dimensions(inv_desc, inv_dims)
    
    # Matching dimensions = +5 each
    if inv_t is not None and mat_thickness is not None:
        if abs(inv_t - mat_thickness) < 0.01:
            score += 5
    if inv_w is not None and mat_width is not None:
        if abs(inv_w - mat_width) < 0.01:
            score += 5
    if inv_l is not None and mat_length is not None:
        if abs(inv_l - mat_length) < 0.01:
            score += 5
            
    # Wood-species keyword match = +3
    keywords = ["TREATED", "SOUTHERN YELLOW PINE", "LVL", "OSB", "PLYWOOD", "ZIP"]
    for kw in keywords:
        if kw in inv_desc_norm and kw in mat_desc_norm:
            score += 3
            
    # Description word overlap
    inv_words = set(inv_desc_norm.split())
    mat_words = set(mat_desc_norm.split())
    filler = {"X", "AND", "THE", "OF", "FOR", "IN", "TO", "WITH", "FT", "INCH", "PCS", "PC"}
    inv_words = inv_words - filler
    mat_words = mat_words - filler
    common = inv_words & mat_words
    common = {w for w in common if len(w) > 2}
    score += len(common) * 2
    
    return score


def match_material(invoice_item_desc: str, invoice_item_dims: str, invoice_item_code: str, materials: list, **kwargs) -> Optional[dict]:
    db = kwargs.get('db')
    project_id = kwargs.get('project_id')
    if not db and materials:
        from sqlalchemy.orm import object_session
        db = object_session(materials[0])
    if not project_id and materials:
        project_id = getattr(materials[0], 'project_id', None)
        
    # Check ItemMapping table first
    if db and project_id and invoice_item_desc:
        from ..models.mapping import ItemMapping
        mapping = db.query(ItemMapping).filter(
            ItemMapping.project_id == project_id,
            ItemMapping.invoice_description == invoice_item_desc
        ).first()
        if mapping:
            best_match = None
            for mat in materials:
                if mat.id == mapping.material_id:
                    best_match = mat
                    break
            if not best_match:
                from ..models.material import Material
                best_match = db.query(Material).filter(Material.id == mapping.material_id).first()
            if best_match:
                qty_multiplier = 1.0
                inv_t, inv_w, inv_l = get_dimensions(invoice_item_desc, invoice_item_dims)
                if best_match.length and inv_l and best_match.length != inv_l:
                    qty_multiplier = inv_l / best_match.length
                return {
                    "match": best_match,
                    "score": 100,
                    "qty_multiplier": qty_multiplier,
                }

    best_match = None
    best_score = 0

    for mat in materials:
        score = score_match(
            inv_desc=invoice_item_desc,
            inv_dims=invoice_item_dims,
            inv_code=invoice_item_code,
            mat_type=mat.type or "",
            mat_thickness=mat.thickness,
            mat_width=mat.width,
            mat_length=mat.length,
            mat_desc=mat.material_type or ""
        )
        if score > best_score:
            best_score = score
            best_match = mat

    inv_category = classify_item_category(invoice_item_desc, invoice_item_code)
    threshold = 10 if inv_category in ("each", "invoice") else 15

    if best_score >= threshold and best_match:
        qty_multiplier = 1.0
        inv_t, inv_w, inv_l = get_dimensions(invoice_item_desc, invoice_item_dims)
        if best_match.length and inv_l and best_match.length != inv_l:
            qty_multiplier = inv_l / best_match.length

        return {
            "match": best_match,
            "score": best_score,
            "qty_multiplier": qty_multiplier,
        }

    return None
