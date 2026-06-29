/**
 * Sets the worker source using the loaded global pdfjsLib
 */
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${window.pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Extracts raw text lines from a PDF ArrayBuffer
 */
export async function extractTextFromPDF(arrayBuffer) {
  if (!window.pdfjsLib) throw new Error("PDF.js library not loaded");
  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  let lines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Group text items by approximate Y coordinate to form lines
    const items = content.items;
    let currentY = -1;
    let currentLine = '';
    
    items.forEach(item => {
      // transform[5] is the Y coordinate
      const y = Math.round(item.transform[5]); 
      if (currentY !== y && currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
        fullText += currentLine + '\n';
        currentLine = '';
      }
      currentY = y;
      currentLine += item.str + ' ';
    });
    if (currentLine.trim().length > 0) {
       lines.push(currentLine.trim());
       fullText += currentLine + '\n';
    }
  }

  return { fullText, lines };
}

/**
 * Parses Matheus Lumber Documents
 */
export async function parseMatheusDocument(file, projectId) {
  const arrayBuffer = await file.arrayBuffer();
  const { fullText, lines } = await extractTextFromPDF(arrayBuffer);
  
  const text = fullText.toUpperCase();
  let type = 'UNKNOWN';
  if (text.includes('INVOICE NO.')) type = 'INVOICE';
  else if (text.includes('ORDER ADD / CHANGE') || text.includes('CHANGE ORDER')) type = 'CO';
  else if (text.includes('QUOTE FOR:') || text.includes('PROPOSAL#')) type = 'PO'; // Typically a PO or Quote format

  // We will return structured data that can be injected into the platform
  const result = {
    type,
    metadata: { project_id: projectId },
    materials: []
  };

  if (type === 'INVOICE') {
    // Parse Invoice
    const invMatch = fullText.match(/INVOICE NO\.\s*([\w\d]+)/i);
    const dateMatch = fullText.match(/INVOICE DATE\s*([\d/]+)/i);
    const poMatch = fullText.match(/Customer P\.O\. No\.\s*([\w\-\d]+)/i);
    
    result.metadata.id = invMatch ? `inv-parsed-${invMatch[1]}` : `inv-parsed-${Date.now()}`;
    result.metadata.invoice_number = invMatch ? invMatch[1] : 'Unknown';
    result.metadata.date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString();
    result.metadata.po_id = poMatch ? poMatch[1] : null;
    result.metadata.supplier = 'Matheus Lumber Company';
    result.metadata.status = 'Paid'; // Assume paid or pending

    // Extract Total
    const amountMatch = fullText.match(/TOTAL AMOUNT\s+([\d,.]+)/i);
    if (amountMatch) result.metadata.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    // Try to extract lines
    // Basic regex: Look for lines with QTY UOM and Description
    const sfMatches = [...fullText.matchAll(/([\d,.]+)\s+SF\s+([\d,.]+)\/MSF\s+([\d,.]+)/ig)];
    if (sfMatches.length > 0) {
      sfMatches.forEach((m, i) => {
        result.materials.push({
          id: `mat-${result.metadata.id}-${i}`,
          item_code: 'LUMBER',
          description: 'Lumber Invoice Line',
          quantity: parseFloat(m[1].replace(/,/g, '')),
          uom: 'SF',
          unit_price: parseFloat(m[2].replace(/,/g, '')),
          amount: parseFloat(m[3].replace(/,/g, '')),
          source_document: result.metadata.id,
          project_id: projectId
        });
      });
    }

  } else if (type === 'CO') {
    // Parse Change order
    const coMatch = fullText.match(/CHANGE ORDER#\s*([\w\d]+)/i);
    const dateMatch = fullText.match(/DATE\s*([\d/]{8,10})/i);
    
    const coNumber = coMatch ? coMatch[1] : `CO-${Date.now()}`;
    const date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString();

    result.metadata.id = `co-parsed-${coNumber}`;
    result.metadata.co_number = `CO ${date.replace(/\//g, '.')}`; // Format for the excel: CO 11.21.2025
    result.metadata.title = `Change Order ${coNumber}`;
    result.metadata.description = `Parsed from ${file.name}`;
    result.metadata.date = date;
    result.metadata.status = 'Approved';

    const amountMatch = fullText.match(/TOTAL AMOUNT\s+([\d,.]+)/i);
    if (amountMatch) result.metadata.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    // Extract Materials
    // Example: -31,392 SF  395.00/MSF
    const lineMatches = [...fullText.matchAll(/(-?[\d,.]+)\s+(SF|PC|EA|LF)\s+(-?[\d,.]+)\/MSF/ig)];
    // Fallback simple parsing for COs
    if (lineMatches.length > 0) {
      lineMatches.forEach((m, i) => {
        result.materials.push({
          id: `mat-${result.metadata.id}-${i}`,
          item_code: 'CO_ITEM',
          description: 'Change Order Line',
          quantity: parseFloat(m[1].replace(/,/g, '')),
          uom: m[2],
          unit_price: parseFloat(m[3].replace(/,/g, '')),
          amount: 0,
          source_document: result.metadata.id,
          project_id: projectId
        });
      });
    }

  } else if (type === 'PO') {
    // Parse PO Table
    result.metadata.id = `po-parsed-${Date.now()}`;
    result.metadata.po_number = `PO-${Date.now().toString().slice(-4)}`;
    result.metadata.date = new Date().toLocaleDateString();
    result.metadata.supplier = 'Matheus Lumber';
    result.metadata.status = 'Approved';
    result.metadata.description = 'Lumber Package';
    result.metadata.amount = 0;

    // Look for lines like: Lumber 5 6 x 6 10 PT 50 150 1145.00 171.75
    // Regex matches: Lumber (Qty) (T) x (W) (L) (Type) (L/F) (B/F) (Cost) (Total)
    const lumberLines = [...fullText.matchAll(/Lumber\s+(\d+)\s+(\d+)\s*x\s*(\d+)\s+(\d+)\s+(.*?)\s+(\d+)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/ig)];
    
    
    lumberLines.forEach((m, i) => {
      const qty = parseFloat(m[1]); // Pcs
      const thick = m[2];
      const width = m[3];
      const length = m[4];
      const desc = m[5].trim(); // PT or SYP #2
      const unitPrice = parseFloat(m[8].replace(/,/g, ''));
      const total = parseFloat(m[9].replace(/,/g, ''));

      result.metadata.amount += total;

      result.materials.push({
        id: `mat-${result.metadata.id}-${i}`,
        item_code: desc,
        description: `Lumber`,
        quantity: qty,
        uom: 'pcs',
        unit_price: unitPrice,
        amount: total,
        dimensions: `${thick}x${width}`,
        footage: length,
        source_document: result.metadata.id,
        project_id: projectId
      });
    });
  }

  return result;
}
