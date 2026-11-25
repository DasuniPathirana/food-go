"use client";

import { useMemo } from "react";
import {
  BRIDGES, GARDENS, LANDMARKS, MAIN_AVENUE, RIVER, START_POINT, STREETS, STREET_LABELS,
  WORLD, type Garden, type Landmark,
} from "./world-layout";
import styles from "./world-art.module.css";

/**
 * Static illustration of inner Melbourne for the Explore surface.
 *
 * Generated deterministically from the shared world layout so the explorer, the
 * venue pins and this artwork agree on where the streets are. It is decorative:
 * it borrows real street geometry, not survey accuracy.
 */

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const WALLS = ["#e9b878", "#f2cf9a", "#dfa96b", "#f6dcb4", "#d89a63", "#f0c48c", "#e8c39a", "#cf9560"];
const ROOFS = ["#c9553a", "#b8452e", "#d96a45", "#a83d2c", "#e07a52", "#c2472f"];
const TEAL_ROOFS = ["#2f7d72", "#3f8f83", "#286a61"];
const GLASS = ["#9fd0d4", "#b6dcda", "#86bcc3"];
const LEAVES = ["#4f9440", "#63a94c", "#78ba58", "#427f37", "#8cc964"];
const BLOSSOM = ["#e88fb6", "#d97aa8", "#f0a8c8"];
const AWNINGS = ["#2f7d72", "#c9553a", "#e0a03c", "#3f6fb0", "#b34a7c"];

type Rect = { x: number; y: number; width: number; height: number };

function verticalEdges() {
  return [...STREETS.vertical].sort((a, b) => a.at - b.at)
    .map(street => ({ left: street.at - street.width / 2, right: street.at + street.width / 2, street }));
}
function horizontalEdges() {
  return [...STREETS.horizontal].sort((a, b) => a.at - b.at)
    .map(street => ({ top: street.at - street.width / 2, bottom: street.at + street.width / 2, street }));
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Every pocket between the streets, excluding the water and the gardens. */
function cityBlocks(): Rect[] {
  const columns: { start: number; end: number }[] = [];
  const vertical = verticalEdges();
  let cursor = 0;
  for (const street of vertical) {
    if (street.left - cursor > 24) columns.push({ start: cursor, end: street.left });
    cursor = street.right;
  }
  if (WORLD.width - cursor > 24) columns.push({ start: cursor, end: WORLD.width });

  const rows: { start: number; end: number }[] = [];
  const horizontal = horizontalEdges();
  let top = 0;
  for (const street of horizontal) {
    if (street.top - top > 24) rows.push({ start: top, end: street.top });
    top = street.bottom;
  }
  if (WORLD.height - top > 24) rows.push({ start: top, end: WORLD.height });

  const blocks: Rect[] = [];
  for (const row of rows) {
    for (const column of columns) {
      const rect = { x: column.start, y: row.start, width: column.end - column.start, height: row.end - row.start };
      if (rect.y + rect.height < RIVER.north - 80 || rect.y > RIVER.south + 80) {
        blocks.push(rect);
        continue;
      }
      if (rect.y < RIVER.north) {
        const height = RIVER.north - 96 - rect.y;
        if (height > 40) blocks.push({ ...rect, height });
      } else {
        const y = RIVER.south + 96;
        const height = rect.y + rect.height - y;
        if (height > 40) blocks.push({ ...rect, y, height });
      }
    }
  }
  return blocks.filter(block => block.width > 40 && block.height > 40);
}

function inGarden(rect: Rect) {
  return GARDENS.some(garden => overlaps(rect, { x: garden.x, y: garden.y, width: garden.width, height: garden.height }));
}

function tree(x: number, y: number, radius: number, leaf: string, blossom = false) {
  return `<g><ellipse cx="${x + 4}" cy="${y + radius * 0.78}" rx="${radius * 1.05}" ry="${radius * 0.38}" fill="#2f5334" opacity=".2"/>`
    + `<path d="M${x} ${y}v${radius * 0.8}" stroke="#6d5a3f" stroke-width="${Math.max(2.4, radius * 0.2)}" stroke-linecap="round"/>`
    + `<circle cx="${x}" cy="${y - radius * 0.24}" r="${radius}" fill="${leaf}"/>`
    + `<circle cx="${x - radius * 0.36}" cy="${y - radius * 0.48}" r="${radius * 0.72}" fill="${LEAVES[(Math.abs(x) | 0) % LEAVES.length]}"/>`
    + `<circle cx="${x + radius * 0.32}" cy="${y - radius * 0.52}" r="${radius * 0.6}" fill="#a6d67e" opacity=".85"/>`
    + (blossom ? `<g fill="#ffd7e8">${[0, 1, 2, 3].map(index => `<circle cx="${x - radius * 0.3 + index * radius * 0.22}" cy="${y - radius * 0.9 + (index % 2) * radius * 0.3}" r="${radius * 0.16}"/>`).join("")}</g>` : "")
    + `</g>`;
}

function flowerBed(x: number, y: number, width: number, seed: number) {
  const random = seeded(seed);
  let blooms = "";
  const count = Math.max(5, Math.round(width / 11));
  for (let index = 0; index < count; index++) {
    const px = x + random() * width;
    const py = y - 3 + random() * 9;
    const colour = ["#e88fb6", "#f0a8c8", "#f6cb62", "#c9a2e8", "#f28b6b"][Math.floor(random() * 5)];
    blooms += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(2 + random() * 2.4).toFixed(1)}" fill="${colour}"/>`;
  }
  return `<g><rect x="${x}" y="${y - 4}" width="${width}" height="12" rx="6" fill="#6da354"/>${blooms}</g>`;
}

function lamp(x: number, y: number, height: number) {
  return `<g><ellipse cx="${x}" cy="${y - height * 0.2}" rx="15" ry="11" fill="#ffdf9c" opacity=".16"/>`
    + `<ellipse cx="${x}" cy="${y}" rx="6" ry="2.4" fill="#2f5334" opacity=".22"/>`
    + `<path d="M${x} ${y}v-${height}" stroke="#4a5f52" stroke-width="3" stroke-linecap="round"/>`
    + `<circle cx="${x}" cy="${y - height}" r="7" fill="#ffeec4" opacity=".35"/>`
    + `<circle cx="${x}" cy="${y - height}" r="3.6" fill="#fff6d8"/>`
    + `<path d="M${x - 5} ${y - height - 3}h10" stroke="#3d4f45" stroke-width="2.2" stroke-linecap="round"/></g>`;
}

function awning(x: number, y: number, width: number, colour: string) {
  const stripes = Math.max(2, Math.round(width / 11));
  let planks = "";
  for (let index = 0; index < stripes; index++) {
    const stripeWidth = width / stripes;
    planks += `<rect x="${(x + index * stripeWidth).toFixed(1)}" y="${y}" width="${(stripeWidth + 0.5).toFixed(1)}" height="10" fill="${index % 2 ? "#fff6e2" : colour}"/>`;
  }
  return `<g>${planks}<rect x="${x}" y="${y + 10}" width="${width}" height="2.6" fill="#00000026"/></g>`;
}

function windowGrid(x: number, y: number, width: number, height: number, seed: number) {
  const random = seeded(seed);
  const columns = Math.max(1, Math.floor(width / 20));
  const rows = Math.max(1, Math.floor(height / 24));
  const cellWidth = (width - 12) / columns;
  const cellHeight = (height - 12) / rows;
  let out = "";
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const px = x + 6 + column * cellWidth;
      const py = y + 8 + row * cellHeight;
      const on = random() > 0.34;
      out += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${Math.max(4, cellWidth - 6).toFixed(1)}" height="${Math.max(5, cellHeight - 8).toFixed(1)}" rx="1.4" fill="${on ? "#ffd27a" : "#6f6350"}" opacity="${on ? 0.95 : 0.34}"/>`;
    }
  }
  return out;
}

type BuildingSpec = {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  seed: number;
  awningColour?: string;
  shopfront?: boolean;
};

function building(spec: BuildingSpec) {
  const { x, y, width, height, depth, seed } = spec;
  const random = seeded(seed);
  const wall = WALLS[Math.floor(random() * WALLS.length)];
  const roof = random() > 0.78 ? TEAL_ROOFS[Math.floor(random() * TEAL_ROOFS.length)] : ROOFS[Math.floor(random() * ROOFS.length)];
  const top = y - height;
  const lift = Math.round(depth * 0.5);
  const rise = Math.round(depth * 0.7);
  const random2 = seeded(seed + 991);
  const props: string[] = [];
  if (random2() > 0.55) props.push(`<ellipse cx="${x + width * 0.3 + lift * 0.5}" cy="${top - rise * 0.55}" rx="7" ry="3.2" fill="#5d7d6c" opacity=".8"/>`);
  if (random2() > 0.6) props.push(`<rect x="${x + width * 0.58 + lift * 0.4}" y="${top - rise * 0.8}" width="9" height="8" rx="2" fill="#9aa89a"/>`);
  if (random2() > 0.7) props.push(`<circle cx="${x + width * 0.76 + lift * 0.4}" cy="${top - rise * 0.5}" r="5" fill="#78ba58" opacity=".9"/>`);
  const shopY = y - 20;
  const shop = spec.shopfront && height > 46
    ? `<rect x="${x + 2}" y="${shopY}" width="${width - 4}" height="18" rx="2" fill="#3c3227"/>`
      + `<rect x="${x + 5}" y="${shopY + 3}" width="${width - 10}" height="12" rx="2" fill="#ffcf7d" opacity=".92"/>`
      + (spec.awningColour && width > 24 ? awning(x + 1, shopY - 11, width - 2, spec.awningColour) : "")
    : "";
  return `<g>`
    + `<ellipse cx="${x + width / 2 + lift * 0.6}" cy="${y + 2}" rx="${width * 0.6 + 6}" ry="${Math.max(6, depth * 0.3)}" fill="#2f4a2e" opacity=".22"/>`
    + `<polygon points="${x + width},${top} ${x + width + lift},${top - rise} ${x + width + lift},${y - rise} ${x + width},${y}" fill="#8d6242"/>`
    + `<rect x="${x}" y="${top}" width="${width}" height="${height}" fill="${wall}"/>`
    + `<rect x="${x}" y="${top}" width="${width}" height="${height}" fill="url(#fgw-wallShade)"/>`
    + `<polygon points="${x},${top} ${x + width},${top} ${x + width + lift},${top - rise} ${x + lift},${top - rise}" fill="${roof}"/>`
    + `<polygon points="${x},${top} ${x + width},${top} ${x + width + lift},${top - rise} ${x + lift},${top - rise}" fill="url(#fgw-roofLight)"/>`
    + `<rect x="${x}" y="${top}" width="${width}" height="4" fill="#00000022"/>`
    + props.join("")
    + (height > 34 ? windowGrid(x, top + 5, width, Math.min(height - 8, shopY - top - 4), seed + 3) : "")
    + shop
    + `</g>`;
}

/** People scattered along the footpaths. Small marks that make the city feel used. */
function drawPeople(seed: number) {
  const random = seeded(seed);
  const shades = ["#e06a4e", "#2f7d72", "#e0a03c", "#3f6fb0", "#b34a7c", "#6a8f4e"];
  const out: string[] = [];
  for (const street of STREETS.horizontal) {
    for (let x = 70; x < WORLD.width - 60; x += 44) {
      if (random() < 0.62) continue;
      const py = street.at + street.width / 2 + 9 + random() * 5;
      out.push(`<g><circle cx="${x}" cy="${py}" r="2.6" fill="#3c3230"/><rect x="${x - 2.6}" y="${py + 2.4}" width="5.2" height="6" rx="2.4" fill="${shades[Math.floor(random() * shades.length)]}"/></g>`);
    }
  }
  for (const street of STREETS.vertical) {
    for (let y = 110; y < RIVER.north - 80; y += 52) {
      if (random() < 0.7) continue;
      const px = street.at + street.width / 2 + 10 + random() * 5;
      out.push(`<g><circle cx="${px}" cy="${y}" r="2.6" fill="#3c3230"/><rect x="${px - 2.6}" y="${y + 2.4}" width="5.2" height="6" rx="2.4" fill="${shades[Math.floor(random() * shades.length)]}"/></g>`);
    }
  }
  return out.join("");
}

function blockCluster(block: Rect, seed: number) {
  const random = seeded(seed);
  const out: string[] = [];
  const inset = 6;
  const inner = {
    x: block.x + inset,
    y: block.y + inset,
    width: block.width - inset * 2,
    height: block.height - inset * 2,
  };
  out.push(`<rect x="${inner.x}" y="${inner.y}" width="${inner.width}" height="${inner.height}" rx="7" fill="#ebd9b4"/>`);
  out.push(`<rect x="${inner.x}" y="${inner.y}" width="${inner.width}" height="${inner.height}" rx="7" fill="url(#fgw-paper)"/>`);

  const columns = Math.max(2, Math.round(inner.width / 58));
  const rows = Math.max(1, Math.round(inner.height / 54));
  const cellWidth = inner.width / columns;
  const cellHeight = inner.height / rows;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cell = seeded(seed + row * 131 + column * 71);
      const x = inner.x + column * cellWidth;
      const y = inner.y + row * cellHeight;
      const roll = cell();
      if (roll < 0.12 && rows > 1) {
        // Pocket courtyard with a tree and flowers.
        out.push(`<rect x="${x + 1.5}" y="${y + 1.5}" width="${cellWidth - 3}" height="${cellHeight - 3}" rx="4" fill="#b9d894"/>`);
        out.push(tree(x + cellWidth * 0.5, y + cellHeight - 7, Math.min(15, cellWidth * 0.3), LEAVES[(row + column) % LEAVES.length]));
        out.push(flowerBed(x + cellWidth * 0.18, y + cellHeight - 8, cellWidth * 0.3, seed + row + column));
        continue;
      }
      const height = 28 + cell() * (row === 0 ? Math.min(92, cellHeight * 0.95) : Math.min(58, cellHeight * 0.9));
      out.push(building({
        x: x + 1.5,
        y: y + cellHeight - 1.5,
        width: Math.max(20, cellWidth - 3),
        height,
        depth: 12 + cell() * 10,
        seed: seed + row * 733 + column * 149,
        shopfront: row === rows - 1,
        awningColour: cell() > 0.5 ? AWNINGS[Math.floor(cell() * AWNINGS.length)] : undefined,
      }));
    }
  }
  // A tree or two tucked wherever there is a gap.
  if (random() > 0.5) {
    out.push(tree(block.x + block.width * 0.5 + random() * 20, block.y + block.height - 4, Math.min(13, block.width * 0.09), LEAVES[seed % LEAVES.length]));
  }
  return out.join("");
}

/** The explorer's home square: paved, planted, with a working fountain. */
function drawPlazaBlock(block: Rect) {
  const cx = block.x + block.width / 2;
  const cy = block.y + block.height / 2;
  const out: string[] = [];
  out.push(`<rect x="${block.x + 4}" y="${block.y + 4}" width="${block.width - 8}" height="${block.height - 8}" rx="12" fill="#efdcb8"/>`);
  for (let ring = 1; ring <= 3; ring++) {
    out.push(`<circle cx="${cx}" cy="${cy}" r="${ring * 26}" fill="none" stroke="#e0c79c" stroke-width="4" opacity=".8"/>`);
  }
  out.push(`<circle cx="${cx}" cy="${cy}" r="34" fill="#7fc6d4"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#f8ecd2" stroke-width="6"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="14" fill="#d6f7fb" opacity=".85"/>`);
  out.push(`<g stroke="#d6f7fb" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M${cx - 12} ${cy - 20}q-6-16 2-26"/><path d="M${cx + 12} ${cy - 20}q6-16-2-26"/></g>`);
  const corners: [number, number][] = [
    [block.x + 20, block.y + 22], [block.x + block.width - 22, block.y + 22],
    [block.x + 20, block.y + block.height - 20], [block.x + block.width - 22, block.y + block.height - 20],
  ];
  for (const [x, y] of corners) {
    out.push(tree(x, y, 13, LEAVES[(x | 0) % LEAVES.length], true));
  }
  out.push(`<g><rect x="${block.x + 14}" y="${cy + 34}" width="28" height="8" rx="2.5" fill="#9c6a3c"/></g>`);
  out.push(`<g><rect x="${block.x + block.width - 44}" y="${cy + 34}" width="28" height="8" rx="2.5" fill="#9c6a3c"/></g>`);
  out.push(flowerBed(block.x + 12, block.y + block.height - 12, block.width * 0.24, 71));
  out.push(flowerBed(block.x + block.width * 0.62, block.y + block.height - 12, block.width * 0.24, 83));
  return out.join("");
}

function drawGardens(garden: Garden, seed: number) {
  const random = seeded(seed);
  const out: string[] = [];
  out.push(`<rect x="${garden.x}" y="${garden.y}" width="${garden.width}" height="${garden.height}" rx="24" fill="#7dbb5e"/>`);
  out.push(`<rect x="${garden.x}" y="${garden.y}" width="${garden.width}" height="${garden.height}" rx="24" fill="url(#fgw-grass)"/>`);
  out.push(`<rect x="${garden.x + 6}" y="${garden.y + 6}" width="${garden.width - 12}" height="${garden.height - 12}" rx="20" fill="none" stroke="#5c963f" stroke-width="3" opacity=".45"/>`);
  const path = `M${garden.x + garden.width * 0.16} ${garden.y + garden.height * 0.16}C${garden.x + garden.width * 0.54} ${garden.y + garden.height * 0.02} ${garden.x + garden.width * 0.4} ${garden.y + garden.height * 0.52} ${garden.x + garden.width * 0.72} ${garden.y + garden.height * 0.62}S${garden.x + garden.width * 0.56} ${garden.y + garden.height * 0.96} ${garden.x + garden.width * 0.26} ${garden.y + garden.height * 0.88}`;
  out.push(`<path d="${path}" fill="none" stroke="#f4e3bb" stroke-width="18" stroke-linecap="round"/>`);
  out.push(`<path d="${path}" fill="none" stroke="#cbb083" stroke-width="1.8" stroke-dasharray="7 11" opacity=".7"/>`);
  if (garden.pond) {
    out.push(`<ellipse cx="${garden.pond.x}" cy="${garden.pond.y}" rx="${garden.pond.rx}" ry="${garden.pond.ry}" fill="#3aa8b8"/>`);
    out.push(`<ellipse cx="${garden.pond.x}" cy="${garden.pond.y}" rx="${garden.pond.rx * 0.84}" ry="${garden.pond.ry * 0.78}" fill="#69cbd8" opacity=".8"/>`);
    out.push(`<ellipse cx="${garden.pond.x - 8}" cy="${garden.pond.y - 6}" rx="${garden.pond.rx * 0.3}" ry="${garden.pond.ry * 0.28}" fill="#d2f6fa" opacity=".8"/>`);
    out.push(`<ellipse cx="${garden.pond.x}" cy="${garden.pond.y}" rx="${garden.pond.rx + 6}" ry="${garden.pond.ry + 6}" fill="none" stroke="#f4e3bb" stroke-width="5"/>`);
    for (let index = 0; index < 6; index++) {
      const angle = random() * Math.PI * 2;
      const px = garden.pond.x + Math.cos(angle) * garden.pond.rx * 0.68;
      const py = garden.pond.y + Math.sin(angle) * garden.pond.ry * 0.62;
      out.push(`<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="4.6" ry="2.9" fill="#4f9440"/>`);
    }
  }
  const treeCount = Math.max(8, Math.round((garden.width * garden.height) / 4200));
  for (let index = 0; index < treeCount; index++) {
    const px = garden.x + 20 + random() * (garden.width - 40);
    const py = garden.y + 28 + random() * (garden.height - 46);
    if (garden.pond && Math.hypot(px - garden.pond.x, py - garden.pond.y) < garden.pond.rx + 24) continue;
    const blossom = random() > 0.72;
    out.push(tree(px, py, 10 + random() * 13, blossom ? BLOSSOM[Math.floor(random() * BLOSSOM.length)] : LEAVES[Math.floor(random() * LEAVES.length)], blossom));
  }
  for (let index = 0; index < 5; index++) {
    out.push(flowerBed(garden.x + 12 + index * (garden.width / 5.4), garden.y + garden.height - 18, garden.width / 8, seed + index));
  }
  out.push(`<g><rect x="${garden.x + garden.width * 0.22}" y="${garden.y + garden.height * 0.6}" width="26" height="7" rx="2" fill="#9c6a3c"/><rect x="${garden.x + garden.width * 0.6}" y="${garden.y + garden.height * 0.42}" width="26" height="7" rx="2" fill="#9c6a3c"/></g>`);
  return out.join("");
}

function drawRiver() {
  const north = RIVER.north, south = RIVER.south;
  const water = `M-40 ${north + 20}C 220 ${north - 28} 470 ${north + 34} 760 ${north + 2}C 1030 ${north - 28} 1280 ${north - 52} 1520 ${north - 26}C 1660 ${north - 10} 1750 ${north + 14} 1840 ${north + 2}`
    + `L1840 ${south + 20}C 1750 ${south + 34} 1660 ${south + 10} 1520 ${south - 6}C 1280 ${south - 32} 1030 ${south - 10} 760 ${south + 20}C 470 ${south + 52} 220 ${south - 10} -40 ${south + 38}Z`;
  const out: string[] = [`<path d="${water}" fill="url(#fgw-water)"/>`];
  for (let index = 0; index < 26; index++) {
    const y = north + 22 + ((index * 67) % (south - north - 34));
    const x = -20 + ((index * 137) % 1840);
    out.push(`<path d="M${x} ${y}q30 ${index % 2 ? 7 : -7} 60 0" fill="none" stroke="#d6f7fb" stroke-width="${index % 3 ? 2 : 3}" stroke-linecap="round" opacity="${index % 3 ? 0.34 : 0.52}"/>`);
  }
  for (let index = 0; index < 12; index++) {
    const x = 120 + ((index * 173) % 1560);
    const y = north + 40 + ((index * 44) % 84);
    out.push(`<rect x="${x}" y="${y}" width="4" height="24" rx="2" fill="#ffe1a1" opacity=".26"/>`);
  }
  out.push(`<g transform="translate(210 ${south - 72})"><path d="M0 8q46 20 92 0l-13 22H12Z" fill="#f6e6c6"/><path d="M8 8q38 15 76 0l-7 10H14Z" fill="#b9eef6"/><rect x="24" y="-12" width="42" height="20" rx="4" fill="#fff6e2"/><rect x="30" y="-9" width="11" height="8" rx="2" fill="#ffd27a"/><rect x="46" y="-9" width="11" height="8" rx="2" fill="#ffd27a"/><path d="M2 32h86" stroke="#d6f7fb" stroke-width="3" stroke-linecap="round" opacity=".66"/></g>`);
  for (let index = 0; index < 30; index++) {
    const x = 30 + ((index * 89) % 1740);
    const bankY = index % 2 ? north + 14 : south - 2;
    out.push(`<path d="M${x} ${bankY}q-3-15 2-23m5 23q4-13-1-19" stroke="#3f7f36" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>`);
  }
  out.push(`<path d="M-40 ${north + 20}C 220 ${north - 28} 470 ${north + 34} 760 ${north + 2}C 1030 ${north - 28} 1280 ${north - 52} 1520 ${north - 26}C 1660 ${north - 10} 1750 ${north + 14} 1840 ${north + 2}" fill="none" stroke="#e9d5ac" stroke-width="11"/>`);
  out.push(`<path d="M-40 ${south + 38}C 220 ${south - 10} 470 ${south + 52} 760 ${south + 20}C 1030 ${south - 10} 1280 ${south - 32} 1520 ${south - 6}C 1660 ${south + 10} 1750 ${south + 34} 1840 ${south + 20}" fill="none" stroke="#e9d5ac" stroke-width="11"/>`);
  return out.join("");
}

function drawSouthbank() {
  const shore = 1024;
  const promenade = (x: number) => 1046 + 6 * Math.sin(x / 300);
  const points: string[] = [];
  for (let x = -40; x <= 1840; x += 40) points.push(`${x},${promenade(x).toFixed(1)}`);
  const out: string[] = [];
  out.push(`<rect x="-40" y="${shore}" width="${WORLD.width + 80}" height="${WORLD.height - shore + 40}" fill="#e7d8b4"/>`);
  out.push(`<rect x="-40" y="${shore}" width="${WORLD.width + 80}" height="8" fill="#d9c49b"/>`);
  out.push(`<path d="M${points.join(" L")}" fill="none" stroke="#f6e7c9" stroke-width="30" stroke-linecap="round"/>`);
  out.push(`<path d="M${points.join(" L")}" fill="none" stroke="#d9c49b" stroke-width="1.6" stroke-dasharray="9 13" transform="translate(0 7)"/>`);
  for (let index = 0; index < 18; index++) {
    const x = 34 + index * 98;
    const y = promenade(x) + 24;
    if (index % 3 === 0) out.push(tree(x, y, 11, LEAVES[(x | 0) % LEAVES.length]));
    else if (index % 3 === 1) out.push(lamp(x, y, 20));
    else out.push(`<g><rect x="${x - 13}" y="${y - 15}" width="26" height="14" rx="3" fill="#f2cf9a"/><polygon points="${x - 16},${y - 15} ${x + 16},${y - 15} ${x + 11},${y - 24} ${x - 11},${y - 24}" fill="#c9553a"/><rect x="${x - 7}" y="${y - 11}" width="14" height="6" rx="2" fill="#ffd27a"/></g>`);
  }
  return out.join("");
}

function drawBridge(x: number, width: number, name: string) {
  const top = RIVER.north - 18, bottom = RIVER.south + 34;
  const left = x - width / 2;
  let deck = "";
  for (let index = 0; index < 6; index++) {
    const py = top + 18 + index * ((bottom - top - 32) / 5);
    deck += `<rect x="${left + 6}" y="${py}" width="${width - 12}" height="3" rx="1.5" fill="#d3bb92" opacity=".75"/>`;
  }
  let arches = "";
  for (let index = 0; index < 3; index++) {
    const ay = top + 34 + index * 44;
    arches += `<path d="M${left + 8} ${ay}q${width / 2 - 8} 20 ${width - 16} 0" fill="none" stroke="#1c6f80" stroke-width="5" opacity=".5"/>`;
  }
  return `<g>`
    + `<rect x="${left}" y="${top}" width="${width}" height="${bottom - top}" rx="6" fill="#eed9b2"/>`
    + `<rect x="${left}" y="${top}" width="${width}" height="${bottom - top}" rx="6" fill="none" stroke="#c9ae83" stroke-width="2.5"/>`
    + deck + arches
    + `<rect x="${left - 2}" y="${top}" width="6" height="${bottom - top}" fill="#f8ecd2"/>`
    + `<rect x="${left + width - 4}" y="${top}" width="6" height="${bottom - top}" fill="#f8ecd2"/>`
    + lamp(left + 7, top + 14, 18) + lamp(left + width - 7, top + 14, 18)
    + lamp(left + 7, bottom - 16, 18) + lamp(left + width - 7, bottom - 16, 18)
    + `<ellipse cx="${x}" cy="${bottom}" rx="${width * 0.5}" ry="9" fill="#123f34" opacity=".16"/>`
    + `<text x="${x}" y="${top + 12}" text-anchor="middle" font-size="10" letter-spacing="1.5" fill="#8a7f6d">${name.toUpperCase()}</text>`
    + `</g>`;
}

function drawLandmark(landmark: Landmark) {
  const { x, y, width, height } = landmark;
  const cx = x + width / 2;
  if (landmark.kind === "station") {
    return `<g>`
      + `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="#efd3a4"/>`
      + `<rect x="${x}" y="${y}" width="${width}" height="5" fill="#fbf0d8"/>`
      + `<polygon points="${x - 4},${y + 2} ${x + width + 4},${y + 2} ${x + width + 16},${y - 20} ${x + 12},${y - 20}" fill="#2f7d72"/>`
      + `<polygon points="${x - 4},${y + 2} ${x + width + 4},${y + 2} ${x + width + 16},${y - 20} ${x + 12},${y - 20}" fill="url(#fgw-roofLight)"/>`
      // Clock tower with a dome and lantern.
      + `<rect x="${cx - 4}" y="${y - 74}" width="26" height="60" rx="3" fill="#f6e3c2"/>`
      + `<rect x="${cx - 4}" y="${y - 74}" width="26" height="60" rx="3" fill="url(#fgw-wallShade)"/>`
      + `<circle cx="${cx + 9}" cy="${y - 60}" r="11" fill="#fbf0d8" stroke="#b99a6c" stroke-width="2"/>`
      + `<circle cx="${cx + 9}" cy="${y - 60}" r="6" fill="#fffaf0"/>`
      + `<path d="M${cx + 9} ${y - 60}v-4m0 4 3 2.4" stroke="#8a7f6d" stroke-width="1.8" stroke-linecap="round"/>`
      + `<ellipse cx="${cx + 9}" cy="${y - 78}" rx="16" ry="9" fill="#2f7d72"/>`
      + `<ellipse cx="${cx + 9}" cy="${y - 82}" rx="16" ry="9" fill="#3f8f83"/>`
      + `<path d="M${cx + 9} ${y - 92}v-10" stroke="#8a7f6d" stroke-width="2.4"/>`
      + `<circle cx="${cx + 9}" cy="${y - 104}" r="3" fill="#f6cb62"/>`
      // Arcaded facade.
      + `<g fill="#22685f" opacity=".55">${Array.from({ length: 9 }, (_, index) => `<rect x="${x + 12 + index * ((width - 24) / 9)}" y="${y + 12}" width="${width / 16}" height="${height * 0.5}" rx="8"/>`).join("")}</g>`
      + `<rect x="${x + 8}" y="${y + height - 14}" width="${width - 16}" height="9" rx="4.5" fill="#ffd27a" opacity=".95"/>`
      + `<path d="M${x + 8} ${y + height - 14}h${width - 16}" stroke="#c9a76f" stroke-width="2"/>`
      + `</g>`;
  }
  if (landmark.kind === "hall") {
    return `<g><rect x="${x + 10}" y="${y + 20}" width="${width - 20}" height="${height - 20}" rx="5" fill="#f2cf9a"/>`
      + `<polygon points="${x + 10},${y + 20} ${x + width - 10},${y + 20} ${x + width - 2},${y + 11} ${x + 18},${y + 11}" fill="#8cc964"/>`
      + `<ellipse cx="${cx}" cy="${y + 10}" rx="${width * 0.35}" ry="${height * 0.3}" fill="#2f7d72"/>`
      + `<ellipse cx="${cx}" cy="${y + 6}" rx="${width * 0.35}" ry="${height * 0.3}" fill="#3f8f83"/>`
      + `<ellipse cx="${cx}" cy="${y - 6}" rx="${width * 0.11}" ry="${height * 0.13}" fill="#f8ecd2"/>`
      + `<path d="M${cx} ${y - 14}v-10" stroke="#8a7f6d" stroke-width="3"/>`
      + `<g fill="#c9553a" opacity=".85">${Array.from({ length: 6 }, (_, index) => `<rect x="${x + 20 + index * ((width - 40) / 6)}" y="${y + 36}" width="${width / 15}" height="${height * 0.42}" rx="5"/>`).join("")}</g></g>`;
  }
  if (landmark.kind === "market") {
    return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="#f2cf9a"/>`
      + awning(x + 3, y + 8, width - 6, "#c9553a")
      + awning(x + 3, y + 38, width - 6, "#2f7d72")
      + `<g fill="#b8452e">${Array.from({ length: 6 }, (_, index) => `<rect x="${x + 8 + index * ((width - 16) / 6)}" y="${y + height - 26}" width="${width / 11}" height="18" rx="3"/>`).join("")}</g>`
      + `<rect x="${cx - 20}" y="${y - 12}" width="40" height="12" rx="3" fill="#c9a37a"/>`
      + `<text x="${cx}" y="${y - 2}" text-anchor="middle" font-size="8" letter-spacing="1" fill="#fff6e2">MARKET</text></g>`;
  }
  if (landmark.kind === "tower") {
    return `<g><rect x="${x + 14}" y="${y + 24}" width="${width - 28}" height="${height - 24}" rx="7" fill="#7cb8bd"/>`
      + `<rect x="${x + 14}" y="${y + 24}" width="${width - 28}" height="${height - 24}" rx="7" fill="url(#fgw-glass)"/>`
      + `<polygon points="${x + 14},${y + 24} ${x + width - 14},${y + 24} ${x + width - 5},${y + 14} ${x + 23},${y + 14}" fill="#5d9aa1"/>`
      + `<rect x="${cx - 24}" y="${y - 14}" width="48" height="28" rx="5" fill="#f2cf9a"/>`
      + `<circle cx="${cx}" cy="${y - 2}" r="8" fill="#ffd27a"/></g>`;
  }
  if (landmark.kind === "plaza") {
    return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="#e6cfa4"/>`
      // Faceted shards like Federation Square.
      + `<polygon points="${x + 6},${y + height - 8} ${x + 44},${y + 2} ${x + 74},${y + height - 6}" fill="#9fb4b2"/>`
      + `<polygon points="${x + 44},${y + 2} ${x + 74},${y + height - 6} ${x + 62},${y + height - 2} ${x + 34},${y + 8}" fill="#7d9492" opacity=".8"/>`
      + `<polygon points="${x + 62},${y + height - 4} ${x + 96},${y + 8} ${x + width - 6},${y + height - 8}" fill="#b9c9c4"/>`
      + `<polygon points="${x + 96},${y + 8} ${x + width - 6},${y + height - 8} ${x + width - 16},${y + height - 2} ${x + 84},${y + 14}" fill="#8aa3a0" opacity=".8"/>`
      + tree(x + 14, y + height - 8, 11, LEAVES[2]) + tree(x + width - 14, y + height - 8, 10, LEAVES[0]) + `</g>`;
  }
  return `<g><rect x="${x}" y="${y + 14}" width="${width}" height="${height - 14}" rx="4" fill="#e9b878"/>`
    + awning(x - 2, y + 6, width + 4, "#b8452e")
    + `<g fill="#ffd27a">${Array.from({ length: 8 }, (_, index) => `<circle cx="${x + 5 + index * ((width - 10) / 7)}" cy="${y}" r="3.2"/>`).join("")}</g>`
    + `<path d="M${x} ${y}v0q${width / 2} 10 ${width} 0" fill="none" stroke="#8a7f6d" stroke-width="1.3"/>`
    + `<rect x="${x + 8}" y="${y + height - 20}" width="${width - 16}" height="13" rx="3" fill="#2f7d72" opacity=".85"/></g>`;
}

function drawStreets() {
  const out: string[] = [];
  for (const street of STREETS.vertical) {
    const left = street.at - street.width / 2;
    out.push(`<rect x="${left}" y="-20" width="${street.width}" height="${WORLD.height + 40}" fill="#f2e0bd"/>`);
    out.push(`<rect x="${left}" y="-20" width="3" height="${WORLD.height + 40}" fill="#d6bd92"/>`);
    out.push(`<rect x="${left + street.width - 3}" y="-20" width="3" height="${WORLD.height + 40}" fill="#d6bd92"/>`);
    out.push(`<path d="M${street.at} -20v${WORLD.height + 40}" stroke="#fff8ea" stroke-width="2.4" stroke-dasharray="16 15" opacity=".9"/>`);
  }
  for (const street of STREETS.horizontal) {
    const top = street.at - street.width / 2;
    out.push(`<rect x="-20" y="${top}" width="${WORLD.width + 40}" height="${street.width}" fill="#f2e0bd"/>`);
    out.push(`<rect x="-20" y="${top}" width="${WORLD.width + 40}" height="3" fill="#d6bd92"/>`);
    out.push(`<rect x="-20" y="${top + street.width - 3}" width="${WORLD.width + 40}" height="3" fill="#d6bd92"/>`);
    out.push(`<path d="M-20 ${street.at}h${WORLD.width + 40}" stroke="#fff8ea" stroke-width="2.4" stroke-dasharray="16 15" opacity=".9"/>`);
  }
  const avenue = MAIN_AVENUE.at;
  out.push(`<path d="M${avenue - 13} -20V${RIVER.north}" stroke="#b9a888" stroke-width="2.2" opacity=".75"/>`);
  out.push(`<path d="M${avenue + 13} -20V${RIVER.north}" stroke="#b9a888" stroke-width="2.2" opacity=".75"/>`);
  for (const street of STREETS.horizontal) {
    for (const vertical of STREETS.vertical) {
      const half = vertical.width / 2;
      let stripes = "";
      for (let index = 0; index < 5; index++) {
        stripes += `<rect x="${vertical.at - half + 5 + index * ((vertical.width - 10) / 5)}" y="${street.at - street.width / 2 - 4}" width="${(vertical.width - 14) / 5}" height="${street.width + 8}" fill="#fff8ea" opacity=".85"/>`;
      }
      out.push(`<g opacity=".5">${stripes}</g>`);
    }
  }
  return out.join("");
}

function drawStreetFurniture(seed: number) {
  const random = seeded(seed);
  const out: string[] = [];
  for (const street of STREETS.vertical) {
    for (let y = 96; y < RIVER.north - 60; y += 148) {
      out.push(lamp(street.at - street.width / 2 - 7, y, 22));
      out.push(lamp(street.at + street.width / 2 + 7, y + 74, 22));
      if (random() > 0.55) out.push(tree(street.at + street.width / 2 + 17, y + 36, 10, LEAVES[Math.floor(random() * LEAVES.length)]));
      if (random() > 0.66) out.push(tree(street.at - street.width / 2 - 17, y + 18, 9, LEAVES[Math.floor(random() * LEAVES.length)]));
    }
  }
  for (const street of STREETS.horizontal) {
    for (let x = 50; x < WORLD.width - 40; x += 168) {
      out.push(lamp(x, street.at - street.width / 2 - 8, 20));
      if (random() > 0.66) {
        const px = x + 18, py = street.at + street.width / 2 + 14;
        out.push(`<g><ellipse cx="${px}" cy="${py + 8}" rx="17" ry="6" fill="#123f34" opacity=".14"/><path d="M${px - 16} ${py}q16-13 32 0Z" fill="#f6cb62"/><path d="M${px - 16} ${py}q16-13 32 0" fill="none" stroke="#c99a3c" stroke-width="1.5"/><path d="M${px} ${py}v-10" stroke="#8a7f6d" stroke-width="2"/><circle cx="${px - 9}" cy="${py + 5}" r="3.2" fill="#2f7d72"/><circle cx="${px + 9}" cy="${py + 5}" r="3.2" fill="#2f7d72"/></g>`);
      }
    }
  }
  for (let index = 0; index < 12; index++) {
    const x = 140 + index * 92;
    const y = 520 + Math.sin(index) * 6;
    out.push(`<g><path d="M${x} ${y}q18 8 36 0" fill="none" stroke="#8a7f6d" stroke-width="1.1"/><polygon points="${x + 11},${y + 2} ${x + 21},${y + 2} ${x + 16},${y + 11}" fill="${index % 2 ? "#e88fb6" : "#f6cb62"}"/></g>`);
  }
  return out.join("");
}

function drawAtmosphere() {
  return `<g pointer-events="none">`
    + `<rect x="0" y="0" width="${WORLD.width}" height="${WORLD.height}" fill="url(#fgw-warm)"/>`
    + `<ellipse cx="1500" cy="120" rx="420" ry="240" fill="#ffd98a" opacity=".16"/>`
    + `<ellipse cx="260" cy="900" rx="380" ry="220" fill="#9fd0d4" opacity=".1"/>`
    + `<g fill="#123f34" opacity=".45"><path d="m330 132 12 4-10 3Z"/><path d="m372 120 10 5-11 2Z"/><path d="m1300 92 11 4-10 3Z"/></g>`
    + `<g fill="#ffeec4">${Array.from({ length: 16 }, (_, index) => { const x = 90 + ((index * 233) % 1620), y = 60 + ((index * 137) % 900), r = 2 + (index % 3); return `<circle cx="${x}" cy="${y}" r="${r}" opacity="${(0.1 + (index % 4) * 0.04).toFixed(2)}"/>`; }).join("")}</g>`
    + `<rect x="0" y="0" width="${WORLD.width}" height="${WORLD.height}" fill="url(#fgw-vignette)"/>`
    + `</g>`;
}

function drawScene() {
  const blocks = cityBlocks();
  const out: string[] = [];

  out.push(`<rect x="0" y="0" width="${WORLD.width}" height="${WORLD.height}" fill="#e9dbba"/>`);
  out.push(`<rect x="0" y="0" width="${WORLD.width}" height="${WORLD.height}" fill="url(#fgw-paper)"/>`);
  out.push(drawStreets());

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (inGarden(block)) continue;
    // Keep the explorer's starting block open and paved.
    const insideStart = START_POINT.x > block.x && START_POINT.x < block.x + block.width
      && START_POINT.y > block.y && START_POINT.y < block.y + block.height;
    if (insideStart) {
      out.push(drawPlazaBlock(block));
      continue;
    }
    out.push(blockCluster(block, 1013 + index * 37));
  }

  for (const garden of GARDENS) out.push(drawGardens(garden, 4571 + garden.x));
  out.push(drawRiver());
  out.push(drawSouthbank());
  for (const bridge of BRIDGES) out.push(drawBridge(bridge.x, bridge.width, bridge.name));
  for (const landmark of LANDMARKS) out.push(drawLandmark(landmark));
  out.push(drawStreetFurniture(9421));
  out.push(drawPeople(7717));

  for (const label of STREET_LABELS) {
    out.push(label.rotate
      ? `<text x="${label.x}" y="${label.y}" transform="rotate(${label.rotate} ${label.x} ${label.y})" font-size="12" letter-spacing="3.2" fill="#8a7a5f" opacity=".9">${label.text.toUpperCase()}</text>`
      : `<text x="${label.x}" y="${label.y}" font-size="12" letter-spacing="3.2" fill="#8a7a5f" opacity=".9">${label.text.toUpperCase()}</text>`);
  }
  out.push(`<text x="${START_POINT.x + 58}" y="${START_POINT.y - 62}" font-size="11" letter-spacing="2.4" fill="#4f7a5b" opacity=".95">CITY SQUARE</text>`);

  out.push(drawAtmosphere());
  return out.join("");
}

export function WorldArt({ className }: { className?: string }) {
  const content = useMemo(() => drawScene(), []);
  return (
    <svg
      className={[styles.art, className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
      width={WORLD.width}
      height={WORLD.height}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="fgw-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d7d90" />
          <stop offset="0.4" stopColor="#156877" />
          <stop offset="1" stopColor="#1c7a8c" />
        </linearGradient>
        <linearGradient id="fgw-wallShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#5d3a1c" stopOpacity="0.26" />
        </linearGradient>
        <linearGradient id="fgw-roofLight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="fgw-warm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe0a8" stopOpacity="0.18" />
          <stop offset="0.55" stopColor="#ffd98a" stopOpacity="0.04" />
          <stop offset="1" stopColor="#e17fa8" stopOpacity="0.07" />
        </linearGradient>
        <linearGradient id="fgw-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2fbfd" stopOpacity="0.8" />
          <stop offset="1" stopColor="#5d9aa1" stopOpacity="0.25" />
        </linearGradient>
        <radialGradient id="fgw-vignette" cx="0.5" cy="0.48" r="0.78">
          <stop offset="0.6" stopColor="#123f34" stopOpacity="0" />
          <stop offset="1" stopColor="#123f34" stopOpacity="0.14" />
        </radialGradient>
        <pattern id="fgw-grass" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="m5 19 1.4-4m13 6 1.2-3" stroke="#3f7f36" strokeWidth="1.4" opacity="0.24" />
        </pattern>
        <pattern id="fgw-paper" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="18" cy="22" r="1.4" fill="#c9ab7c" opacity="0.3" />
          <circle cx="84" cy="72" r="1.1" fill="#c9ab7c" opacity="0.24" />
          <circle cx="56" cy="104" r="0.9" fill="#c9ab7c" opacity="0.2" />
        </pattern>
      </defs>
      <g dangerouslySetInnerHTML={{ __html: content }} />
    </svg>
  );
}
