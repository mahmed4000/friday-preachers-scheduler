/**
 * كاتب PDF صغير من غير مكتبات: كل صفحة صورة JPEG مرسومة على canvas.
 * الرسم على canvas بيظبط الحروف العربي تلقائيًا (التشكيل والوصل واتجاه الكتابة)،
 * وده اللي مكتبات الـ PDF العادية بتغلط فيه.
 */

const enc = new TextEncoder();

function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A4 بالنقط */
const PAGE_W = 595.28;
const PAGE_H = 841.89;

export function canvasesToPdf(pages: HTMLCanvasElement[], title = ''): Blob {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(bytes);
    size += bytes.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = size;
    push(`${n} 0 obj\n`);
    body();
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  // 1: catalog, 2: pages, 3: info, ثم لكل صفحة: page + image + content
  const first = 4;
  const kids = pages.map((_, i) => `${first + i * 3} 0 R`).join(' ');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
  // العنوان بترميز UTF-16BE علشان يظهر عربي في قارئ الـ PDF
  const titleHex = Array.from(title)
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (c > 0xffff) return '003F';
      return c.toString(16).padStart(4, '0').toUpperCase();
    })
    .join('');
  obj(3, () => push(`<< /Title <FEFF${titleHex}> /Producer (friday-preachers-scheduler) >>`));

  pages.forEach((canvas, i) => {
    const pageN = first + i * 3;
    const imgN = pageN + 1;
    const contentN = pageN + 2;
    const jpeg = dataUrlBytes(canvas.toDataURL('image/jpeg', 0.9));
    const h = (PAGE_W * canvas.height) / canvas.width;
    const pageH = Math.max(h, 1);
    obj(pageN, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${pageH.toFixed(2)}] /Resources << /XObject << /Im0 ${imgN} 0 R >> >> /Contents ${contentN} 0 R >>`)
    );
    obj(imgN, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream');
    });
    const content = `q ${PAGE_W} 0 0 ${pageH.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(contentN, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });

  const total = first + pages.length * 3;
  const xref = size;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export { PAGE_W, PAGE_H };
