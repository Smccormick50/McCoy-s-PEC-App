// Generates a real, downloadable PDF file for a project, entirely client-side.
// Replaces window.print() — printing from an iOS home-screen app (standalone
// mode) is a known, longstanding WebKit limitation (the print preview never
// renders), so this produces an actual .pdf file directly instead, which
// works identically on every platform.
//
// Uses jsPDF (bundled locally as jspdf.umd.min.js) to lay out the report
// text/tables/photos, then hands the result to pdf-lib (bundled locally as
// pdf-lib.min.js) to merge in real pages from any attached PDF documents,
// so those still end up "each on their own page" inside the one final file.

const PDF_PAGE_W = 612, PDF_PAGE_H = 792, PDF_MARGIN = 56;
const PDF_CONTENT_W = PDF_PAGE_W - PDF_MARGIN * 2;
const PDF_GREEN = [14, 74, 42];
const PDF_YELLOW = [245, 209, 22];
const PDF_TEXT = [26, 26, 26];
const PDF_MUTED = [110, 105, 92];
const PDF_LINE = [214, 209, 196];

function pdfLoadImageAsDataUrl(url) {
  if (typeof fetch === 'undefined') return Promise.resolve(null);
  return fetch(url)
    .then(r => { if (!r.ok) throw new Error('logo fetch failed'); return r.blob(); })
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

function pdfDataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pdfDownloadBlob(blob, filename) {
  // Desktop Chrome/Firefox/Edge: blob: URLs work correctly with <a download>.
  // iOS Safari: ignores <a download> on blob: URLs and navigates instead,
  //   showing raw binary — so we convert to data: URL via FileReader first.
  // Desktop Chrome: data: PDF URLs are BLOCKED by Chrome security policy
  //   (shown as raw binary text) — so we must NOT use data: on desktop.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // iOS: use data: URL which Safari respects for downloads
    try {
      const reader = new FileReader();
      reader.onload = function () {
        const a = document.createElement('a');
        a.href = reader.result;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('iOS PDF download failed:', e);
    }
  } else {
    // Desktop: blob: URL + hidden anchor is the reliable cross-browser approach
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      console.error('Desktop PDF download failed:', e);
    }
  }
}

// Mutable layout cursor shared across helper functions for one report build.
function makeCursor(doc) {
  return {
    doc,
    y: PDF_MARGIN,
    ensure(neededHeight) {
      if (this.y + neededHeight > PDF_PAGE_H - PDF_MARGIN) {
        this.doc.addPage();
        this.y = PDF_MARGIN;
      }
    }
  };
}

function pdfSectionTitle(c, text) {
  c.ensure(28);
  c.doc.setFont('helvetica', 'bold');
  c.doc.setFontSize(11);
  c.doc.setTextColor(...PDF_TEXT);
  c.doc.text(text.toUpperCase(), PDF_MARGIN, c.y);
  c.doc.setDrawColor(...PDF_LINE);
  c.doc.setLineWidth(0.75);
  c.doc.line(PDF_MARGIN, c.y + 5, PDF_PAGE_W - PDF_MARGIN, c.y + 5);
  c.y += 20;
}

function pdfTableRows(c, rows, colWidths, align) {
  c.doc.setFont('helvetica', 'normal');
  c.doc.setFontSize(10);
  const ROW_H = 22;
  rows.forEach(cols => {
    c.ensure(ROW_H);
    c.doc.setTextColor(...PDF_TEXT);
    let cx = PDF_MARGIN;
    cols.forEach((val, i) => {
      const w = colWidths[i];
      if (align[i] === 'right') {
        c.doc.text(String(val), cx + w, c.y, { align: 'right' });
      } else {
        c.doc.text(String(val), cx, c.y);
      }
      cx += w;
    });
    c.y += ROW_H;
    c.doc.setDrawColor(...PDF_LINE);
    c.doc.setLineWidth(0.4);
    c.doc.line(PDF_MARGIN, c.y - 8, PDF_PAGE_W - PDF_MARGIN, c.y - 8);
  });
  c.y += 6;
}

function pdfEmptyRow(c, label) {
  c.ensure(16);
  c.doc.setFont('helvetica', 'italic');
  c.doc.setFontSize(10);
  c.doc.setTextColor(...PDF_MUTED);
  c.doc.text(label, PDF_MARGIN, c.y);
  c.y += 18;
}

async function buildProjectReportPdf(project) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const c = makeCursor(doc);

  // ---- Header ----
  const logoDataUrl = await pdfLoadImageAsDataUrl('mccoys-logo.png');
  if (logoDataUrl) {
    try {
      const logoH = 26;
      const logoW = logoH * (2048 / 1010);
      doc.addImage(logoDataUrl, 'PNG', PDF_MARGIN, c.y, logoW, logoH);
    } catch (e) { /* skip logo if it fails to embed */ }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_MUTED);
  doc.text('PROJECT COST ESTIMATE', PDF_PAGE_W - PDF_MARGIN, c.y + 18, { align: 'right' });
  c.y += 46;

  // ---- Status + project name ----
  const isFinal = project.status === 'final';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...(isFinal ? PDF_GREEN : PDF_MUTED));
  doc.text(isFinal ? 'FINAL' : 'DRAFT', PDF_MARGIN, c.y);
  c.y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...PDF_TEXT);
  doc.text(project.name || 'Untitled Project', PDF_MARGIN, c.y);
  c.y += 28;

  // ---- Info grid (2 columns) ----
  const infoPairs = [
    ['Store', project.store || '—'], ['Project No.', project.projectNumber || '—'],
    ['Estimator', project.estimator || '—'], ['Date', formatDateDisplay(project.date)],
    ['Approved By', project.approvedBy || '—'], ['Approved Date', formatDateDisplay(project.approvedDate)],
    ['Start', formatDateDisplay(project.startDate)], ['End', formatDateDisplay(project.endDate)]
  ];
  const colW = PDF_CONTENT_W / 2;
  for (let i = 0; i < infoPairs.length; i += 2) {
    c.ensure(34);
    [infoPairs[i], infoPairs[i + 1]].forEach((pair, col) => {
      if (!pair) return;
      const x = PDF_MARGIN + col * colW;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...PDF_MUTED);
      doc.text(pair[0].toUpperCase(), x, c.y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...PDF_TEXT);
      doc.text(String(pair[1]), x, c.y + 14);
    });
    c.y += 32;
  }
  c.y += 10;

  // ---- Cost summary box ----
  const subtotal = computeSubtotal(project), tax = computeTax(project), total = computeTotal(project);
  c.ensure(88);
  doc.setFillColor(...PDF_GREEN);
  doc.roundedRect(PDF_MARGIN, c.y, PDF_CONTENT_W, 78, 4, 4, 'F');
  let sy = c.y + 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(235, 232, 220);
  doc.text('Subtotal', PDF_MARGIN + 16, sy);
  doc.text(formatCurrency(subtotal), PDF_PAGE_W - PDF_MARGIN - 16, sy, { align: 'right' });
  sy += 18;
  doc.text(`Tax (${num(project.taxRate).toFixed(2)}%)`, PDF_MARGIN + 16, sy);
  doc.text(formatCurrency(tax), PDF_PAGE_W - PDF_MARGIN - 16, sy, { align: 'right' });
  sy += 24;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...PDF_YELLOW);
  doc.text('Total', PDF_MARGIN + 16, sy);
  doc.text(formatCurrency(total), PDF_PAGE_W - PDF_MARGIN - 16, sy, { align: 'right' });
  c.y += 98;

  // ---- Cost Categories (line-item detail) ----
  pdfSectionTitle(c, 'Cost Categories');
  const activeCats = project.categories.filter(cat => computeCategorySubtotal(cat) !== 0);
  if (!activeCats.length) {
    pdfEmptyRow(c, 'No costs entered yet.');
  } else {
    activeCats.forEach(cat => {
      const activeItems = cat.items.filter(it => num(it.amount) !== 0);
      if (!activeItems.length) return;

      // Category header row — bold, slightly indented code + title + subtotal
      c.ensure(22);
      doc.setFillColor(242, 240, 233); // light tint to distinguish header
      doc.rect(PDF_MARGIN, c.y - 12, PDF_CONTENT_W, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...PDF_TEXT);
      doc.text(cat.code, PDF_MARGIN + 4, c.y);
      doc.text(cat.title, PDF_MARGIN + 52, c.y);
      doc.text(formatCurrency(computeCategorySubtotal(cat)), PDF_PAGE_W - PDF_MARGIN, c.y, { align: 'right' });
      c.y += 14;
      doc.setDrawColor(...PDF_LINE);
      doc.setLineWidth(0.4);
      doc.line(PDF_MARGIN, c.y - 4, PDF_PAGE_W - PDF_MARGIN, c.y - 4);

      // Individual line items
      activeItems.forEach(item => {
        const hasVendor = item.vendor && item.vendor.trim();
        const rowH = hasVendor ? 30 : 20;
        c.ensure(rowH);

        // Item name (bold) + vendor (muted, smaller, second line)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...PDF_TEXT);
        const nameY = hasVendor ? c.y - 4 : c.y;
        doc.text(item.name || '(unnamed)', PDF_MARGIN + 52, nameY);

        if (hasVendor) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...PDF_MUTED);
          doc.text(item.vendor.trim(), PDF_MARGIN + 52, c.y + 9);
        }

        // Taxable indicator
        if (item.taxable) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...PDF_MUTED);
          doc.text('TAX', PDF_MARGIN + 35, nameY);
        }

        // Amount
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...PDF_TEXT);
        doc.text(formatCurrency(num(item.amount)), PDF_PAGE_W - PDF_MARGIN, nameY, { align: 'right' });

        c.y += rowH;
        doc.setDrawColor(...PDF_LINE);
        doc.setLineWidth(0.3);
        doc.line(PDF_MARGIN + 52, c.y - 8, PDF_PAGE_W - PDF_MARGIN, c.y - 8);
      });
      c.y += 6;
    });
  }

  // ---- CSI Division Summary ----
  pdfSectionTitle(c, 'CSI Division Summary');
  const divSummary = computeDivisionSummary(project).filter(d => d.amount !== 0);
  if (divSummary.length) {
    pdfTableRows(c, divSummary.map(d => [d.code, d.name, formatCurrency(d.amount)]), [50, 330, 120], ['left', 'left', 'right']);
  } else pdfEmptyRow(c, 'No costs entered yet.');

  // ---- CapEx Depreciation Summary ----
  pdfSectionTitle(c, 'CapEx Depreciation Summary');
  const depSummary = computeDepreciationSummary(project).filter(d => d.amount !== 0);
  if (depSummary.length) {
    pdfTableRows(c, depSummary.map(d => [d.term, formatCurrency(d.amount)]), [380, 120], ['left', 'right']);
  } else pdfEmptyRow(c, 'No costs entered yet.');

  // ---- Notes ----
  if (project.notes && project.notes.trim()) {
    pdfSectionTitle(c, 'Notes');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_TEXT);
    const lines = doc.splitTextToSize(project.notes, PDF_CONTENT_W);
    lines.forEach(line => {
      c.ensure(15);
      doc.text(line, PDF_MARGIN, c.y);
      c.y += 14;
    });
    c.y += 8;
  }

  // ---- Photos ----
  const images = project.photos.filter(isImageAttachment);
  if (images.length) {
    pdfSectionTitle(c, 'Photos');
    const GAP = 12;
    const cellW = (PDF_CONTENT_W - GAP) / 2;
    const cellImgH = 180;
    const captionH = 16;
    const cellTotalH = cellImgH + captionH + 8; // image + caption + bottom padding

    for (let i = 0; i < images.length; i += 2) {
      c.ensure(cellTotalH + 4);
      const rowPhotos = [images[i], images[i + 1]];
      rowPhotos.forEach((photo, col) => {
        if (!photo) return;
        const x = PDF_MARGIN + col * (cellW + GAP);
        // Light background card
        doc.setFillColor(250, 248, 241);
        doc.setDrawColor(...PDF_LINE);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, c.y, cellW, cellImgH, 2, 2, 'FD');
        try {
          const props = doc.getImageProperties(photo.dataUrl);
          const scale = Math.min((cellW - 4) / props.width, (cellImgH - 4) / props.height);
          const w = props.width * scale, h = props.height * scale;
          const fmt = (photo.mimeType || '').indexOf('png') !== -1 ? 'PNG' : 'JPEG';
          doc.addImage(photo.dataUrl, fmt, x + (cellW - w) / 2, c.y + (cellImgH - h) / 2, w, h);
        } catch (e) { /* skip photo if it fails to decode */ }
        if (photo.caption) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...PDF_MUTED);
          doc.text(photo.caption, x + cellW / 2, c.y + cellImgH + 10, { align: 'center', maxWidth: cellW });
        }
      });
      c.y += cellTotalH;
    }
  }

  // ---- Page numbers ----
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    doc.text(
      `${project.name || 'Project Cost Estimate'}  ·  Page ${i} of ${totalPages}`,
      PDF_PAGE_W / 2, PDF_PAGE_H - 28, { align: 'center' }
    );
    // Bottom rule
    doc.setDrawColor(...PDF_LINE);
    doc.setLineWidth(0.5);
    doc.line(PDF_MARGIN, PDF_PAGE_H - 36, PDF_PAGE_W - PDF_MARGIN, PDF_PAGE_H - 36);
  }

  return doc;
}

async function addAttachmentPlaceholderPage(pdfLibDoc, file, embedFailed) {
  const page = pdfLibDoc.addPage([PDF_PAGE_W, PDF_PAGE_H]);
  const fontBold = await pdfLibDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const fontReg = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  page.drawText(embedFailed ? 'Attached file (could not be embedded)' : 'Attached file', {
    x: PDF_MARGIN, y: PDF_PAGE_H - 90, size: 14, font: fontBold, color: PDFLib.rgb(0.08, 0.08, 0.08)
  });
  page.drawText(file.fileName || 'Untitled file', {
    x: PDF_MARGIN, y: PDF_PAGE_H - 112, size: 12, font: fontReg, color: PDFLib.rgb(0.2, 0.2, 0.2)
  });
  if (file.caption) {
    page.drawText(file.caption, { x: PDF_MARGIN, y: PDF_PAGE_H - 130, size: 10, font: fontReg, color: PDFLib.rgb(0.43, 0.41, 0.36) });
  }
  page.drawText('This file type can\'t be displayed inline in the PDF. Use "Open" in the app, or an exported JSON backup, to view its original content.', {
    x: PDF_MARGIN, y: PDF_PAGE_H - 156, size: 10, font: fontReg, color: PDFLib.rgb(0.43, 0.41, 0.36),
    maxWidth: PDF_CONTENT_W, lineHeight: 14
  });
}

// Main entry point: builds the report, merges in any real attached PDFs as
// extra pages, and triggers a download of the final single .pdf file.
async function exportProjectPdf(project) {
  const reportDoc = await buildProjectReportPdf(project);
  const reportBytes = reportDoc.output('arraybuffer');

  const documents = project.photos.filter(ph => !isImageAttachment(ph));
  const safeName = (project.name || 'project').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_');
  const filename = `PCE_${safeName || 'project'}.pdf`;

  if (!documents.length || typeof PDFLib === 'undefined') {
    // Always go through pdfDownloadBlob — jsPDF's .save() uses data: URLs
    // internally which Chrome blocks for PDFs (shows raw binary instead).
    pdfDownloadBlob(reportDoc.output('blob'), filename);
    return;
  }

  let merged;
  try {
    merged = await PDFLib.PDFDocument.load(reportBytes);
  } catch (e) {
    console.warn('pdf-lib could not load the generated report; downloading it without attachments merged.', e);
    pdfDownloadBlob(new Blob([reportBytes], { type: 'application/pdf' }), filename);
    return;
  }

  for (const file of documents) {
    try {
      if ((file.mimeType || '').indexOf('pdf') !== -1) {
        const bytes = pdfDataUrlToBytes(file.dataUrl);
        const attachmentDoc = await PDFLib.PDFDocument.load(bytes);
        const copiedPages = await merged.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
        copiedPages.forEach(p => merged.addPage(p));
      } else {
        await addAttachmentPlaceholderPage(merged, file, false);
      }
    } catch (e) {
      console.warn('Could not embed attachment "' + (file.fileName || '') + '":', e);
      try { await addAttachmentPlaceholderPage(merged, file, true); } catch (e2) { /* give up on this one file */ }
    }
  }

  const finalBytes = await merged.save();
  pdfDownloadBlob(new Blob([finalBytes], { type: 'application/pdf' }), filename);
}
