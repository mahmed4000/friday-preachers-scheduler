import assert from 'node:assert';
import { downloadPrintableHtml, triggerPrintWindow } from '../src/lib/pdfExport.ts';

console.log('--- بدء اختبارات استقرار مكوّن المستند الرسمي والطباعة A4 (Official A4 Document & Print Tests) ---');

// 1. Test HTML generation in downloadPrintableHtml
{
  // Mock element
  const mockElement = {
    outerHTML: '<div class="pdf-report-document" id="test-doc"><h1>جدول خطباء الجمعة</h1><table><tr><td>مسجد</td></tr></table></div>',
  } as unknown as HTMLElement;

  let capturedBlobContent = '';
  let capturedFileName = '';

  // Mock global browser APIs if running in Node environment
  const originalBlob = globalThis.Blob;
  const originalURL = globalThis.URL;
  const originalDocument = globalThis.document;

  globalThis.Blob = class MockBlob {
    content: string[];
    options: any;
    constructor(content: string[], options: any) {
      this.content = content;
      this.options = options;
      capturedBlobContent = content.join('');
    }
  } as any;

  globalThis.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {},
  } as any;

  const mockAppendChild = () => {};
  const mockRemoveChild = () => {};
  const mockClick = () => {};

  globalThis.document = {
    createElement: (tag: string) => {
      const el: any = {
        href: '',
        download: '',
        click: () => {
          capturedFileName = el.download;
        },
      };
      return el;
    },
    body: {
      appendChild: mockAppendChild,
      removeChild: mockRemoveChild,
    },
    querySelectorAll: () => [],
  } as any;

  try {
    downloadPrintableHtml(mockElement, 'جدول شهر رمضان 1448', 'schedule_ramadan', 'landscape');

    assert.ok(capturedBlobContent.includes('<!DOCTYPE html>'), 'Generated content must be valid HTML5');
    assert.ok(capturedBlobContent.includes('dir="rtl"'), 'HTML must set RTL direction');
    assert.ok(capturedBlobContent.includes('IBM Plex Sans Arabic'), 'HTML must include Arabic font definitions');
    assert.ok(capturedBlobContent.includes('A4 landscape'), 'HTML must specify A4 landscape page size');
    assert.ok(capturedBlobContent.includes('break-inside: avoid'), 'HTML must contain page break avoid rules');
    assert.ok(capturedBlobContent.includes('print-logo-box'), 'HTML must include strict logo bounding rules');
    assert.ok(capturedFileName.endsWith('schedule_ramadan.html'), 'Filename must end with .html');

    console.log('✅ [PASS] 1. downloadPrintableHtml ينشئ مستند HTML سليم بهندسة A4 landscape وخطوط عربية وقواعد منع انشطار الجداول');
  } finally {
    globalThis.Blob = originalBlob;
    globalThis.URL = originalURL;
    globalThis.document = originalDocument;
  }
}

// 2. Test Portrait Orientation in downloadPrintableHtml
{
  const mockElement = {
    outerHTML: '<div class="pdf-report-document"><h1>تكليف خطيب</h1></div>',
  } as unknown as HTMLElement;

  let capturedBlobContent = '';

  const originalBlob = globalThis.Blob;
  const originalURL = globalThis.URL;
  const originalDocument = globalThis.document;

  globalThis.Blob = class MockBlob {
    content: string[] = [];
    constructor(content: string[]) {
      this.content = content;
      capturedBlobContent = content.join('');
    }
  } as any;

  globalThis.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {},
  } as any;

  globalThis.document = {
    createElement: () => ({
      href: '',
      download: '',
      click: () => {},
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    querySelectorAll: () => [],
  } as any;

  try {
    downloadPrintableHtml(mockElement, 'تكليف خطيب', 'imam_assignment', 'portrait');

    assert.ok(capturedBlobContent.includes('A4 portrait'), 'HTML must specify A4 portrait page size');
    console.log('✅ [PASS] 2. downloadPrintableHtml يدعم النمط الرأسي A4 portrait بنجاح للتكليفات الفردية');
  } finally {
    globalThis.Blob = originalBlob;
    globalThis.URL = originalURL;
    globalThis.document = originalDocument;
  }
}

// 3. Test triggerPrintWindow safe fallback in non-browser / blocked environments
{
  const mockElement = {
    outerHTML: '<div>Print content</div>',
  } as unknown as HTMLElement;

  const originalWindow = globalThis.window;

  // Window with window.open returning null (popup blocked)
  globalThis.window = {
    open: () => null,
  } as any;

  const result = triggerPrintWindow(mockElement, 'تقرير طباعة', 'landscape');
  assert.strictEqual(result, false, 'triggerPrintWindow must return false when popup is blocked');
  console.log('✅ [PASS] 3. triggerPrintWindow يتعامل بأمان ويرجع false عند حظر النوافذ المنبثقة');

  globalThis.window = originalWindow;
}

// 4. Test triggerPrintWindow success writing document
{
  const mockElement = {
    outerHTML: '<div class="official-doc">محتوى رسمي معتمد</div>',
  } as unknown as HTMLElement;

  let writtenContent = '';
  let closed = false;

  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  globalThis.document = {
    querySelectorAll: () => [],
  } as any;

  globalThis.window = {
    open: () => ({
      document: {
        write: (str: string) => {
          writtenContent += str;
        },
        close: () => {
          closed = true;
        },
      },
    }),
  } as any;

  const result = triggerPrintWindow(mockElement, 'كشف رسمي', 'landscape');
  assert.strictEqual(result, true, 'triggerPrintWindow must return true on successful window write');
  assert.strictEqual(closed, true, 'Document must be closed after writing');
  assert.ok(writtenContent.includes('IBM Plex Sans Arabic'), 'Print window must inject Arabic fonts');
  assert.ok(writtenContent.includes('A4 landscape'), 'Print window must set A4 landscape');
  assert.ok(!writtenContent.includes('cdn.tailwindcss.com'), 'Print window must not rely on external CDN script');

  console.log('✅ [PASS] 4. triggerPrintWindow يكتب مستنداً ذاتي الاكتفاء بدون اعتمادية على CDN خارجي');

  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
}

console.log('--- اكتملت جميع اختبارات استقرار الطباعة والمستندات الرسمية بنجاح 4/4 ---');
