import { z } from "zod";

/** Coarse cosmetic discovery cells. None of these types establishes a visit,
 * identity, location attestation, reward eligibility or user consent.
 */
export const EXPLORATION_ZOOM = 18;
export const EXPLORATION_GRID_SIZE = 2 ** EXPLORATION_ZOOM;
export const EXPLORATION_MAX_LATITUDE = Math.atan(Math.sinh(Math.PI)) * 180 / Math.PI;
export const EXPLORATION_MAX_ACCURACY_METRES = 35;
export const EXPLORATION_MAX_REVEAL_CELLS = 25;
export const EXPLORATION_MAX_STORED_CELLS = 4096;
export const EXPLORATION_MAX_FOG_CELLS = 4096;
export const EXPLORATION_DEFAULT_FOG_CELLS = 1024;
const earthRadius = 6_371_008.8;
const degrees = Math.PI / 180;

export type ExplorationCellId = `wm18:${number}:${number}`;
export type ExplorationCell = { id: ExplorationCellId; x: number; y: number };
export type ExplorationPoint = { longitude: number; latitude: number };
export type ExplorationBounds = { west: number; south: number; east: number; north: number };

export const explorationPointSchema = z.strictObject({
  longitude: z.number().min(-180).max(180), latitude: z.number().min(-EXPLORATION_MAX_LATITUDE).max(EXPLORATION_MAX_LATITUDE),
});
const idPattern = /^wm18:(0|[1-9]\d{0,5}):(0|[1-9]\d{0,5})$/u;

export function parseExplorationCellId(value: unknown): ExplorationCell | null {
  if (typeof value !== "string" || value.length > 18) return null;
  const match = idPattern.exec(value);
  if (!match) return null;
  const x = Number(match[1]), y = Number(match[2]);
  return x < EXPLORATION_GRID_SIZE && y < EXPLORATION_GRID_SIZE ? { id: value as ExplorationCellId, x, y } : null;
}
export const explorationCellIdSchema = z.string().max(18).refine(value => parseExplorationCellId(value) !== null, "Use a canonical z18 discovery cell.")
  .transform(value => value as ExplorationCellId);

export function explorationCellId(x: number, y: number): ExplorationCellId | null {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < EXPLORATION_GRID_SIZE && y < EXPLORATION_GRID_SIZE
    ? `wm18:${x}:${y}` : null;
}
function wrapX(x: number) { return ((x % EXPLORATION_GRID_SIZE) + EXPLORATION_GRID_SIZE) % EXPLORATION_GRID_SIZE; }
function wrapLongitude(longitude: number) { return ((longitude + 180) % 360 + 360) % 360 - 180; }
function longitudeAt(x: number) { return x / EXPLORATION_GRID_SIZE * 360 - 180; }
function latitudeAt(y: number) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / EXPLORATION_GRID_SIZE))) / degrees; }
function rowAt(latitude: number) { return Math.min(EXPLORATION_GRID_SIZE, Math.max(0, (1 - Math.asinh(Math.tan(latitude * degrees)) / Math.PI) / 2 * EXPLORATION_GRID_SIZE)); }

/** Latitudes outside the renderable Mercator domain are rejected, not moved. */
export function explorationCellAt(value: ExplorationPoint): ExplorationCell | null {
  const result = explorationPointSchema.safeParse(value);
  if (!result.success) return null;
  const x = wrapX(Math.floor((result.data.longitude + 180) / 360 * EXPLORATION_GRID_SIZE));
  const y = Math.min(EXPLORATION_GRID_SIZE - 1, Math.floor(rowAt(result.data.latitude)));
  return { id: explorationCellId(x, y)!, x, y };
}
export function explorationCellBounds(value: unknown): ExplorationBounds | null {
  const cell = parseExplorationCellId(value);
  return cell ? { west: longitudeAt(cell.x), east: longitudeAt(cell.x + 1), north: latitudeAt(cell.y), south: latitudeAt(cell.y + 1) } : null;
}

function distanceMetres(a: ExplorationPoint, b: ExplorationPoint) {
  const dLat = (b.latitude - a.latitude) * degrees, dLng = wrapLongitude(b.longitude - a.longitude) * degrees;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * degrees) * Math.cos(b.latitude * degrees) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
function cellDistance(point: ExplorationPoint, cell: ExplorationCell) {
  const bounds = explorationCellBounds(cell.id)!;
  const middle = (bounds.west + bounds.east) / 2, halfWidth = (bounds.east - bounds.west) / 2;
  const nearestMiddle = point.longitude + wrapLongitude(middle - point.longitude);
  return distanceMetres(point, { longitude: Math.min(nearestMiddle + halfWidth, Math.max(nearestMiddle - halfWidth, point.longitude)),
    latitude: Math.min(bounds.north, Math.max(bounds.south, point.latitude)) });
}
const revealSchema = z.strictObject({
  point: explorationPointSchema, accuracyMetres: z.number().min(0).max(EXPLORATION_MAX_ACCURACY_METRES),
  radiusMetres: z.number().min(0).max(180).default(60),
});

/** Reveal a bounded nearby set, never a movement path or reward proof. The
 * uncertainty radius is subtracted from visual reach. Near the poles, the
 * closest 25 cells are returned; one fix cannot reveal an unbounded grid.
 */
export function revealExplorationCells(input: { point: ExplorationPoint; accuracyMetres: number; radiusMetres?: number }): ExplorationCellId[] {
  const result = revealSchema.safeParse(input);
  if (!result.success) return [];
  const { point } = result.data, origin = explorationCellAt(point)!;
  const radius = Math.max(0, result.data.radiusMetres - result.data.accuracyMetres);
  if (radius === 0) return [origin.id];
  const candidates: { cell: ExplorationCell; distance: number; centre: number }[] = [];
  // Fixed work bound: 81 cells. It contains the closest 25 at a Mercator edge.
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = wrapX(origin.x + dx), y = origin.y + dy;
    if (y < 0 || y >= EXPLORATION_GRID_SIZE) continue;
    const cell = { x, y, id: explorationCellId(x, y)! }, distance = cellDistance(point, cell);
    if (distance <= radius + .001 || cell.id === origin.id) candidates.push({ cell, distance, centre: dx * dx + dy * dy });
  }
  return candidates.sort((a, b) => a.distance - b.distance || a.centre - b.centre || a.cell.y - b.cell.y || a.cell.x - b.cell.x)
    .slice(0, EXPLORATION_MAX_REVEAL_CELLS).map(value => value.cell.id);
}

const boundedCellArraySchema = z.custom<unknown[]>(value => Array.isArray(value) && value.length <= EXPLORATION_MAX_STORED_CELLS,
  "Discovery data exceeds its cell budget.").pipe(z.array(explorationCellIdSchema).max(EXPLORATION_MAX_STORED_CELLS));
const cellsSchema = boundedCellArraySchema
  .refine(values => new Set(values).size === values.length, "Discovery cells must be unique.");
export const cosmeticExplorationSchema = z.strictObject({
  version: z.literal(1), source: z.enum(["manual", "demo"]), rewardEligible: z.literal(false), cells: cellsSchema,
});
export const recordedExplorationSchema = z.strictObject({
  version: z.literal(1), source: z.literal("device-observation"), consentVersion: z.literal(1), rewardEligible: z.literal(false), cells: cellsSchema,
});
export const explorationStateSchema = z.discriminatedUnion("source", [cosmeticExplorationSchema, recordedExplorationSchema]);
export type CosmeticExplorationState = z.infer<typeof cosmeticExplorationSchema>;
export type RecordedExplorationState = z.infer<typeof recordedExplorationSchema>;
export type ExplorationState = z.infer<typeof explorationStateSchema>;

export function createCosmeticExploration(source: "manual" | "demo" = "manual"): CosmeticExplorationState {
  return { version: 1, source, rewardEligible: false, cells: [] };
}

/** Consent must be obtained and checked by the application/server separately.
 * A consentVersion value in browser data cannot authorise persistence.
 */
export function createRecordedExploration(): RecordedExplorationState {
  return { version: 1, source: "device-observation", consentVersion: 1, rewardEligible: false, cells: [] };
}

/** Merging never promotes manual/demo data into device observations. Reject a
 * capacity overflow instead of silently forgetting previously explored cells.
 */
export function mergeExplorationStates(previous: unknown, incoming: unknown): ExplorationState | null {
  const before = explorationStateSchema.safeParse(previous), addition = explorationStateSchema.safeParse(incoming);
  if (!before.success || !addition.success || before.data.source !== addition.data.source) return null;
  const cells = [...new Set([...before.data.cells, ...addition.data.cells])];
  return cells.length <= EXPLORATION_MAX_STORED_CELLS ? { ...before.data, cells } : null;
}

export type ExplorationFogData = { type: "FeatureCollection"; features: {
  type: "Feature"; id: string; properties: { source: "exploration-fog"; cellCount: number };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}[] };
export type ExplorationFogResult = {
  status: "ready" | "viewport-too-large" | "invalid-input"; data: ExplorationFogData;
  visibleCellCount: number; exploredCellCount: number; exploredPercent: number | null;
};
const emptyFog = (status: ExplorationFogResult["status"], visibleCellCount = 0): ExplorationFogResult => ({
  status, data: { type: "FeatureCollection", features: [] }, visibleCellCount, exploredCellCount: 0, exploredPercent: null,
});
const fogSchema = z.strictObject({
  // Adjacent world copies are accepted, then split into canonical longitude
  // polygons. A dateline-crossing canonical viewport may have west > east.
  viewport: z.strictObject({ west: z.number().min(-540).max(540), east: z.number().min(-540).max(540),
    south: z.number().min(-EXPLORATION_MAX_LATITUDE).max(EXPLORATION_MAX_LATITUDE), north: z.number().min(-EXPLORATION_MAX_LATITUDE).max(EXPLORATION_MAX_LATITUDE) }),
  exploredCellIds: boundedCellArraySchema,
  maxCells: z.int().min(1).max(EXPLORATION_MAX_FOG_CELLS).default(EXPLORATION_DEFAULT_FOG_CELLS),
});
const snapGrid = (value: number) => Math.abs(value - Math.round(value)) < 1e-7 ? Math.round(value) : value;

/** Geographic fog is a partition of unexplored cells clipped to this viewport.
 * Horizontal runs reduce feature count. Explored cells are actual gaps in the
 * geometry, avoiding invalid touching polygon holes or a cosmetic gradient.
 * Percentage is visible grid cells only, never world completion or rewards.
 */
export function explorationFogGeometry(input: { viewport: ExplorationBounds; exploredCellIds: readonly string[]; maxCells?: number }): ExplorationFogResult {
  const result = fogSchema.safeParse(input);
  if (!result.success) return emptyFog("invalid-input");
  const { viewport, maxCells } = result.data;
  const rawWidth = viewport.east - viewport.west;
  if (viewport.north <= viewport.south || rawWidth === 0) return emptyFog("invalid-input");
  if (Math.abs(rawWidth) >= 360) return emptyFog("viewport-too-large");
  const width = rawWidth > 0 ? rawWidth : rawWidth + 360, west = wrapLongitude(viewport.west), east = west + width;
  const pieces = east <= 180 ? [[west, east]] : [[west, 180], [-180, east - 360]];
  const ranges = pieces.map(([start, end]) => ({ west: start, east: end,
    x0: Math.max(0, Math.floor(snapGrid((start + 180) / 360 * EXPLORATION_GRID_SIZE))),
    x1: Math.min(EXPLORATION_GRID_SIZE, Math.ceil(snapGrid((end + 180) / 360 * EXPLORATION_GRID_SIZE))),
  })).filter(range => range.x1 > range.x0);
  const y0 = Math.max(0, Math.floor(snapGrid(rowAt(viewport.north)))), y1 = Math.min(EXPLORATION_GRID_SIZE, Math.ceil(snapGrid(rowAt(viewport.south))));
  const visibleCellCount = ranges.reduce((total, range) => total + range.x1 - range.x0, 0) * (y1 - y0);
  if (visibleCellCount > maxCells) return emptyFog("viewport-too-large", visibleCellCount);
  if (visibleCellCount === 0) return emptyFog("invalid-input");
  const explored = new Set(result.data.exploredCellIds), output = emptyFog("ready", visibleCellCount);
  for (let y = y0; y < y1; y++) for (const range of ranges) {
    let run: number | null = null;
    const flush = (end: number) => {
      if (run === null) return;
      const left = Math.max(range.west, longitudeAt(run)), right = Math.min(range.east, longitudeAt(end));
      const south = Math.max(viewport.south, latitudeAt(y + 1)), north = Math.min(viewport.north, latitudeAt(y));
      if (right > left && north > south) output.data.features.push({ type: "Feature", id: `${y}:${run}:${end}`,
        properties: { source: "exploration-fog", cellCount: end - run },
        geometry: { type: "Polygon", coordinates: [[[left, south], [right, south], [right, north], [left, north], [left, south]]] } });
      run = null;
    };
    for (let x = range.x0; x < range.x1; x++) {
      if (explored.has(explorationCellId(x, y)!)) { output.exploredCellCount++; flush(x); }
      else if (run === null) run = x;
    }
    flush(range.x1);
  }
  output.exploredPercent = Math.round(output.exploredCellCount / visibleCellCount * 10000) / 100;
  return output;
}
