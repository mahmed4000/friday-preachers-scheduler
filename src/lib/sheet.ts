/**
 * رسم ورقة جدول (A4) بهوية الجمعية: بني وذهبي بطراز إسلامي.
 * بتترسم على canvas وبعدين بتتحول PDF من lib/pdf.ts
 */
import { canvasesToPdf } from './pdf.ts';

const C = {
  ink: '#2b1d12',
  muted: '#7a6650',
  parchment: '#f7f0e3',
  paper: '#fffcf6',
  sand: '#e9dcc3',
  b950: '#1f130a',
  b900: '#2f1d10',
  b800: '#452a16',
  b700: '#63401f',
  b100: '#f1e6d6',
  g200: '#f3e5bf',
  g300: '#e8cf8f',
  g400: '#d8b45f',
  g500: '#c39a3c',
  g600: '#9f7a25',
};

const DISPLAY = "'Noto Kufi Arabic Variable', 'IBM Plex Sans Arabic', sans-serif";
const SANS = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, 'Noto Sans Arabic', sans-serif";

export type SheetColumn = { label: string; width: number; strong?: boolean; ltr?: boolean };

export type SheetInput = {
  orgName: string;
  branchName?: string;
  /** مثال: جدول خطب الجمعة */
  kicker: string;
  /** مثال: جمادى الآخرة 1448 هـ */
  monthTitle: string;
  /** مثال: فضيلة الشيخ أحمد السيد */
  name: string;
  /** سطر صغير تحت الاسم */
  subtitle?: string;
  columns: SheetColumn[];
  rows: string[][];
  /** سطور في صندوق الملاحظات تحت الجدول */
  notes?: string[];
  /** رسالة الختام */
  closing?: string;
};

const W = 1240;
const H = 1754;

let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  logoPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/aljameya-logo.png';
  });
  return logoPromise;
}

async function ensureFonts() {
  if (!('fonts' in document)) return;
  await Promise.race([
    Promise.all([
      document.fonts.load(`700 40px ${DISPLAY}`, 'جمعة'),
      document.fonts.load(`400 24px ${SANS}`, 'جمعة'),
      document.fonts.load(`600 24px ${SANS}`, 'جمعة'),
    ]).catch(() => undefined),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.62;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function starPattern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const step = 84;
  for (let yy = y - step; yy < y + h + step; yy += step) {
    for (let xx = x - step; xx < x + w + step; xx += step) {
      const off = (Math.round((yy - y) / step) % 2) * (step / 2);
      star(ctx, xx + off, yy, 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(xx + off, yy, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** يكتب النص ويصغّر الخط لو مش داخل في العرض */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, weight: string, size: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 12 && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

function ornament(ctx: CanvasRenderingContext2D, cx: number, y: number, half: number) {
  const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
  g.addColorStop(0, 'rgba(195,154,60,0)');
  g.addColorStop(0.5, C.g500);
  g.addColorStop(1, 'rgba(195,154,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - half, y - 1, half * 2, 2);
  ctx.fillStyle = C.g500;
  star(ctx, cx, y, 11);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.beginPath();
  ctx.arc(cx, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function drawSheet(input: SheetInput): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const logo = await loadLogo();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  // الخلفية والإطار
  ctx.fillStyle = C.parchment;
  ctx.fillRect(0, 0, W, H);
  starPattern(ctx, 0, 0, W, H, C.g500, 0.05);
  const M = 44;
  ctx.fillStyle = C.paper;
  ctx.fillRect(M, M, W - M * 2, H - M * 2);
  ctx.strokeStyle = C.g500;
  ctx.lineWidth = 3;
  ctx.strokeRect(M, M, W - M * 2, H - M * 2);
  ctx.strokeStyle = C.g300;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(M + 10, M + 10, W - (M + 10) * 2, H - (M + 10) * 2);
  for (const [x, y] of [[M, M], [W - M, M], [M, H - M], [W - M, H - M]]) {
    ctx.fillStyle = C.g500;
    star(ctx, x, y, 16);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // الهيدر البني
  const hx = M + 10;
  const hw = W - hx * 2;
  const hy = M + 10;
  const hh = 340;
  ctx.fillStyle = C.b900;
  ctx.fillRect(hx, hy, hw, hh);
  starPattern(ctx, hx, hy, hw, hh, C.g400, 0.11);
  const gl = ctx.createLinearGradient(hx, 0, hx + hw, 0);
  gl.addColorStop(0, C.g600);
  gl.addColorStop(0.5, C.g300);
  gl.addColorStop(1, C.g600);
  ctx.fillStyle = gl;
  ctx.fillRect(hx, hy + hh, hw, 6);

  const cx = W / 2;
  // الشعار
  const lr = 62;
  const ly = hy + 92;
  ctx.fillStyle = C.paper;
  ctx.beginPath();
  ctx.arc(cx, ly, lr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.g500;
  ctx.lineWidth = 4;
  ctx.stroke();
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, ly, lr - 7, 0, Math.PI * 2);
    ctx.clip();
    const s = (lr - 7) * 2;
    ctx.drawImage(logo, cx - s / 2, ly - s / 2, s, s);
    ctx.restore();
  } else {
    ctx.fillStyle = C.g500;
    star(ctx, cx, ly, 34);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = C.g300;
  fitText(ctx, input.orgName + (input.branchName ? ` · ${input.branchName}` : ''), cx, hy + 184, hw - 80, '600', 27, SANS);
  ctx.fillStyle = C.g200;
  fitText(ctx, input.kicker, cx, hy + 240, hw - 80, '700', 58, DISPLAY);
  ctx.fillStyle = C.g400;
  fitText(ctx, input.monthTitle, cx, hy + 302, hw - 80, '700', 38, DISPLAY);

  // الاسم
  let y = hy + hh + 92;
  ctx.fillStyle = C.b900;
  fitText(ctx, input.name, cx, y, hw - 120, '700', 60, DISPLAY);
  y += 52;
  if (input.subtitle) {
    ctx.fillStyle = C.muted;
    fitText(ctx, input.subtitle, cx, y, hw - 120, '400', 26, SANS);
    y += 46;
  }
  ornament(ctx, cx, y, 220);
  y += 50;

  // الجدول
  const tx = hx + 40;
  const tw = hw - 80;
  const totalW = input.columns.reduce((s, c) => s + c.width, 0);
  const widths = input.columns.map((c) => (c.width / totalW) * tw);
  const headH = 76;
  const rowH = input.rows.length > 6 ? 82 : 104;
  const tableH = headH + rowH * Math.max(input.rows.length, 1);

  ctx.save();
  roundRect(ctx, tx, y, tw, tableH, 18);
  ctx.clip();
  ctx.fillStyle = C.paper;
  ctx.fillRect(tx, y, tw, tableH);
  ctx.fillStyle = C.b800;
  ctx.fillRect(tx, y, tw, headH);

  // رأس الجدول (من اليمين للشمال)
  let colRight = tx + tw;
  ctx.textAlign = 'right';
  input.columns.forEach((c, i) => {
    ctx.fillStyle = C.g200;
    fitText(ctx, c.label, colRight - 26, y + headH / 2, widths[i] - 40, '700', 28, SANS);
    colRight -= widths[i];
  });

  // الصفوف
  input.rows.forEach((row, r) => {
    const ry = y + headH + r * rowH;
    ctx.fillStyle = r % 2 ? C.b100 : C.paper;
    ctx.fillRect(tx, ry, tw, rowH);
    let right = tx + tw;
    row.forEach((cell, i) => {
      const col = input.columns[i];
      const strong = col?.strong;
      ctx.fillStyle = strong ? C.b900 : C.ink;
      if (col?.ltr) {
        ctx.save();
        ctx.direction = 'ltr';
        ctx.textAlign = 'right';
        fitText(ctx, cell, right - 26, ry + rowH / 2, widths[i] - 40, '500', 27, SANS);
        ctx.restore();
      } else {
        fitText(ctx, cell, right - 26, ry + rowH / 2, widths[i] - 40, strong ? '700' : '500', strong ? 36 : 28, strong ? DISPLAY : SANS);
      }
      right -= widths[i];
    });
    if (r > 0) {
      ctx.fillStyle = C.sand;
      ctx.fillRect(tx, ry, tw, 1.5);
    }
  });
  if (!input.rows.length) {
    ctx.textAlign = 'center';
    ctx.fillStyle = C.muted;
    fitText(ctx, 'مفيش جمعات في الشهر ده', cx, y + headH + rowH / 2, tw - 40, '500', 28, SANS);
  }
  // فواصل الأعمدة
  let sep = tx + tw;
  widths.slice(0, -1).forEach((w) => {
    sep -= w;
    ctx.fillStyle = 'rgba(214,195,160,0.6)';
    ctx.fillRect(sep, y + headH, 1.5, tableH - headH);
  });
  ctx.restore();
  ctx.strokeStyle = C.g400;
  ctx.lineWidth = 2.5;
  roundRect(ctx, tx, y, tw, tableH, 18);
  ctx.stroke();
  y += tableH + 50;

  // الملاحظات
  if (input.notes?.length) {
    const lineH = 46;
    const boxH = 40 + input.notes.length * lineH;
    ctx.fillStyle = 'rgba(243,229,191,0.45)';
    roundRect(ctx, tx, y, tw, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = C.g300;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.g500;
    ctx.fillRect(tx + tw - 8, y + 18, 5, boxH - 36);
    ctx.textAlign = 'right';
    input.notes.forEach((n, i) => {
      const ly2 = y + 20 + lineH * i + lineH / 2;
      if (/^https?:\/\//.test(n)) {
        ctx.save();
        ctx.direction = 'ltr';
        ctx.textAlign = 'right';
        ctx.fillStyle = C.g600;
        fitText(ctx, n, tx + tw - 34, ly2, tw - 70, '600', 24, SANS);
        ctx.restore();
        return;
      }
      ctx.fillStyle = C.b800;
      fitText(ctx, n, tx + tw - 34, ly2, tw - 70, '500', 25, SANS);
    });
    y += boxH + 40;
  }

  // الختام والتذييل
  ctx.textAlign = 'center';
  const footY = H - M - 10 - 60;
  if (input.closing) {
    ctx.fillStyle = C.b700;
    fitText(ctx, input.closing, cx, Math.min(y + 40, footY - 70), tw, '700', 38, DISPLAY);
  }
  ctx.fillStyle = C.b900;
  ctx.fillRect(hx, footY, hw, 60);
  ctx.fillStyle = gl;
  ctx.fillRect(hx, footY, hw, 4);
  ctx.fillStyle = C.g300;
  fitText(ctx, `${input.orgName} · جدول خطباء الجمعة`, cx, footY + 32, hw - 60, '500', 22, SANS);

  return canvas;
}

export async function sheetPdf(input: SheetInput): Promise<Blob> {
  const canvas = await drawSheet(input);
  return canvasesToPdf([canvas], `${input.name} - ${input.monthTitle}`);
}
