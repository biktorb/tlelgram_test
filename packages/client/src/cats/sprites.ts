// Sprites are drawn once into small canvases and then blitted: drawing paths
// for 260 enemies every frame is too slow on phones. Each sprite is drawn in
// a 100×100 box centred on the creature; the game scales it to the hitbox.
// These flat vector drawings are placeholders until the sprite pack arrives.

export type SpriteId = 'cat' | 'mouse' | 'dog' | 'vacuum' | 'boss' | 'fish' | 'yarn';

const OUTLINE = '#2a2233';
type Paint = (c: CanvasRenderingContext2D) => void;

function blob(c: CanvasRenderingContext2D, fill: string, draw: () => void, line = 4): void {
  c.beginPath();
  draw();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = line;
  c.strokeStyle = OUTLINE;
  c.stroke();
}

function eyes(c: CanvasRenderingContext2D, y: number, gap: number, r: number, angry = false): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(50 + s * gap, y, r * 0.8, r, 0, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
    c.beginPath();
    c.arc(50 + s * gap + r * 0.25, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
    if (angry) {
      c.beginPath();
      c.moveTo(50 + s * (gap + r * 1.4), y - r * 1.9);
      c.lineTo(50 + s * (gap - r * 1.2), y - r * 1.1);
      c.lineWidth = 4;
      c.strokeStyle = OUTLINE;
      c.stroke();
    }
  }
}

const PAINT: Record<SpriteId, Paint> = {
  cat(c) {
    // Ears, head, stripes, face.
    for (const s of [-1, 1]) {
      blob(c, '#f39a3d', () => {
        c.moveTo(50 + s * 14, 30);
        c.lineTo(50 + s * 38, 8);
        c.lineTo(50 + s * 40, 42);
      });
      c.beginPath();
      c.moveTo(50 + s * 22, 30);
      c.lineTo(50 + s * 35, 17);
      c.lineTo(50 + s * 36, 36);
      c.fillStyle = '#ffc9a8';
      c.fill();
    }
    blob(c, '#f39a3d', () => c.ellipse(50, 56, 40, 34, 0, 0, Math.PI * 2));
    c.fillStyle = '#d9772a';
    for (const x of [-10, 0, 10]) c.fillRect(50 + x - 2.5, 23, 5, 12);
    c.beginPath();
    c.ellipse(50, 70, 20, 13, 0, 0, Math.PI * 2);
    c.fillStyle = '#ffe3c9';
    c.fill();
    eyes(c, 54, 15, 6);
    c.beginPath();
    c.moveTo(46, 64);
    c.lineTo(54, 64);
    c.lineTo(50, 69);
    c.fillStyle = '#ff7b9c';
    c.fill();
    c.beginPath();
    c.moveTo(42, 72);
    c.quadraticCurveTo(46, 77, 50, 71);
    c.quadraticCurveTo(54, 77, 58, 72);
    c.lineWidth = 3;
    c.strokeStyle = OUTLINE;
    c.stroke();
  },
  mouse(c) {
    for (const s of [-1, 1]) {
      blob(c, '#a7a9b8', () => c.arc(50 + s * 26, 26, 18, 0, Math.PI * 2));
      c.beginPath();
      c.arc(50 + s * 26, 26, 10, 0, Math.PI * 2);
      c.fillStyle = '#f2a7b8';
      c.fill();
    }
    blob(c, '#a7a9b8', () => c.ellipse(50, 60, 32, 30, 0, 0, Math.PI * 2));
    eyes(c, 56, 12, 6, true);
    c.beginPath();
    c.arc(50, 72, 6, 0, Math.PI * 2);
    c.fillStyle = '#f27a95';
    c.fill();
  },
  dog(c) {
    blob(c, '#b9773f', () => c.ellipse(50, 55, 38, 34, 0, 0, Math.PI * 2));
    for (const s of [-1, 1]) blob(c, '#7c4a24', () => c.ellipse(50 + s * 36, 52, 12, 26, s * 0.25, 0, Math.PI * 2));
    c.beginPath();
    c.ellipse(50, 70, 20, 15, 0, 0, Math.PI * 2);
    c.fillStyle = '#efd4b0';
    c.fill();
    eyes(c, 48, 14, 6, true);
    c.beginPath();
    c.ellipse(50, 64, 8, 6, 0, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
    c.beginPath();
    c.moveTo(42, 78);
    c.lineTo(58, 78);
    c.lineWidth = 3;
    c.strokeStyle = OUTLINE;
    c.stroke();
  },
  vacuum(c) {
    // A robot vacuum seen from above: disc, bumper, sensor eye.
    blob(c, '#3d4458', () => c.arc(50, 50, 44, 0, Math.PI * 2));
    c.beginPath();
    c.arc(50, 50, 44, Math.PI * 1.15, Math.PI * 1.85);
    c.lineWidth = 9;
    c.strokeStyle = '#9aa3b8';
    c.stroke();
    blob(c, '#5b6480', () => c.arc(50, 54, 26, 0, Math.PI * 2), 3);
    c.beginPath();
    c.arc(50, 54, 9, 0, Math.PI * 2);
    c.fillStyle = '#ff4d5e';
    c.fill();
    c.beginPath();
    c.arc(53, 51, 3, 0, Math.PI * 2);
    c.fillStyle = '#ffd1d6';
    c.fill();
  },
  boss(c) {
    // An angry mop: handle, head, strings.
    c.save();
    c.translate(50, 50);
    c.rotate(-0.35);
    blob(c, '#c48a4a', () => c.rect(-5, -48, 10, 52), 3);
    blob(c, '#4a7bd9', () => c.rect(-26, 0, 52, 16), 3);
    c.fillStyle = '#e8ecf5';
    c.strokeStyle = OUTLINE;
    c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.rect(-25 + i * 5.6, 16, 4.6, 26 + (i % 3) * 4);
      c.fill();
      c.stroke();
    }
    c.restore();
    eyes(c, 60, 10, 5, true);
  },
  fish(c) {
    blob(c, '#7fc8f8', () => {
      c.ellipse(44, 50, 30, 16, 0, 0, Math.PI * 2);
    });
    blob(c, '#4fa3d9', () => {
      c.moveTo(70, 50);
      c.lineTo(92, 34);
      c.lineTo(92, 66);
      c.closePath();
    });
    c.beginPath();
    c.arc(28, 46, 4, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
  },
  yarn(c) {
    blob(c, '#e4577b', () => c.arc(50, 50, 38, 0, Math.PI * 2));
    c.strokeStyle = '#b8355a';
    c.lineWidth = 4;
    for (const a of [-0.6, 0, 0.6]) {
      c.beginPath();
      c.ellipse(50, 50, 34, 14, a, 0, Math.PI * 2);
      c.stroke();
    }
  },
};

const cache = new Map<string, HTMLCanvasElement>();

// Returns the sprite drawn at `px` device pixels square, mirrored if `flip`.
export function sprite(id: SpriteId, px: number, flip = false): HTMLCanvasElement {
  const size = Math.max(8, Math.round(px));
  const key = `${id}:${size}:${flip}`;
  let s = cache.get(key);
  if (!s) {
    s = document.createElement('canvas');
    s.width = s.height = size;
    const c = s.getContext('2d')!;
    if (flip) {
      c.translate(size, 0);
      c.scale(-1, 1);
    }
    c.scale(size / 100, size / 100);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    PAINT[id](c);
    cache.set(key, s);
  }
  return s;
}

// A white silhouette of a sprite, used for the hit flash.
export function flashSprite(id: SpriteId, px: number, flip = false): HTMLCanvasElement {
  const key = `flash:${id}:${Math.max(8, Math.round(px))}:${flip}`;
  let s = cache.get(key);
  if (!s) {
    const base = sprite(id, px, flip);
    s = document.createElement('canvas');
    s.width = base.width;
    s.height = base.height;
    const c = s.getContext('2d')!;
    c.drawImage(base, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#fff';
    c.fillRect(0, 0, s.width, s.height);
    cache.set(key, s);
  }
  return s;
}
