// Sprites are drawn once into small canvases and then blitted: drawing paths
// for 260 enemies every frame is too slow on phones. Each sprite is drawn in
// a 100×100 box centred on the creature; the game scales it to the hitbox.
//
// The pixel art comes from one atlas made by tools/pixel-art/build.py; each
// creature fills its square cell the way the vector picture fills its box.
// Until the atlas has loaded, and for any name it lacks, the vector pictures
// below are drawn instead.
//
// Everything is drawn here, in one flat style: outlines are a darker shade
// of the fill, eyes are white with a pupil, heads are big so a creature
// reads at 30 px. Creatures face right; the game mirrors them. The heroes
// and villains are the folk-tale ones in our own drawing, not those of any
// cartoon.

import type { cats } from '@otryad/core';
import atlasUrl from './art/atlas.png';
import RECTS from './art/atlas.json';

type Rect = [number, number, number, number];
const ART = RECTS as unknown as Record<string, Rect>;
let atlas: HTMLImageElement | null = null;

// Loads the atlas once; resolves even if it fails, so the game still starts.
export function loadArt(): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      atlas = img;
      cache.clear();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = atlasUrl;
  });
}

// A picture from the atlas: the image and its cell, or null.
export function art(name: string): [HTMLImageElement, Rect] | null {
  const r = ART[name];
  return atlas && r ? [atlas, r] : null;
}

// A fresh canvas with an atlas picture at its own size, for the DOM (CSS
// scales it with hard pixels); null if the atlas lacks it.
export function artElement(name: string, cls: string): HTMLCanvasElement | null {
  const a = art(name);
  if (!a) return null;
  const [img, [x, y, w, h]] = a;
  const c = document.createElement('canvas');
  c.className = cls;
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, w, h);
  return c;
}

// An atlas picture scaled up by a whole number with hard pixel edges, for
// patterns and big things the game stretches itself.
const big = new Map<string, HTMLCanvasElement>();
export function artCanvas(name: string, k: number): HTMLCanvasElement | null {
  const a = art(name);
  if (!a) return null;
  const key = `${name}:${k}`;
  let s = big.get(key);
  if (!s) {
    const [img, [x, y, w, h]] = a;
    s = document.createElement('canvas');
    s.width = w * k;
    s.height = h * k;
    const c = s.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, x, y, w, h, 0, 0, w * k, h * k);
    big.set(key, s);
  }
  return s;
}

export type SpriteId =
  // heroes
  | 'ilya'
  | 'vasilisa'
  | 'dobrynya'
  | 'alyosha'
  // Дремучий лес
  | 'bat'
  | 'stump'
  | 'kikimora'
  | 'wisp'
  | 'boar'
  | 'bear'
  | 'wolf'
  | 'leshy'
  | 'hut'
  | 'yaga'
  // Муромская дорога
  | 'bird'
  | 'goose'
  | 'hornet'
  | 'robber'
  | 'flail'
  | 'tur'
  | 'rider'
  | 'ataman'
  | 'son'
  | 'solovey'
  // Кощеево царство
  | 'bones'
  | 'snake'
  | 'guard'
  | 'dragonling'
  | 'sorcerer'
  | 'bonehorse'
  | 'chudo'
  | 'knight'
  | 'idol'
  | 'likho'
  | 'gorynych'
  // everywhere
  | 'thistle'
  | 'koschei'
  // weapons
  | 'arrow'
  | 'feather'
  | 'axe'
  | 'charm';

const OUTLINE = '#3b3344';
type Ctx = CanvasRenderingContext2D;
type Paint = (c: Ctx) => void;
const TAU = Math.PI * 2;

function blob(c: Ctx, fill: string, draw: () => void, line = 4, stroke = OUTLINE): void {
  c.beginPath();
  draw();
  c.fillStyle = fill;
  c.fill();
  if (line > 0) {
    c.lineWidth = line;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function circle(c: Ctx, x: number, y: number, r: number, fill: string, line = 3, stroke = OUTLINE): void {
  blob(c, fill, () => c.arc(x, y, r, 0, TAU), line, stroke);
}

function stick(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.lineWidth = w + 3;
  c.strokeStyle = OUTLINE;
  c.stroke();
  c.lineWidth = w;
  c.strokeStyle = color;
  c.stroke();
}

function eye(c: Ctx, x: number, y: number, r: number, angry = false, dir = 1): void {
  c.beginPath();
  c.arc(x, y, r * 1.25, 0, TAU);
  c.fillStyle = '#fff';
  c.fill();
  c.lineWidth = 1.5;
  c.strokeStyle = '#c9cbd6';
  c.stroke();
  c.beginPath();
  c.arc(x + dir * r * 0.25, y + r * 0.1, r * 0.65, 0, TAU);
  c.fillStyle = OUTLINE;
  c.fill();
  c.beginPath();
  c.arc(x + dir * r * 0.25 + r * 0.2, y - r * 0.2, r * 0.22, 0, TAU);
  c.fillStyle = '#fff';
  c.fill();
  if (angry) {
    c.beginPath();
    c.moveTo(x - dir * r * 1.4, y - r * 1.9);
    c.lineTo(x + dir * r * 1.2, y - r * 1.1);
    c.lineWidth = Math.max(2, r * 0.6);
    c.strokeStyle = OUTLINE;
    c.stroke();
  }
}

function eyes(c: Ctx, x: number, y: number, gap: number, r: number, angry = false): void {
  for (const s of [-1, 1]) {
    eye(c, x + s * gap, y, r, false, 1);
    if (angry) {
      c.beginPath();
      c.moveTo(x + s * (gap + r * 1.4), y - r * 1.9);
      c.lineTo(x + s * (gap - r * 1.2), y - r * 1.1);
      c.lineWidth = Math.max(2, r * 0.6);
      c.strokeStyle = OUTLINE;
      c.stroke();
    }
  }
}

// Red glowing eyes, for the undead and the dark ones.
function glow(c: Ctx, x: number, y: number, gap: number, r: number): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.arc(x + s * gap, y, r, 0, TAU);
    c.fillStyle = '#ff3b30';
    c.fill();
    c.beginPath();
    c.arc(x + s * gap, y, r * 0.45, 0, TAU);
    c.fillStyle = '#ffd25a';
    c.fill();
  }
}

// ---------- people ----------
// A chibi figure seen from the front: a big head over a short robe.
interface Person {
  skin: string;
  body: string;
  trim?: string; // a band down the robe and at the hem
  legs?: string;
  hat?: 'helmet' | 'kokoshnik' | 'scarf' | 'cap' | 'crown' | 'wizard' | 'horns' | 'crest' | 'none';
  hatColor?: string;
  beard?: string;
  hair?: string; // hair, or a braid with the kokoshnik
  skull?: boolean;
  oneEye?: boolean;
  angry?: boolean;
  wide?: number; // body width factor
  item?: 'sword' | 'club' | 'flail' | 'spear' | 'bow' | 'staff' | 'feather' | 'sabre' | 'broom' | 'none';
  shield?: string;
}

function item(c: Ctx, what: Person['item']): void {
  switch (what) {
    case 'sword':
    case 'sabre':
      stick(c, 76, 74, 90, what === 'sabre' ? 30 : 22, 5, '#dfe5ee');
      stick(c, 70, 66, 84, 72, 4, '#c9a227');
      break;
    case 'club':
      stick(c, 74, 78, 88, 34, 6, '#8a5a2b');
      circle(c, 88, 32, 9, '#8a5a2b');
      break;
    case 'flail':
      stick(c, 74, 78, 84, 50, 5, '#8a5a2b');
      c.beginPath();
      c.moveTo(84, 50);
      c.lineTo(90, 30);
      c.lineWidth = 2;
      c.strokeStyle = '#555';
      c.stroke();
      circle(c, 90, 26, 7, '#7c828c');
      break;
    case 'spear':
      stick(c, 80, 96, 80, 14, 4, '#8a5a2b');
      blob(c, '#dfe5ee', () => {
        c.moveTo(80, 2);
        c.lineTo(86, 16);
        c.lineTo(74, 16);
        c.closePath();
      }, 3);
      break;
    case 'bow':
      c.beginPath();
      c.arc(70, 62, 26, -1.2, 1.2);
      c.lineWidth = 7;
      c.strokeStyle = OUTLINE;
      c.stroke();
      c.lineWidth = 4;
      c.strokeStyle = '#a0662d';
      c.stroke();
      c.beginPath();
      c.moveTo(70 + Math.cos(-1.2) * 26, 62 + Math.sin(-1.2) * 26);
      c.lineTo(70 + Math.cos(1.2) * 26, 62 + Math.sin(1.2) * 26);
      c.lineWidth = 1.5;
      c.strokeStyle = '#eee';
      c.stroke();
      break;
    case 'staff':
      stick(c, 80, 96, 80, 24, 4, '#6b4a2b');
      circle(c, 80, 18, 9, '#7fe0ff', 3, '#2b7fa8');
      break;
    case 'feather':
      featherPaint(c, 82, 50, 0.5);
      break;
    case 'broom':
      stick(c, 22, 90, 34, 20, 4, '#8a5a2b');
      blob(c, '#d9b45a', () => {
        c.moveTo(14, 82);
        c.lineTo(30, 84);
        c.lineTo(26, 99);
        c.lineTo(8, 97);
        c.closePath();
      }, 3, '#8a6a20');
      break;
    default:
  }
}

function person(o: Person): Paint {
  return (c) => {
    const w = o.wide ?? 1;
    const legs = o.legs ?? '#5a4636';
    if (o.hat === 'kokoshnik') blob(c, o.hatColor ?? '#c0392b', () => c.arc(50, 32, 27, Math.PI, 0), 3);
    if (o.item === 'bow' || o.item === 'broom') item(c, o.item);
    // Legs, robe, hands.
    blob(c, legs, () => c.rect(38, 78, 9, 16), 3);
    blob(c, legs, () => c.rect(53, 78, 9, 16), 3);
    blob(c, o.body, () => {
      c.moveTo(50 - 22 * w, 88);
      c.lineTo(50 + 22 * w, 88);
      c.lineTo(50 + 14 * w, 50);
      c.lineTo(50 - 14 * w, 50);
      c.closePath();
    });
    if (o.trim) {
      c.fillStyle = o.trim;
      c.fillRect(46, 52, 8, 34);
      c.fillRect(50 - 21 * w, 81, 42 * w, 5);
    }
    if (o.shield) {
      circle(c, 28, 68, 15, o.shield);
      circle(c, 28, 68, 5, '#e6c24a', 2);
    } else circle(c, 50 - 20 * w, 70, 6, o.skin, 2);
    if (o.item !== 'bow' && o.item !== 'broom' && o.item !== 'none') item(c, o.item);
    circle(c, 50 + 20 * w, 70, 6, o.skin, 2);
    // Head.
    if (o.hair && o.hat === 'kokoshnik') {
      // A long braid over the shoulder.
      stick(c, 64, 40, 70, 76, 7, o.hair);
    }
    if (o.hair && o.hat !== 'kokoshnik') blob(c, o.hair, () => c.arc(50, 34, 20, Math.PI * 0.9, Math.PI * 2.1), 3);
    circle(c, 50, 36, 18, o.skin);
    if (o.beard) {
      blob(c, o.beard, () => {
        c.moveTo(33, 40);
        c.quadraticCurveTo(50, 50, 67, 40);
        c.quadraticCurveTo(64, 62, 50, 66);
        c.quadraticCurveTo(36, 62, 33, 40);
      }, 3);
    }
    if (o.skull) {
      glow(c, 50, 34, 7, 4);
      c.fillStyle = OUTLINE;
      for (let i = -2; i <= 2; i++) c.fillRect(48 + i * 4, 45, 2.5, 5);
    } else if (o.oneEye) eye(c, 50, 33, 7, true);
    else eyes(c, 50, 34, 7, 3.6, o.angry);
    const hc = o.hatColor ?? '#888';
    switch (o.hat) {
      case 'helmet':
        blob(c, hc, () => {
          c.moveTo(31, 33);
          c.quadraticCurveTo(31, 16, 50, 4);
          c.quadraticCurveTo(69, 16, 69, 33);
          c.closePath();
        });
        blob(c, hc, () => c.rect(47.5, 30, 5, 12), 2);
        break;
      case 'kokoshnik':
        c.fillStyle = '#f4d03f';
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.arc(50 + Math.cos(Math.PI + (i + 0.5) * (Math.PI / 5)) * 20, 32 + Math.sin(Math.PI + (i + 0.5) * (Math.PI / 5)) * 20, 3, 0, TAU);
          c.fill();
        }
        break;
      case 'scarf':
        blob(c, hc, () => {
          c.moveTo(30, 40);
          c.quadraticCurveTo(28, 14, 50, 14);
          c.quadraticCurveTo(72, 14, 70, 40);
          c.quadraticCurveTo(62, 26, 50, 26);
          c.quadraticCurveTo(38, 26, 30, 40);
        });
        break;
      case 'cap':
        blob(c, hc, () => c.ellipse(50, 22, 18, 11, 0, Math.PI, 0));
        blob(c, '#6b4a2b', () => c.rect(31, 21, 38, 7), 3);
        break;
      case 'crown':
        blob(c, '#e6c24a', () => {
          c.moveTo(34, 24);
          c.lineTo(34, 6);
          c.lineTo(42, 16);
          c.lineTo(50, 2);
          c.lineTo(58, 16);
          c.lineTo(66, 6);
          c.lineTo(66, 24);
          c.closePath();
        }, 3, '#8a6a10');
        break;
      case 'wizard':
        blob(c, hc, () => {
          c.moveTo(28, 26);
          c.lineTo(72, 26);
          c.lineTo(56, -2);
          c.closePath();
        });
        break;
      case 'horns':
        blob(c, hc, () => c.ellipse(50, 24, 19, 10, 0, Math.PI, 0));
        for (const s of [-1, 1]) {
          blob(c, '#efe6cf', () => {
            c.moveTo(50 + s * 14, 20);
            c.quadraticCurveTo(50 + s * 32, 18, 50 + s * 30, 2);
            c.quadraticCurveTo(50 + s * 24, 14, 50 + s * 8, 16);
          }, 3);
        }
        break;
      case 'crest':
        // Feathers sticking up: Solovey the robber is half bird.
        for (const a of [-0.5, -0.15, 0.2, 0.55]) stick(c, 50, 22, 50 + Math.sin(a) * 26, 22 - Math.cos(a) * 24, 5, hc);
        break;
      default:
    }
  };
}

// ---------- beasts ----------
// Four legs seen from the side, facing right.
interface Beast {
  fur: string;
  dark: string;
  belly?: string;
  ears?: 'pointed' | 'round' | 'none';
  snout?: number; // how far the muzzle sticks out
  tusks?: boolean;
  horns?: boolean;
  tail?: 'bushy' | 'thin' | 'none';
  angry?: boolean;
  bones?: boolean; // ribs and glowing eyes
  mane?: string;
}

function beast(o: Beast): Paint {
  return (c) => {
    // Drawn a little smaller and to the left so the snout and horns fit.
    c.save();
    c.translate(46, 54);
    c.scale(0.84, 0.84);
    c.translate(-56, -50);
    for (const x of [24, 36, 58, 70]) blob(c, o.dark, () => c.rect(x, 68, 9, 22), 3);
    if (o.tail === 'bushy') blob(c, o.fur, () => c.ellipse(14, 50, 13, 7, -0.6, 0, TAU));
    if (o.tail === 'thin') stick(c, 16, 52, 6, 64, 3, o.dark);
    blob(c, o.fur, () => c.ellipse(46, 58, 34, 20, 0, 0, TAU));
    if (o.belly) {
      c.beginPath();
      c.ellipse(46, 66, 24, 9, 0, 0, TAU);
      c.fillStyle = o.belly;
      c.fill();
    }
    if (o.bones) {
      c.strokeStyle = '#8f8a7a';
      c.lineWidth = 3;
      for (const x of [34, 44, 54]) {
        c.beginPath();
        c.moveTo(x, 44);
        c.lineTo(x, 70);
        c.stroke();
      }
    }
    if (o.mane) blob(c, o.mane, () => c.ellipse(70, 44, 10, 18, 0.5, 0, TAU), 3);
    const sn = o.snout ?? 10;
    blob(c, o.fur, () => c.ellipse(78 + sn * 0.4, 46, 16 + sn * 0.5, 14, 0, 0, TAU));
    if (o.ears === 'pointed') {
      blob(c, o.fur, () => {
        c.moveTo(68, 38);
        c.lineTo(70, 18);
        c.lineTo(80, 34);
      }, 3);
    }
    if (o.ears === 'round') circle(c, 70, 34, 7, o.fur);
    if (o.horns) {
      blob(c, '#efe6cf', () => {
        c.moveTo(74, 36);
        c.quadraticCurveTo(84, 14, 98, 18);
        c.quadraticCurveTo(86, 22, 82, 38);
      }, 3);
    }
    // Nose at the tip.
    c.beginPath();
    c.ellipse(92 + sn * 0.6, 48, 5, 4, 0, 0, TAU);
    c.fillStyle = OUTLINE;
    c.fill();
    if (o.tusks) {
      blob(c, '#fff', () => {
        c.moveTo(84, 54);
        c.lineTo(90, 44);
        c.lineTo(88, 56);
      }, 2);
    }
    if (o.bones) glow(c, 80, 42, 0, 4.5);
    else eye(c, 80, 42, 4.5, o.angry ?? true);
    c.restore();
  };
}

// A bird from above, wings spread.
function birdPaint(wing: string, body: string, head: string, beak: string, edge: string): Paint {
  return (c) => {
    for (const s of [-1, 1]) blob(c, wing, () => c.ellipse(50 + s * 28, 52, 26, 12, s * -0.3, 0, TAU), 3, edge);
    blob(c, body, () => c.ellipse(50, 56, 17, 26, 0, 0, TAU), 3, edge);
    blob(c, head, () => c.arc(50, 32, 13, 0, TAU), 3, edge);
    eyes(c, 50, 31, 6, 3.5, true);
    c.beginPath();
    c.moveTo(45, 40);
    c.lineTo(55, 40);
    c.lineTo(50, 49);
    c.fillStyle = beak;
    c.fill();
  };
}

function featherPaint(c: Ctx, x: number, y: number, k: number): void {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.rotate(-0.6);
  blob(c, '#ff8a1e', () => c.ellipse(0, 0, 16, 40, 0, 0, TAU), 4, '#b3461a');
  blob(c, '#ffd23a', () => c.ellipse(0, -4, 8, 26, 0, 0, TAU), 0);
  stick(c, 0, -34, 0, 48, 2, '#b3461a');
  c.restore();
}

// ---------- the pictures ----------
const PAINT: Record<SpriteId, Paint> = {
  ilya: person({ skin: '#f2c9a0', body: '#8d99a6', trim: '#b03a2e', legs: '#6b3a22', hat: 'helmet', hatColor: '#c3cad4', beard: '#8a5a2b', item: 'sword' }),
  vasilisa: person({ skin: '#f6d2b4', body: '#c0392b', trim: '#f4d03f', legs: '#7a1f1a', hat: 'kokoshnik', hatColor: '#c0392b', hair: '#e0b44a', item: 'feather' }),
  dobrynya: person({ skin: '#eec19a', body: '#3d6fb6', trim: '#e6c24a', legs: '#2e3a55', hat: 'helmet', hatColor: '#e0b84a', beard: '#3b2a20', item: 'sword', shield: '#c0392b', wide: 1.12 }),
  alyosha: person({ skin: '#f6d2b4', body: '#3f9b4f', trim: '#f4d03f', legs: '#5a4636', hat: 'cap', hatColor: '#c0392b', hair: '#f0c75a', item: 'bow' }),

  bat(c) {
    for (const s of [-1, 1]) {
      blob(c, '#5a4a78', () => {
        c.moveTo(50, 50);
        c.lineTo(50 + s * 46, 34);
        c.lineTo(50 + s * 40, 56);
        c.lineTo(50 + s * 30, 50);
        c.lineTo(50 + s * 24, 64);
        c.closePath();
      }, 3, '#2f2545');
    }
    for (const s of [-1, 1]) {
      blob(c, '#6b5a8c', () => {
        c.moveTo(50 + s * 8, 40);
        c.lineTo(50 + s * 16, 22);
        c.lineTo(50 + s * 18, 42);
      }, 3, '#2f2545');
    }
    circle(c, 50, 52, 18, '#6b5a8c', 3, '#2f2545');
    eyes(c, 50, 50, 7, 3.8, true);
    c.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(50 + s * 5, 60);
      c.lineTo(50 + s * 2, 60);
      c.lineTo(50 + s * 3.5, 66);
      c.fill();
    }
  },
  stump(c) {
    // A walking stump: a trunk with roots, twig arms and leaves on top.
    for (const x of [30, 46, 62]) blob(c, '#6b4a2b', () => c.rect(x, 80, 8, 12), 3);
    stick(c, 28, 60, 12, 46, 4, '#6b4a2b');
    stick(c, 72, 60, 88, 46, 4, '#6b4a2b');
    blob(c, '#8a5f37', () => c.rect(26, 34, 48, 50), 4, '#4f3420');
    blob(c, '#c49a6c', () => c.ellipse(50, 34, 24, 8, 0, 0, TAU), 3, '#4f3420');
    for (const [x, y] of [[40, 24], [56, 22], [48, 16]]) circle(c, x, y, 7, '#5fae4a', 3, '#2f6a27');
    eyes(c, 50, 56, 8, 4.5, true);
  },
  kikimora: person({ skin: '#a8c98a', body: '#5f7d3a', legs: '#3f5a26', hat: 'scarf', hatColor: '#6f8f4a', hair: '#3f5a26', angry: true, item: 'none' }),
  wisp(c) {
    blob(c, '#7fe8d4', () => {
      c.moveTo(50, 6);
      c.quadraticCurveTo(80, 44, 74, 66);
      c.quadraticCurveTo(66, 92, 50, 92);
      c.quadraticCurveTo(34, 92, 26, 66);
      c.quadraticCurveTo(20, 44, 50, 6);
    }, 4, '#2a9c8a');
    blob(c, '#d9fff6', () => c.ellipse(50, 66, 14, 18, 0, 0, TAU), 0);
    eyes(c, 50, 62, 8, 4);
  },
  boar: beast({ fur: '#6b4a3a', dark: '#4a3328', belly: '#8a6a58', ears: 'pointed', snout: 12, tusks: true, tail: 'thin' }),
  bear: beast({ fur: '#7a4f2e', dark: '#553620', belly: '#9a6e48', ears: 'round', snout: 8, tail: 'none' }),
  wolf: beast({ fur: '#8d93a0', dark: '#5f6470', belly: '#c9ccd4', ears: 'pointed', snout: 14, tail: 'bushy' }),
  leshy(c) {
    // A tree with a face: trunk body, branch arms, a crown of leaves.
    for (const x of [34, 56]) blob(c, '#5a3d22', () => c.rect(x, 78, 10, 18), 3);
    stick(c, 30, 56, 8, 38, 6, '#6b4a2b');
    stick(c, 70, 56, 92, 38, 6, '#6b4a2b');
    blob(c, '#7a5530', () => c.rect(28, 40, 44, 44), 4, '#4a3018');
    for (const [x, y, r] of [[30, 26, 16], [50, 16, 18], [70, 26, 16], [50, 34, 14]]) circle(c, x, y, r, '#4f8f3a', 3, '#2a5a1f');
    blob(c, '#8bbf6a', () => {
      c.moveTo(34, 64);
      c.quadraticCurveTo(50, 98, 66, 64);
      c.closePath();
    }, 3, '#4f7f3a');
    eyes(c, 50, 52, 9, 5, true);
  },
  hut(c) {
    // A log hut on chicken legs.
    for (const s of [-1, 1]) {
      stick(c, 50 + s * 10, 66, 50 + s * 16, 90, 5, '#e6b23a');
      stick(c, 50 + s * 16, 90, 50 + s * 26, 94, 3, '#e6b23a');
      stick(c, 50 + s * 16, 90, 50 + s * 8, 96, 3, '#e6b23a');
    }
    blob(c, '#9a6a3a', () => c.rect(18, 36, 64, 34), 4, '#5a3a1a');
    c.strokeStyle = '#6b4a2b';
    c.lineWidth = 2;
    for (const y of [45, 54, 63]) {
      c.beginPath();
      c.moveTo(20, y);
      c.lineTo(80, y);
      c.stroke();
    }
    blob(c, '#6b4a2b', () => {
      c.moveTo(10, 38);
      c.lineTo(50, 8);
      c.lineTo(90, 38);
      c.closePath();
    }, 4, '#3f2a14');
    blob(c, '#ffd86b', () => c.rect(40, 42, 20, 18), 3, '#5a3a1a');
    glow(c, 50, 51, 5, 3);
  },
  yaga(c) {
    // Baba Yaga in her mortar, with a broom.
    item(c, 'broom');
    person({ skin: '#e2c1a0', body: '#5a4a6a', hat: 'scarf', hatColor: '#8a3a3a', hair: '#bbb', angry: true, item: 'none' })(c);
    // A long nose.
    blob(c, '#d9a888', () => c.ellipse(54, 42, 5, 7, -0.3, 0, TAU), 2);
    blob(c, '#7c828c', () => {
      c.moveTo(22, 58);
      c.lineTo(78, 58);
      c.lineTo(70, 98);
      c.lineTo(30, 98);
      c.closePath();
    }, 4, '#4a4f58');
    c.strokeStyle = '#4a4f58';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(26, 70);
    c.lineTo(74, 70);
    c.stroke();
  },

  bird: birdPaint('#4a4a55', '#5c5c68', '#3a3a44', '#d9a43a', '#24242c'),
  goose(c) {
    for (const s of [-1, 1]) blob(c, '#f2f2f2', () => c.ellipse(50 + s * 24, 60, 22, 12, s * -0.3, 0, TAU), 3, '#9aa0aa');
    blob(c, '#ffffff', () => c.ellipse(50, 62, 18, 24, 0, 0, TAU), 3, '#9aa0aa');
    stick(c, 50, 46, 50, 26, 8, '#ffffff');
    circle(c, 50, 22, 11, '#ffffff', 3, '#9aa0aa');
    eyes(c, 50, 21, 5, 3, true);
    blob(c, '#f08a24', () => {
      c.moveTo(44, 28);
      c.lineTo(56, 28);
      c.lineTo(50, 38);
      c.closePath();
    }, 2, '#a85a10');
  },
  hornet(c) {
    for (const s of [-1, 1]) blob(c, 'rgba(220, 240, 255, .85)', () => c.ellipse(50 + s * 20, 36, 18, 10, s * -0.5, 0, TAU), 3, '#8aa0b8');
    blob(c, '#f2c21b', () => c.ellipse(50, 60, 18, 28, 0, 0, TAU), 4, '#7a5a10');
    c.fillStyle = OUTLINE;
    for (const y of [52, 64, 76]) c.fillRect(34, y, 32, 5);
    circle(c, 50, 30, 13, '#3a3344');
    eyes(c, 50, 30, 6, 3.5, true);
  },
  robber: person({ skin: '#e8b88f', body: '#7a5c3a', trim: '#4a3a28', hat: 'cap', hatColor: '#5a4636', beard: '#5a3a1f', angry: true, item: 'club' }),
  flail: person({ skin: '#e8b88f', body: '#5d6d3a', trim: '#3f4a26', hat: 'cap', hatColor: '#a83a2a', beard: '#2f2218', angry: true, item: 'flail' }),
  tur: beast({ fur: '#4a3328', dark: '#2f2018', belly: '#6b4a3a', ears: 'none', snout: 6, horns: true, tail: 'thin' }),
  rider(c) {
    beast({ fur: '#9a6a3a', dark: '#6b4a2b', ears: 'pointed', snout: 12, tail: 'thin', mane: '#3b2a20', angry: false })(c);
    // The robber in the saddle.
    blob(c, '#7a2f2a', () => c.rect(36, 24, 22, 26), 3);
    circle(c, 47, 16, 12, '#e8b88f');
    blob(c, '#3b2a20', () => c.ellipse(47, 8, 12, 6, 0, Math.PI, 0), 3);
    eyes(c, 47, 16, 5, 2.6, true);
    stick(c, 58, 34, 76, 6, 4, '#dfe5ee');
  },
  ataman: person({ skin: '#e8b88f', body: '#a8322a', trim: '#e6c24a', legs: '#2f2218', hat: 'cap', hatColor: '#2f2218', beard: '#1f1a18', angry: true, item: 'sabre', wide: 1.25 }),
  son: person({ skin: '#e8b88f', body: '#6a3f8a', trim: '#3f2560', hat: 'crest', hatColor: '#8a6a3a', angry: true, item: 'club' }),
  solovey(c) {
    person({ skin: '#e2b088', body: '#6b4a2b', trim: '#3f2a14', hat: 'crest', hatColor: '#b0823a', beard: '#4a3018', angry: true, item: 'none', wide: 1.2 })(c);
    // Whistling: round lips and the sound.
    circle(c, 50, 46, 4, '#c0392b', 2);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    for (const r of [10, 18]) {
      c.beginPath();
      c.arc(58, 46, r, -0.6, 0.6);
      c.stroke();
    }
  },

  bones: person({ skin: '#ece6d6', body: '#cfc8b4', legs: '#cfc8b4', skull: true, item: 'none' }),
  snake(c) {
    blob(c, '#4f9a3a', () => c.arc(50, 50, 40, 0, TAU), 5, '#2a5a1f');
    c.fillStyle = '#3d7f2c';
    for (const [x, y] of [[36, 36], [64, 36], [50, 66], [32, 60], [68, 60]]) {
      c.beginPath();
      c.arc(x, y, 7, 0, TAU);
      c.fill();
    }
    eyes(c, 50, 44, 12, 6, true);
    stick(c, 50, 62, 50, 76, 3, '#c0392b');
  },
  guard: person({ skin: '#ece6d6', body: '#4a4f58', trim: '#2a2d33', legs: '#2a2d33', skull: true, hat: 'helmet', hatColor: '#5a5f68', item: 'spear' }),
  dragonling(c) {
    for (const s of [-1, 1]) {
      blob(c, '#7bc46a', () => {
        c.moveTo(50, 48);
        c.lineTo(50 + s * 44, 30);
        c.lineTo(50 + s * 34, 54);
        c.lineTo(50 + s * 20, 58);
        c.closePath();
      }, 3, '#2f6a27');
    }
    blob(c, '#4f9a3a', () => c.ellipse(50, 62, 15, 24, 0, 0, TAU), 3, '#2a5a1f');
    stick(c, 50, 84, 58, 96, 4, '#4f9a3a');
    circle(c, 50, 36, 14, '#4f9a3a', 3, '#2a5a1f');
    eyes(c, 50, 35, 6, 3.5, true);
    c.fillStyle = '#ff8a1e';
    c.beginPath();
    c.arc(50, 46, 3, 0, TAU);
    c.fill();
  },
  sorcerer: person({ skin: '#d9c4b0', body: '#3f2a6a', trim: '#8a6ac9', legs: '#241640', hat: 'wizard', hatColor: '#2a1a4a', beard: '#c9c9d0', angry: true, item: 'staff' }),
  bonehorse: beast({ fur: '#e2dccb', dark: '#b8b09a', ears: 'pointed', snout: 14, tail: 'thin', bones: true, mane: '#5a4a6a' }),
  chudo(c) {
    // A many-headed lump with teeth.
    for (const [x, y] of [[24, 30], [50, 18], [76, 30]]) {
      stick(c, 50, 60, x, y, 9, '#7a4fa8');
      circle(c, x, y, 12, '#8a5fc0', 3, '#4a2a70');
      glow(c, x, y - 1, 4, 2.5);
    }
    blob(c, '#8a5fc0', () => c.ellipse(50, 66, 38, 26, 0, 0, TAU), 4, '#4a2a70');
    c.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(30 + i * 8, 70);
      c.lineTo(34 + i * 8, 80);
      c.lineTo(38 + i * 8, 70);
      c.fill();
    }
  },
  knight: person({ skin: '#2a2d33', body: '#2f3238', trim: '#7a1f1a', legs: '#1f2126', hat: 'helmet', hatColor: '#3a3d44', skull: true, item: 'sword', shield: '#2a2d33' }),
  idol: person({ skin: '#a87a5a', body: '#6a4a3a', trim: '#3a2a20', legs: '#3a2a20', hat: 'horns', hatColor: '#4a3a2a', beard: '#2a1f18', angry: true, item: 'club', wide: 1.45 }),
  likho: person({ skin: '#9aa0a8', body: '#5a5a62', legs: '#3a3a40', hair: '#3a3a40', oneEye: true, item: 'none', wide: 1.2 }),
  gorynych(c) {
    // Three heads on long necks over a winged body.
    for (const s of [-1, 1]) {
      blob(c, '#6aa84f', () => {
        c.moveTo(50, 62);
        c.lineTo(50 + s * 48, 46);
        c.lineTo(50 + s * 40, 72);
        c.lineTo(50 + s * 24, 78);
        c.closePath();
      }, 3, '#2f5a20');
    }
    for (const [x, y] of [[22, 22], [50, 12], [78, 22]]) {
      stick(c, 50, 60, x, y, 10, '#3f8a2f');
      circle(c, x, y, 13, '#4f9a3a', 3, '#2a5a1f');
      eyes(c, x, y - 1, 5, 3, true);
      c.fillStyle = '#ff8a1e';
      c.beginPath();
      c.arc(x, y + 8, 3, 0, TAU);
      c.fill();
    }
    blob(c, '#4f9a3a', () => c.ellipse(50, 70, 24, 22, 0, 0, TAU), 4, '#2a5a1f');
    blob(c, '#c9d98a', () => c.ellipse(50, 74, 12, 14, 0, 0, TAU), 0);
  },

  thistle(c) {
    for (const a of [-2.4, -0.7, 0.7, 2.4, Math.PI]) {
      blob(c, '#4f8a3a', () => {
        c.moveTo(50, 60);
        c.lineTo(50 + Math.sin(a) * 40, 60 - Math.cos(a) * 30);
        c.lineTo(50 + Math.sin(a + 0.4) * 20, 60 - Math.cos(a + 0.4) * 16);
        c.closePath();
      }, 3, '#2a5a1f');
    }
    blob(c, '#4f8a3a', () => c.ellipse(50, 50, 12, 10, 0, 0, TAU), 3, '#2a5a1f');
    c.strokeStyle = '#a24fc9';
    c.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.9 + (i * Math.PI * 0.8) / 8;
      c.beginPath();
      c.moveTo(50, 40);
      c.lineTo(50 + Math.cos(a) * 18, 40 + Math.sin(a) * 18);
      c.stroke();
    }
  },
  koschei: person({ skin: '#e8e2d0', body: '#1f1a26', trim: '#6a1f2a', legs: '#14101a', hat: 'crown', skull: true, item: 'sword', wide: 0.85 }),

  arrow(c) {
    // Points right.
    stick(c, 8, 50, 80, 50, 4, '#a0662d');
    blob(c, '#c9d0da', () => {
      c.moveTo(96, 50);
      c.lineTo(78, 40);
      c.lineTo(78, 60);
      c.closePath();
    }, 3);
    for (const s of [-1, 1]) {
      blob(c, '#e8e8e8', () => {
        c.moveTo(8, 50);
        c.lineTo(22, 50);
        c.lineTo(14, 50 + s * 12);
        c.lineTo(2, 50 + s * 12);
        c.closePath();
      }, 2);
    }
  },
  feather(c) {
    featherPaint(c, 50, 50, 1);
  },
  axe(c) {
    stick(c, 30, 88, 56, 22, 7, '#8a5a2b');
    blob(c, '#c9d0da', () => {
      c.moveTo(48, 20);
      c.quadraticCurveTo(84, 8, 86, 40);
      c.quadraticCurveTo(66, 36, 56, 46);
      c.closePath();
    }, 4, '#5a6270');
  },
  charm(c) {
    // A round amulet on a cord.
    circle(c, 50, 50, 38, '#e6b23a', 5, '#8a6410');
    circle(c, 50, 50, 26, '#c0392b', 3, '#7a1f1a');
    c.fillStyle = '#f4d03f';
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      c.beginPath();
      c.arc(50 + Math.cos(a) * 16, 50 + Math.sin(a) * 16, 4, 0, TAU);
      c.fill();
    }
    circle(c, 50, 50, 7, '#f4d03f', 2, '#8a6410');
  },
};

const cache = new Map<string, HTMLCanvasElement>();

// Returns the sprite drawn at `px` device pixels square, mirrored if `flip`.
// A `tint` colours it over, for the kinds that share a picture.
export function sprite(id: SpriteId, px: number, flip = false, tint?: string): HTMLCanvasElement {
  const size = Math.max(8, Math.round(px));
  const key = `${id}:${size}:${flip}:${tint ?? ''}`;
  let s = cache.get(key);
  if (!s) {
    s = document.createElement('canvas');
    s.width = s.height = size;
    const c = s.getContext('2d')!;
    if (flip) {
      c.translate(size, 0);
      c.scale(-1, 1);
    }
    const a = art(id);
    if (a) {
      // Hard pixel edges; the cell fills the box.
      const [img, [x, y, w, h]] = a;
      const k = size / Math.max(w, h);
      c.imageSmoothingEnabled = false;
      c.drawImage(img, x, y, w, h, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
    } else {
      c.scale(size / 100, size / 100);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      PAINT[id](c);
    }
    if (tint) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.globalAlpha = 0.38;
      c.fillStyle = tint;
      c.fillRect(0, 0, size, size);
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

// The heroes' pictures and sizes (the ids are still those of the cats).
export const HERO_SPRITE: Record<cats.HeroId, SpriteId> = { ryzhik: 'ilya', murka: 'vasilisa', barsik: 'dobrynya', snezhok: 'alyosha' };
export const HERO_SIZE: Record<cats.HeroId, number> = { ryzhik: 50, murka: 46, barsik: 54, snezhok: 46 };

export function heroSprite(hero: cats.HeroId, px: number, flip = false): HTMLCanvasElement {
  return sprite(HERO_SPRITE[hero], px, flip);
}
