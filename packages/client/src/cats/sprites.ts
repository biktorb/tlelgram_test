// Sprites are drawn once into small canvases and then blitted: drawing paths
// for 260 enemies every frame is too slow on phones. Each sprite is drawn in
// a 100×100 box centred on the creature; the game scales it to the hitbox.
//
// The cat, dog and mouse come from «Animals pack» by Olga Bikmullina
// (CC-BY 3.0, https://opengameart.org/content/animals-pack), cut into
// public/sprites/*.svg. The rest is drawn here in the same flat style:
// outlines are a darker shade of the fill, eyes are white with a pupil.
// The drawn cat, dog and mouse are only used until the SVGs have loaded.

export type SpriteId = 'cat' | 'mouse' | 'dog' | 'dust' | 'vacuum' | 'boss' | 'fish' | 'yarn';

const OUTLINE = '#3b3344';
type Paint = (c: CanvasRenderingContext2D) => void;

function blob(c: CanvasRenderingContext2D, fill: string, draw: () => void, line = 4, stroke = OUTLINE): void {
  c.beginPath();
  draw();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = line;
  c.strokeStyle = stroke;
  c.stroke();
}

function eyes(c: CanvasRenderingContext2D, y: number, gap: number, r: number, angry = false): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.arc(50 + s * gap, y, r * 1.25, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = '#c9cbd6';
    c.stroke();
    c.beginPath();
    c.arc(50 + s * gap + s * r * 0.2, y + r * 0.1, r * 0.65, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
    c.beginPath();
    c.arc(50 + s * gap + s * r * 0.2 + r * 0.2, y - r * 0.2, r * 0.22, 0, Math.PI * 2);
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
  dust(c) {
    // A fluffy grey dust bunny: a ring of tufts around a round body.
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      blob(c, '#a9a6b4', () => c.arc(50 + Math.cos(a) * 30, 54 + Math.sin(a) * 27, 13, 0, Math.PI * 2), 3, '#76738a');
    }
    blob(c, '#bdbac8', () => c.arc(50, 54, 30, 0, Math.PI * 2), 0, '#bdbac8');
    eyes(c, 50, 11, 6);
  },
  vacuum(c) {
    // A robot vacuum seen from above: disc, bumper, sensor eye.
    blob(c, '#6b7489', () => c.arc(50, 50, 43, 0, Math.PI * 2), 5, '#454c5e');
    c.beginPath();
    c.arc(50, 50, 40, Math.PI * 1.12, Math.PI * 1.88);
    c.lineWidth = 8;
    c.strokeStyle = '#b4bccc';
    c.stroke();
    blob(c, '#828ba0', () => c.arc(50, 56, 25, 0, Math.PI * 2), 3, '#5a6276');
    eyes(c, 54, 10, 6, true);
  },
  boss(c) {
    // An angry mop: handle, head, strings.
    c.save();
    c.translate(50, 50);
    c.rotate(-0.35);
    blob(c, '#d39a5b', () => c.rect(-5, -48, 10, 52), 3, '#9a6a35');
    blob(c, '#5b8ce0', () => c.rect(-26, 0, 52, 16), 3, '#3863ad');
    c.fillStyle = '#f1f3f8';
    c.strokeStyle = '#bcc2d1';
    c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.rect(-25 + i * 5.6, 16, 4.6, 26 + (i % 3) * 4);
      c.fill();
      c.stroke();
    }
    c.restore();
    eyes(c, 62, 10, 5, true);
  },
  fish(c) {
    blob(c, '#8fd0f7', () => c.ellipse(44, 50, 30, 16, 0, 0, Math.PI * 2), 4, '#4f9ccc');
    blob(
      c,
      '#5fb0e0',
      () => {
        c.moveTo(70, 50);
        c.lineTo(92, 34);
        c.lineTo(92, 66);
        c.closePath();
      },
      4,
      '#3f86b5',
    );
    c.beginPath();
    c.arc(28, 46, 4.5, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
    c.beginPath();
    c.arc(27, 46, 2.5, 0, Math.PI * 2);
    c.fillStyle = OUTLINE;
    c.fill();
  },
  yarn(c) {
    blob(c, '#ee7396', () => c.arc(50, 50, 38, 0, Math.PI * 2), 5, '#c04a6e');
    c.strokeStyle = '#c95479';
    c.lineWidth = 4;
    for (const a of [-0.6, 0, 0.6]) {
      c.beginPath();
      c.ellipse(50, 50, 34, 14, a, 0, Math.PI * 2);
      c.stroke();
    }
  },
};

const cache = new Map<string, HTMLCanvasElement>();
const images = new Map<SpriteId, HTMLImageElement>();
const IMAGE_SPRITES: SpriteId[] = ['cat', 'dog', 'mouse'];

// Loads the pack sprites. Resolves even if some fail: the drawn ones stay.
export function loadSprites(): Promise<void> {
  return Promise.all(
    IMAGE_SPRITES.map(
      (id) =>
        new Promise<void>((done) => {
          const img = new Image();
          img.onload = () => {
            images.set(id, img);
            for (const key of [...cache.keys()]) if (key.includes(`${id}:`)) cache.delete(key);
            done();
          };
          img.onerror = () => done();
          img.src = `./sprites/${id}.svg`;
        }),
    ),
  ).then(() => undefined);
}

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
    const img = images.get(id);
    if (img) c.drawImage(img, 0, 0, size, size);
    else {
      c.scale(size / 100, size / 100);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      PAINT[id](c);
    }
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
