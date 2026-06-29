import * as XLSX from 'xlsx';

// Convert zero-indexed column number to Excel column letter (0 -> A, 25 -> Z, 26 -> AA)
function colName(n) {
  let ordA = 'A'.charCodeAt(0);
  let ordZ = 'Z'.charCodeAt(0);
  let len = ordZ - ordA + 1;
  let s = "";
  while(n >= 0) {
    s = String.fromCharCode(n % len + ordA) + s;
    n = Math.floor(n / len) - 1;
  }
  return s;
}

export function generateClientRequirementsExcel(project, materials, pos, invoices, cos) {
  // 1. Prepare dynamic columns
  // Format dates consistently
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.${d.getFullYear()}`;
  };

  const coDates = Array.from(new Set(cos.map(c => formatDate(c.date || c.created_at)))).sort();
  const deliveryDates = Array.from(new Set(pos.map(p => formatDate(p.date || p.created_at)))).sort();
  
  // Tax rate - default to 8% if not provided
  const taxRate = project?.tax_rate ? Number(project.tax_rate) : 1.08;

  // 2. Build Headers
  const headers = [
    'Type', 
    'Qty'
  ];
  
  coDates.forEach(d => headers.push(`CO ${d}`));
  headers.push('CO QTY', 'PO + CO Qty', 'T', 'x', 'W', 'Length', 'Material Type', 'L/F-Pcs.', 'B/F-S/F', 'Cost/MBF/MSF', 'Total Cost', 'Total Cost + Tax', 'Invoice #');
  
  deliveryDates.forEach(d => headers.push(`Delivered ${d}`));
  headers.push('Total Delivered', 'L/F', 'B/f - S/f Qty', 'Cost', 'Cost with Tax', '% Delivery', 'Inventory (in Bundles)', 'UOM', 'PCS/Bundle', 'Inventory in PCS', 'Issues', 'L/F', 'B/f - S/f Qty', '% Issued', 'Cost', 'Cost with Tax', 'Variance Code', 'Reason');

  // Find column indices for formula generation
  const getCol = (name) => headers.indexOf(name);
  const colIndex = {
    qty: getCol('Qty'),
    coQty: getCol('CO QTY'),
    poCoQty: getCol('PO + CO Qty'),
    unitPrice: getCol('Cost/MBF/MSF'),
    totalCost: getCol('Total Cost'),
    totalCostTax: getCol('Total Cost + Tax'),
    totalDelivered: getCol('Total Delivered'),
    pctDelivery: getCol('% Delivery'),
  };

  const coStartIndex = headers.indexOf(coDates.length > 0 ? `CO ${coDates[0]}` : 'CO QTY');
  const coEndIndex = headers.indexOf('CO QTY') - 1;
  
  const deliveryStartIndex = headers.indexOf(deliveryDates.length > 0 ? `Delivered ${deliveryDates[0]}` : 'Total Delivered');
  const deliveryEndIndex = headers.indexOf('Total Delivered') - 1;

  // 3. Build Data Rows
  const rows = [];
  rows.push(headers); // Row 1

  // Function to create an Excel formula object
  const createFormula = (formula) => ({ t: 'n', f: formula });

  materials.forEach((mat, idx) => {
    const r = idx + 2; // Excel row number (1-based, header is 1, data starts at 2)
    const row = new Array(headers.length).fill('');

    row[getCol('Type')] = mat.description || mat.item_code || 'Material';
    row[colIndex.qty] = Number(mat.quantity || 0);

    // CO Columns (leave blank for user entry, or map if we have material-level CO quantities)
    // For now, leaving blank since our DB doesn't map COs to specific materials tightly enough yet.

    // CO QTY Formula: SUM(CO Date columns)
    if (coEndIndex >= coStartIndex) {
      row[colIndex.coQty] = createFormula(`SUM(${colName(coStartIndex)}${r}:${colName(coEndIndex)}${r})`);
    } else {
      row[colIndex.coQty] = 0;
    }

    // PO + CO Qty: Qty + CO QTY
    row[colIndex.poCoQty] = createFormula(`${colName(colIndex.qty)}${r}+${colName(colIndex.coQty)}${r}`);

    // Dimensions (Try to parse dimensions if available)
    row[getCol('T')] = ''; 
    row[getCol('x')] = '';
    row[getCol('W')] = '';
    row[getCol('Length')] = mat.footage || '';
    row[getCol('Material Type')] = mat.item_code || '';
    row[getCol('L/F-Pcs.')] = '';
    row[getCol('B/F-S/F')] = '';
    row[colIndex.unitPrice] = Number(mat.unit_price || 0);

    // Total Cost = (PO + CO Qty) * Unit Price
    row[colIndex.totalCost] = createFormula(`${colName(colIndex.poCoQty)}${r}*${colName(colIndex.unitPrice)}${r}`);
    
    // Total Cost + Tax
    row[colIndex.totalCostTax] = createFormula(`${colName(colIndex.totalCost)}${r}*${taxRate}`);

    // Invoice mapping
    const matchedInvoice = invoices.find(inv => inv.po_id === mat.source_document || inv.po_number === mat.source_document);
    row[getCol('Invoice #')] = matchedInvoice ? (matchedInvoice.invoice_number || matchedInvoice.id) : '';

    // Delivery columns (leave blank for user entry)

    // Total Delivered Formula
    if (deliveryEndIndex >= deliveryStartIndex) {
      row[getCol('Total Delivered')] = createFormula(`SUM(${colName(deliveryStartIndex)}${r}:${colName(deliveryEndIndex)}${r})`);
    } else {
      row[getCol('Total Delivered')] = 0;
    }

    row[getCol('L/F')] = '';
    row[getCol('B/f - S/f Qty')] = '';
    row[getCol('Cost')] = '';
    row[getCol('Cost with Tax')] = '';

    // % Delivery = Total Delivered / (PO + CO Qty)
    row[colIndex.pctDelivery] = createFormula(`IF(${colName(colIndex.poCoQty)}${r}=0,0,${colName(colIndex.totalDelivered)}${r}/${colName(colIndex.poCoQty)}${r})`);

    row[getCol('Inventory (in Bundles)')] = '';
    row[getCol('UOM')] = mat.uom || '';
    row[getCol('PCS/Bundle')] = '';
    row[getCol('Inventory in PCS')] = '';
    
    rows.push(row);
  });

  // 4. Create Workbook and Sheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths for readability
  const colWidths = headers.map(h => {
    if (h === 'Type' || h === 'Material Type' || h === 'Invoice #') return { wch: 25 };
    if (h === 'Description' || h === 'Reason') return { wch: 40 };
    return { wch: 15 }; // Default width
  });
  ws['!cols'] = colWidths;

  // Add percentage formatting for % Delivery
  // In XLSX, formats can be added to cells using cell.z
  if (rows.length > 1) {
    for (let r = 2; r <= rows.length; r++) {
      const cellRef = XLSX.utils.encode_cell({ c: colIndex.pctDelivery, r: r - 1 });
      if (ws[cellRef]) ws[cellRef].z = '0.00%';
      
      const costRef1 = XLSX.utils.encode_cell({ c: colIndex.totalCost, r: r - 1 });
      if (ws[costRef1]) ws[costRef1].z = '"$"#,##0.00';
      
      const costRef2 = XLSX.utils.encode_cell({ c: colIndex.totalCostTax, r: r - 1 });
      if (ws[costRef2]) ws[costRef2].z = '"$"#,##0.00';
    }
  }

  // Name sheet after project, sanitize name
  let sheetName = project?.name || 'Project';
  sheetName = sheetName.replace(/[\\/?*[\]]/g, '').substring(0, 31);
  
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return wb;
}
