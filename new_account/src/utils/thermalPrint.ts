/**
 * Thermal receipt renderer + ESC/POS printer bridge.
 *
 * Renders the receipt onto an offscreen HTML Canvas at 576 px wide
 * (the printable dot width of the Epson TM-T82 at 203 DPI), converts
 * the canvas bitmap to a base64 PNG, then calls the Rust Tauri command
 * `print_receipt_escpos` which builds the GS v 0 raster ESC/POS stream
 * and sends it directly to the named Windows printer.
 *
 * KEY: ctx.textBaseline is set to 'top' so that y always means the TOP
 * of the text — this prevents overlapping caused by baseline vs top confusion.
 */

const W   = 576;        // printable dots at 203 DPI for 80 mm
const PAD = 16;         // left/right padding
const CW  = W - PAD * 2;

// Font stack covering Sinhala + Latin on Windows
const F = '"Nirmala UI", "Noto Sans Sinhala", "Iskoola Pota", Arial, sans-serif';

const LH   = 32;  // normal line height (px)
const LH_S = 26;  // small line height

function font(size: number, bold = false) {
  return `${bold ? 'bold ' : ''}${size}px ${F}`;
}

export interface ThermalReceiptData {
  storeName: string;
  storeNameSinhala?: string;
  address?: string;
  phone?: string;
  datetime: string;
  transNo: string | number;
  cashierName?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
  }>;
  total: number;
  subtotal: number;
  payments?: Array<{ method: string; amount: number }>;
  cashReceived?: number;
  customerName?: string;
  logoSrc?: string;
  autoCut?: boolean;
  printerName?: string;
}

async function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function setupCtx(ctx: CanvasRenderingContext2D) {
  ctx.textBaseline = 'top';   // y = TOP of text, not baseline
  ctx.fillStyle    = '#000';
  ctx.strokeStyle  = '#000';
}

/** Dashed divider, returns next y */
function divider(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 4);
  ctx.lineTo(W - PAD, y + 4);
  ctx.stroke();
  ctx.restore();
  return y + 14;
}

/** Single line of text, returns next y */
function txt(
  ctx: CanvasRenderingContext2D,
  str: string,
  y: number,
  fnt: string,
  align: CanvasTextAlign = 'left',
  lh = LH,
  maxW = CW,
): number {
  ctx.font      = fnt;
  ctx.textAlign = align;
  ctx.fillStyle = '#000';
  const x = align === 'center' ? W / 2 : align === 'right' ? W - PAD : PAD;
  ctx.fillText(str, x, y, maxW);
  return y + lh;
}

/** Two-column row: label left, value right, returns next y */
function row(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
  fnt: string,
  lh = LH,
): number {
  ctx.font      = fnt;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.fillText(label, PAD, y, CW * 0.65);
  ctx.textAlign = 'right';
  ctx.fillText(value, W - PAD, y, CW * 0.45);
  return y + lh;
}

/** Word-wrapped text, returns next y */
function wrap(
  ctx: CanvasRenderingContext2D,
  str: string,
  y: number,
  fnt: string,
  maxW = CW,
  lh = LH,
): number {
  ctx.font      = fnt;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
  const words = str.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, PAD, y, maxW);
      y += lh;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, PAD, y, maxW); y += lh; }
  return y;
}

export async function renderReceiptCanvas(data: ThermalReceiptData): Promise<HTMLCanvasElement> {
  const tmp    = document.createElement('canvas');
  tmp.width    = W;
  tmp.height   = 6000;
  const ctx    = tmp.getContext('2d')!;

  // White background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, 6000);

  // Always use 'top' baseline so y = top of text
  setupCtx(ctx);

  let y = PAD;

  // ── Logo ──────────────────────────────────────────────────────────
  const logo = data.logoSrc ? await loadImg(data.logoSrc) : null;
  if (logo) {
    const maxW = 180, maxH = 80;
    const r  = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width * r, lh = logo.height * r;
    ctx.drawImage(logo, (W - lw) / 2, y, lw, lh);
    y += lh + 10;
  }

  // ── Header ────────────────────────────────────────────────────────
  y = txt(ctx, data.storeName.toUpperCase(), y, font(26, true), 'center', 36);
  if (data.storeNameSinhala)
    y = txt(ctx, data.storeNameSinhala, y, font(22), 'center', 30);
  if (data.address)
    y = txt(ctx, data.address.toUpperCase(), y, font(18), 'center', LH_S);
  if (data.phone)
    y = txt(ctx, data.phone, y, font(18), 'center', LH_S);
  y = txt(ctx, data.datetime, y, font(18), 'center', LH_S);

  y += 4;
  y = divider(ctx, y);

  // ── Invoice info ──────────────────────────────────────────────────
  y = txt(ctx, `Invoice ID: ${data.transNo}`, y, font(20));
  if (data.cashierName)
    y = txt(ctx, `Cashier: ${data.cashierName}`, y, font(20));

  y = divider(ctx, y);

  // ── Column headers ────────────────────────────────────────────────
  // Columns: ITEM (left) | DISC | NET | TOTAL (right)
  const C_TOTAL = W - PAD;
  const C_NET   = C_TOTAL - 110;
  const C_DISC  = C_NET   - 90;
  const nameMaxW = C_DISC - PAD - 6;

  ctx.font      = font(20, true);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';  ctx.fillText('ITEM',  PAD,    y);
  ctx.textAlign = 'right'; ctx.fillText('DISC',  C_DISC, y);
  ctx.textAlign = 'right'; ctx.fillText('NET',   C_NET,  y);
  ctx.textAlign = 'right'; ctx.fillText('TOTAL', C_TOTAL,y);
  y += LH;

  y = divider(ctx, y);

  // ── Line items ────────────────────────────────────────────────────
  for (const line of data.lines) {
    const net      = line.unit_price * (1 - line.discount_percent / 100);
    const lineTot  = net * line.quantity;
    const discAmt  = line.unit_price * (line.discount_percent / 100) * line.quantity;

    // Product name (wrapped, bold)
    y = wrap(ctx, line.description, y, font(20, true), nameMaxW, LH);

    // Unit price (small)
    y = txt(ctx, `UNIT PRICE ${line.unit_price.toFixed(2)}`, y, font(17), 'left', LH_S);

    // Qty row with columns
    ctx.font         = font(20);
    ctx.fillStyle    = '#000';
    ctx.textBaseline = 'top';
    ctx.textAlign    = 'left';
    ctx.fillText(`${line.quantity} x`, PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText(discAmt > 0 ? discAmt.toFixed(2) : '-', C_DISC,  y);
    ctx.fillText(net.toFixed(2),                          C_NET,   y);
    ctx.fillText(lineTot.toFixed(2),                      C_TOTAL, y);
    y += LH;

    y = divider(ctx, y);
  }

  // ── Subtotal ──────────────────────────────────────────────────────
  y = row(ctx, 'Subtotal', `LKR ${data.subtotal.toFixed(2)}`, y, font(20));
  y = divider(ctx, y);

  // ── TOTAL (large bold) ────────────────────────────────────────────
  ctx.font         = font(28, true);
  ctx.fillStyle    = '#000';
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';  ctx.fillText('TOTAL',                       PAD,      y);
  ctx.textAlign    = 'right'; ctx.fillText(`LKR ${data.total.toFixed(2)}`, W - PAD, y, CW * 0.55);
  y += 36;
  y = divider(ctx, y);

  // ── Payment info ──────────────────────────────────────────────────
  y = txt(ctx, 'PAYMENT INFO', y, font(20, true));

  if (data.payments && data.payments.length > 0) {
    for (const p of data.payments)
      y = row(ctx, p.method.toUpperCase(), `LKR ${p.amount.toFixed(2)}`, y, font(20));
  } else {
    const received = data.cashReceived ?? data.total;
    const change   = Math.max(0, received - data.total);
    y = row(ctx, 'CASH IN HAND',  `LKR ${data.total.toFixed(2)}`,  y, font(20));
    y = row(ctx, 'CASH RECEIVED', `LKR ${received.toFixed(2)}`,     y, font(20));
    y = row(ctx, 'CHANGE',        `LKR ${change.toFixed(2)}`,       y, font(20));
  }

  y = divider(ctx, y);

  // ── Customer ──────────────────────────────────────────────────────
  if (data.customerName) {
    y = txt(ctx, 'CUSTOMER', y, font(20, true));
    y = txt(ctx, data.customerName.toUpperCase(), y, font(20));
    y = divider(ctx, y);
  }

  // ── Footer ────────────────────────────────────────────────────────
  y += 6;
  y = txt(ctx, 'ස්තුතිෙයි නැවත එන්න!',    y, font(20), 'center', LH);
  y = txt(ctx, 'Developed by DIO Solutions', y, font(17), 'center', LH_S);
  y = txt(ctx, 'dio.lk | 071 461 2954',      y, font(17), 'center', LH_S);
  y += PAD;

  // ── Crop to actual height ─────────────────────────────────────────
  const out = document.createElement('canvas');
  out.width  = W;
  out.height = y;
  const outCtx = out.getContext('2d')!;
  outCtx.fillStyle = '#fff';
  outCtx.fillRect(0, 0, W, y);
  outCtx.drawImage(tmp, 0, 0);
  return out;
}

/**
 * Render receipt to canvas → base64 PNG → Rust ESC/POS command → EPSON TM-T82.
 * Only works inside the Tauri desktop app.
 */
export async function printThermalReceipt(data: ThermalReceiptData): Promise<void> {
  const canvas  = await renderReceiptCanvas(data);
  const base64  = canvas.toDataURL('image/png').split(',')[1];
  const { invoke } = await import('@tauri-apps/api/core');

  await invoke('print_receipt_escpos', {
    printerName: data.printerName || 'EPSON TM-T82 Receipt',
    imageBase64: base64,
    autoCut:     data.autoCut ?? true,
  });
}
