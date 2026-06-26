import QRCode from "qrcode";
import type { jsPDF } from "jspdf";

export const PALETTE = {
  black: "#0B0B0B",
  graphite: "#1A1A1A",
  gold: "#C9A24B",
  goldSoft: "#E2C383",
  white: "#FFFFFF",
  gray: "#9CA3AF",
  grayLight: "#E5E7EB",
  grayDark: "#4B5563",
} as const;

export const A4 = { w: 595.28, h: 841.89 } as const;
export const MARGIN = 40;
export const FOOTER_H = 32;

export const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

/** Hex like #RRGGBB → [r,g,b] */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function setFill(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}
export function setStroke(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}
export function setText(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

/** Loads remote/data image as dataURL. Returns null on failure (CORS, 404, etc.) */
export async function loadImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Detects image format from data URL header for jsPDF.addImage */
export function detectImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

export async function generateQrDataUrl(text: string, opts?: { dark?: string; light?: string; size?: number }) {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: opts?.size ?? 220,
      color: {
        dark: opts?.dark ?? PALETTE.black,
        light: opts?.light ?? PALETTE.white,
      },
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

export function drawSectionTitle(doc: jsPDF, text: string, y: number) {
  setText(doc, PALETTE.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const lines = doc.splitTextToSize(text, A4.w - MARGIN * 2) as string[];
  lines.forEach((ln, i) => doc.text(ln, MARGIN, y + i * 24));
  const afterTitle = y + lines.length * 24;
  setFill(doc, PALETTE.gold);
  doc.rect(MARGIN, afterTitle + 6, 56, 3, "F");
  return afterTitle + 28;
}

export function drawEyebrow(doc: jsPDF, text: string, y: number) {
  setText(doc, PALETTE.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(text.toUpperCase(), MARGIN, y);
  return y + 22;
}

/**
 * Loads an image and makes near-white pixels transparent.
 * Used for logos on dark backgrounds. Returns PNG dataURL.
 * Falls back to plain loadImageAsDataUrl on failure.
 */
export async function loadLogoForDarkBg(
  url: string | null | undefined,
  threshold = 235,
): Promise<string | null> {
  if (!url) return null;
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return loadImageAsDataUrl(url);
  }
  try {
    const dataUrl = await loadImageAsDataUrl(url);
    if (!dataUrl) return null;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r >= threshold && g >= threshold && b >= threshold) {
        d[i + 3] = 0;
      } else if (r >= 200 && g >= 200 && b >= 200) {
        // soft edge: partial transparency
        const avg = (r + g + b) / 3;
        d[i + 3] = Math.max(0, Math.min(255, Math.round((255 - avg) * 8)));
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return loadImageAsDataUrl(url);
  }
}

export function drawParagraph(
  doc: jsPDF,
  text: string,
  y: number,
  opts?: { size?: number; color?: string; lineHeight?: number; maxWidth?: number; x?: number },
) {
  const size = opts?.size ?? 10.5;
  const color = opts?.color ?? PALETTE.grayDark;
  const lh = opts?.lineHeight ?? 1.45;
  const maxW = opts?.maxWidth ?? A4.w - MARGIN * 2;
  const x = opts?.x ?? MARGIN;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  setText(doc, color);
  const lines = doc.splitTextToSize(text, maxW) as string[];
  lines.forEach((ln, i) => doc.text(ln, x, y + i * size * lh));
  return y + lines.length * size * lh + 4;
}

export function drawCard(
  doc: jsPDF,
  opts: { x: number; y: number; w: number; h: number; title: string; body: string; gold?: boolean },
) {
  const { x, y, w, h, title, body, gold } = opts;
  setFill(doc, PALETTE.white);
  setStroke(doc, gold ? PALETTE.gold : PALETTE.grayLight);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, h, 6, 6, "FD");
  setFill(doc, gold ? PALETTE.gold : PALETTE.graphite);
  doc.rect(x, y, 3, h, "F");
  setText(doc, PALETTE.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(title, x + 12, y + 16);
  setText(doc, PALETTE.grayDark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(body, w - 24) as string[];
  lines.slice(0, Math.max(1, Math.floor((h - 26) / 11))).forEach((ln, i) =>
    doc.text(ln, x + 12, y + 30 + i * 11),
  );
}

export function drawFooter(
  doc: jsPDF,
  pageNum: number,
  total: number,
  companyName: string,
) {
  const y = A4.h - FOOTER_H;
  setFill(doc, PALETTE.black);
  doc.rect(0, y, A4.w, FOOTER_H, "F");
  setFill(doc, PALETTE.gold);
  doc.rect(0, y, A4.w, 2, "F");
  setText(doc, PALETTE.goldSoft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(companyName.toUpperCase(), MARGIN, y + 20);
  setText(doc, PALETTE.white);
  doc.setFont("helvetica", "normal");
  doc.text(`${pageNum} / ${total}`, A4.w - MARGIN, y + 20, { align: "right" });
}

export function applyFooters(doc: jsPDF, companyName: string) {
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total, companyName);
  }
}

/** Adds a new page and returns the cursor Y after top margin. */
export function newPage(doc: jsPDF) {
  doc.addPage();
  return MARGIN + 8;
}

export function ensureSpace(doc: jsPDF, y: number, needed: number) {
  if (y + needed > A4.h - FOOTER_H - 16) return newPage(doc);
  return y;
}
