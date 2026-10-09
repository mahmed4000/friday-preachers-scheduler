import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface PdfExportOptions {
  fileName: string;
  orientation?: 'portrait' | 'landscape';
  singlePage?: boolean;
}

interface StyleBackup {
  node: HTMLElement;
  overflow: string;
  overflowX: string;
  overflowY: string;
  maxHeight: string;
  position: string;
}

/**
 * Direct PDF Generator using html-to-image & jsPDF.
 * html-to-image uses browser-native SVG foreignObject rendering.
 *
 * This function guarantees ZERO scrollbars in the PDF by temporarily
 * expanding all scroll containers, clearing overflow bounds, and un-sticking headers.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions
): Promise<void> {
  const { fileName, orientation = 'portrait' } = options;

  // 1. Prepare DOM Element for PDF Snapshot: strip scrollbars, expand heights, un-stick headers
  const backups: StyleBackup[] = [];
  const allNodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];

  // Apply root PDF export mode class
  document.documentElement.classList.add('pdf-export-active');
  element.classList.add('pdf-export-active');

  for (const node of allNodes) {
    const computed = window.getComputedStyle(node);
    const overflow = computed.overflow;
    const overflowX = computed.overflowX;
    const overflowY = computed.overflowY;
    const maxHeight = computed.maxHeight;
    const position = computed.position;

    const needsReset =
      (overflow !== 'visible' && overflow !== 'clip') ||
      (overflowX !== 'visible' && overflowX !== 'clip') ||
      (overflowY !== 'visible' && overflowY !== 'clip') ||
      maxHeight !== 'none' ||
      position === 'sticky' ||
      position === 'fixed';

    if (needsReset) {
      backups.push({
        node,
        overflow: node.style.overflow,
        overflowX: node.style.overflowX,
        overflowY: node.style.overflowY,
        maxHeight: node.style.maxHeight,
        position: node.style.position,
      });

      node.style.setProperty('overflow', 'visible', 'important');
      node.style.setProperty('overflow-x', 'visible', 'important');
      node.style.setProperty('overflow-y', 'visible', 'important');
      if (maxHeight !== 'none') {
        node.style.setProperty('max-height', 'none', 'important');
      }
      if (position === 'sticky' || position === 'fixed') {
        node.style.setProperty('position', 'static', 'important');
      }
    }
  }

  // Measure true content dimensions based on full unconstrained layout
  const minWidth = orientation === 'landscape' ? 1060 : 794;
  const contentWidth = Math.max(element.scrollWidth, element.offsetWidth, minWidth);
  const contentHeight = Math.max(element.scrollHeight, element.offsetHeight);

  let dataUrl: string;

  try {
    try {
      dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
        skipFonts: true,
        fontEmbedCSS: '',
        width: contentWidth,
        height: contentHeight,
        style: {
          overflow: 'visible',
          overflowX: 'visible',
          overflowY: 'visible',
          maxHeight: 'none',
          height: 'auto',
          width: `${contentWidth}px`,
          margin: '0',
        },
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('no-print')) {
            return false;
          }
          return true;
        },
      });
    } catch (initialError: any) {
      console.warn('toPng high-res failed, retrying with fallback ratio...', initialError);
      dataUrl = await toPng(element, {
        pixelRatio: 1.5,
        backgroundColor: '#ffffff',
        skipFonts: true,
        fontEmbedCSS: '',
        width: contentWidth,
        height: contentHeight,
        style: {
          overflow: 'visible',
          overflowX: 'visible',
          overflowY: 'visible',
          maxHeight: 'none',
          height: 'auto',
          width: `${contentWidth}px`,
          margin: '0',
        },
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('no-print')) {
            return false;
          }
          return true;
        },
      });
    }
  } finally {
    // 2. Restore all original styles & remove PDF export active class
    document.documentElement.classList.remove('pdf-export-active');
    element.classList.remove('pdf-export-active');

    for (const backup of backups) {
      backup.node.style.overflow = backup.overflow;
      backup.node.style.overflowX = backup.overflowX;
      backup.node.style.overflowY = backup.overflowY;
      backup.node.style.maxHeight = backup.maxHeight;
      backup.node.style.position = backup.position;
    }
  }

  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    throw new Error('فشل توليد صورة المعاينة لملف الـ PDF');
  }

  // Load image to calculate dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('فشل قراءة بيانات صورة الـ PDF'));
    img.src = dataUrl;
  });

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;

  const margin = orientation === 'landscape' ? 6 : 8;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;

  const rawImgWidth = printableWidth;
  const rawImgHeight = (img.height * printableWidth) / img.width;

  // Single-page enforcement:
  // If explicitly requested, or if the document is a single card (like mosque/imam card) or close to 1 page (within 25%):
  const isSinglePageMode =
    options.singlePage === true ||
    (options.singlePage !== false && (
      rawImgHeight <= printableHeight * 1.25 ||
      element.id === 'mosque-schedule-document' ||
      element.id === 'imam-schedule-document' ||
      element.classList.contains('pdf-report-document') ||
      element.classList.contains('pdf-page-item')
    ));

  if (isSinglePageMode || rawImgHeight <= printableHeight) {
    // Proportional fit strictly into exactly ONE single page - Zero spillover!
    const scale = Math.min(1, printableHeight / rawImgHeight);
    const finalWidth = rawImgWidth * scale;
    const finalHeight = rawImgHeight * scale;
    const x = margin + (printableWidth - finalWidth) / 2;
    const y = margin + (printableHeight - finalHeight) / 2;
    pdf.addImage(dataUrl, 'PNG', x, y, finalWidth, finalHeight);
  } else {
    // Multi-page document for genuine long tables
    let heightLeft = rawImgHeight;
    let position = margin;
    let pageNumber = 1;

    pdf.addImage(dataUrl, 'PNG', margin, position, rawImgWidth, rawImgHeight);
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      position = margin - pageNumber * printableHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', margin, position, rawImgWidth, rawImgHeight);
      heightLeft -= printableHeight;
      pageNumber++;
    }
  }

  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  pdf.save(cleanFileName);
}

/**
 * Downloads a standalone, styled HTML report that can be opened in any browser
 * and printed or saved as PDF directly via native browser print.
 */
export function downloadPrintableHtml(
  element: HTMLElement,
  title: string,
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): void {
  const headStyles = typeof document !== 'undefined'
    ? Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((el) => el.outerHTML)
        .join('\n')
    : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Tajawal:wght@500;700;800&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  ${headStyles}
  <style>
    * { box-sizing: border-box; }
    html, body {
      font-family: 'IBM Plex Sans Arabic', 'Tajawal', system-ui, sans-serif;
      direction: rtl;
      margin: 0;
      padding: 5mm;
      color: #0f172a;
      background: white;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
    }
    @page { size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; margin: 8mm; }
    .no-print { display: none !important; }
    .pdf-report-document,
    .pdf-table-container,
    .scroll-container,
    .table-scroll-container,
    .overflow-auto,
    .overflow-x-auto,
    .overflow-y-auto,
    .overflow-scroll {
      overflow: visible !important;
      overflow-x: visible !important;
      overflow-y: visible !important;
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      width: 100% !important;
    }
    .print-logo-box,
    .print-logo-box div,
    [class*="print-logo-box"] {
      width: 60px !important;
      height: 60px !important;
      max-width: 60px !important;
      max-height: 60px !important;
      min-width: 60px !important;
      min-height: 60px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 auto 6px auto !important;
      border-radius: 9999px !important;
      overflow: hidden !important;
    }
    .print-logo-box img,
    .print-logo-img {
      width: 56px !important;
      height: 56px !important;
      max-width: 56px !important;
      max-height: 56px !important;
      min-width: 56px !important;
      min-height: 56px !important;
      object-fit: contain !important;
      border-radius: 9999px !important;
      display: block !important;
    }
    .sticky, [class*="sticky"] { position: static !important; }
    ::-webkit-scrollbar, *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      background: transparent !important;
    }
    table, .pdf-table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    tr, .pdf-table tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    thead, .pdf-table thead {
      display: table-header-group !important;
    }
    @media print {
      body { padding: 0; background: white; }
    }
  </style>
</head>
<body>
  ${element.outerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Standalone popup window print helper that triggers native print dialog
 * outside parent iframe sandboxes.
 */
export function triggerPrintWindow(
  element: HTMLElement,
  title: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): boolean {
  try {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      console.warn('Popup blocked, window.open returned null');
      return false;
    }

    const headStyles = typeof document !== 'undefined'
      ? Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
          .map((el) => el.outerHTML)
          .join('\n')
      : '';

    printWin.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Tajawal:wght@500;700;800&family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  ${headStyles}
  <style>
    * { box-sizing: border-box; }
    html, body {
      font-family: 'IBM Plex Sans Arabic', 'Cairo', 'Tajawal', system-ui, sans-serif;
      direction: rtl;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: white;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
    }
    @page {
      size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
      margin: 6mm 4mm;
    }
    .no-print { display: none !important; }
    
    /* Strict logo constraint in print mode */
    .print-logo-box,
    .print-logo-box div,
    [class*="print-logo-box"] {
      width: 60px !important;
      height: 60px !important;
      max-width: 60px !important;
      max-height: 60px !important;
      min-width: 60px !important;
      min-height: 60px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 auto 6px auto !important;
      border-radius: 9999px !important;
      overflow: hidden !important;
    }
    .print-logo-box img,
    .print-logo-img {
      width: 56px !important;
      height: 56px !important;
      max-width: 56px !important;
      max-height: 56px !important;
      min-width: 56px !important;
      min-height: 56px !important;
      object-fit: contain !important;
      border-radius: 9999px !important;
      display: block !important;
    }

    .pdf-report-document {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 2mm 0 !important;
      background: white !important;
      border: none !important;
      box-shadow: none !important;
    }

    .pdf-table-container,
    .scroll-container,
    .table-scroll-container,
    .overflow-auto,
    .overflow-x-auto,
    .overflow-y-auto,
    .overflow-scroll {
      overflow: visible !important;
      overflow-x: visible !important;
      overflow-y: visible !important;
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      width: 100% !important;
    }
    .sticky, [class*="sticky"] { position: static !important; }
    ::-webkit-scrollbar, *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      background: transparent !important;
    }
    table, .pdf-table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 11px !important;
    }
    th, td {
      border: 1px solid #94a3b8 !important;
      padding: 4px 6px !important;
    }
    th {
      background-color: #064e3b !important;
      color: white !important;
      font-weight: 700 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    tr, .pdf-table tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    thead, .pdf-table thead {
      display: table-header-group !important;
    }
    @media print {
      body { padding: 0; background: white; }
    }
  </style>
</head>
<body>
  <div>${element.outerHTML}</div>
  <script>
    setTimeout(function() {
      window.focus();
      window.print();
    }, 600);
  </script>
</body>
</html>`);
    printWin.document.close();
    return true;
  } catch (err) {
    console.warn('Print popup failed:', err);
    return false;
  }
}
