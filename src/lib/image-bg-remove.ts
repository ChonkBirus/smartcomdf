/**
 * Client-side background removal for logos.
 * Heuristic: converts near-white/near-light pixels to transparent using a
 * flood-fill from image edges (so white "inside" the logo — e.g. inside letters
 * — is preserved only if it's not connected to the edge; connected white becomes
 * transparent). Preserves original aspect ratio and dimensions. Output is PNG.
 *
 * If the image already has meaningful transparency (>2% transparent pixels),
 * we return the original bytes as PNG unchanged.
 */

export type BgRemoveResult = {
  blob: Blob;
  width: number;
  height: number;
  changed: boolean;
};

const WHITE_THRESHOLD = 235; // r,g,b all >= this => considered "background white"
const SOFT_THRESHOLD = 210; // for soft edge feathering

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function removeLogoBackground(file: File): Promise<BgRemoveResult> {
  const img = await loadImage(file);
  const MAX_SIDE = 1200;
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * scale));
  const h = Math.max(1, Math.round(natH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponível.");
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Check existing transparency
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) transparentCount++;
  }
  const total = w * h;
  if (transparentCount / total > 0.02) {
    // Already transparent — re-encode as PNG to normalize.
    const blob = await canvasToPngBlob(canvas);
    return { blob, width: w, height: h, changed: false };
  }

  // Flood-fill from edges over "light" pixels; mark them for removal.
  const visited = new Uint8Array(total);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const p = idx * 4;
    const r = data[p],
      g = data[p + 1],
      b = data[p + 2];
    if (r >= SOFT_THRESHOLD && g >= SOFT_THRESHOLD && b >= SOFT_THRESHOLD) {
      visited[idx] = 1;
      stack.push(idx);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w;
    const y = (idx / w) | 0;
    const p = idx * 4;
    const r = data[p],
      g = data[p + 1],
      b = data[p + 2];
    // Strong white => fully transparent. Soft => partial alpha (feather).
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      data[p + 3] = 0;
    } else {
      // Feather: alpha proportional to distance from WHITE_THRESHOLD.
      const minC = Math.min(r, g, b);
      const t = Math.max(
        0,
        Math.min(1, (WHITE_THRESHOLD - minC) / (WHITE_THRESHOLD - SOFT_THRESHOLD)),
      );
      data[p + 3] = Math.round(255 * t);
    }
    // Expand
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  ctx.putImageData(imageData, 0, 0);
  const blob = await canvasToPngBlob(canvas);
  return { blob, width: w, height: h, changed: true };
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/png");
  });
}
