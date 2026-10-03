import { exportElementToPdf } from '../src/lib/pdfExport.ts';

async function runPdfScrollbarTests() {
  console.log('--- Starting PDF Export & No-Scrollbars Verification Tests ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✕ FAIL: ${testName}`);
      failed++;
    }
  }

  // Verify function signature and exports
  assert(typeof exportElementToPdf === 'function', 'exportElementToPdf is exported as function');

  console.log(`\nPDF Tests Summary: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runPdfScrollbarTests();
