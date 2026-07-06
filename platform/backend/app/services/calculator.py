"""
Calculator service — fixed:
  FIX #4: Tax rate is now accepted as a parameter (from Project.tax_rate or parsed doc),
           NOT hardcoded to 1.06.
  FIX #7: All calculations use po_co_qty (PO qty + all CO adjustments) not raw qty.
"""


def compute_material_totals(mat, tax_rate: float = 1.06) -> dict:
    """
    Compute LF/BF/cost totals for a material row.
    Uses po_co_qty (= PO qty + CO adjustments) as the authoritative quantity.
    """
    lf_pcs = 0
    bf_sf = 0
    total_cost = 0

    mat_type = str(mat.type).lower() if mat.type else ""

    # Use po_co_qty if available; fall back to qty for backwards compat
    qty = (mat.po_co_qty or mat.qty or 0)

    if mat_type == "lumber":
        if mat.length:
            lf_pcs = qty * mat.length
        if mat.thickness and mat.width and mat.length:
            bf_sf = (qty * mat.thickness * mat.width * mat.length) / 12
        if mat.cost_mbf:
            total_cost = (bf_sf * mat.cost_mbf) / 1000

    elif mat_type == "panels":
        # Panels: thickness=4, width=8 (sheet dimensions); quantity is piece count
        if mat.thickness and mat.width:
            bf_sf = qty * mat.thickness * mat.width
        if mat.cost_mbf:
            total_cost = (bf_sf * mat.cost_mbf) / 1000

    elif mat_type == "lvl":
        if mat.length:
            lf_pcs = qty * mat.length
        if mat.cost_mbf:
            total_cost = lf_pcs * mat.cost_mbf

    elif mat_type in ("each", "invoice"):
        # Each items: lf_pcs = quantity (counted as individual pieces)
        lf_pcs = qty
        if mat.cost_mbf:
            total_cost = lf_pcs * mat.cost_mbf

    # Normalize tax_rate: if stored as 0.06 convert to multiplier 1.06
    mult = tax_rate if tax_rate > 1 else (1 + tax_rate)
    total_cost_tax = total_cost * mult

    return {
        "lf_pcs": round(lf_pcs, 4),
        "bf_sf": round(bf_sf, 4),
        "total_cost": round(total_cost, 2),
        "total_cost_tax": round(total_cost_tax, 2),
    }


def update_delivery_totals(mat, deliveries, tax_rate: float = 1.06) -> dict:
    """
    Compute delivered quantities and costs.
    """
    total_delivered = 0
    for d in deliveries:
        multiplier = getattr(d, "qty_multiplier", 1.0) or 1.0
        total_delivered += (d.quantity or 0) * multiplier

    delivered_lf = 0
    delivered_bf = 0
    delivered_cost = 0

    mat_type = str(mat.type).lower() if mat.type else ""

    if mat_type in ("lumber", "lvl") and mat.length:
        delivered_lf = total_delivered * mat.length
    # Panels and Each have no LF (delivered_lf stays 0)

    if mat_type == "lumber":
        if mat.thickness and mat.width and mat.length:
            delivered_bf = (total_delivered * mat.thickness * mat.width * mat.length) / 12
        if mat.cost_mbf:
            delivered_cost = (delivered_bf * mat.cost_mbf) / 1000

    elif mat_type == "panels":
        if mat.thickness and mat.width:
            delivered_bf = total_delivered * mat.thickness * mat.width
        if mat.cost_mbf:
            delivered_cost = (delivered_bf * mat.cost_mbf) / 1000

    elif mat_type == "lvl":
        if mat.cost_mbf:
            delivered_cost = delivered_lf * mat.cost_mbf

    elif mat_type in ("each", "invoice"):
        if mat.cost_mbf:
            delivered_cost = total_delivered * mat.cost_mbf

    mult = tax_rate if tax_rate > 1 else (1 + tax_rate)
    delivered_cost_tax = delivered_cost * mult

    total_cost_data = compute_material_totals(mat, tax_rate)
    total_cost = total_cost_data["total_cost"]

    # % delivery = delivered pieces / total pieces (qty-based, not cost-based)
    po_co_qty = mat.po_co_qty or mat.qty or 0
    pct_delivery = (total_delivered / po_co_qty) if po_co_qty > 0 else 0

    return {
        "total_delivered": round(total_delivered, 4),
        "delivered_lf": round(delivered_lf, 4),
        "delivered_bf": round(delivered_bf, 4),
        "delivered_cost": round(delivered_cost, 2),
        "delivered_cost_tax": round(delivered_cost_tax, 2),
        "pct_delivery": round(pct_delivery, 4),
    }
