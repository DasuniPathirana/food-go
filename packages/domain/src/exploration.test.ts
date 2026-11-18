import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPLORATION_GRID_SIZE, EXPLORATION_MAX_LATITUDE, EXPLORATION_MAX_STORED_CELLS, createCosmeticExploration, createRecordedExploration,
  explorationCellAt, explorationCellBounds, explorationCellId, explorationFogGeometry, explorationStateSchema, mergeExplorationStates,
  parseExplorationCellId, recordedExplorationSchema, revealExplorationCells, type ExplorationBounds, type ExplorationFogData,
} from "./exploration";

const centre = (id: string) => {
  const bounds = explorationCellBounds(id)!;
  return { longitude: (bounds.west + bounds.east) / 2, latitude: (bounds.south + bounds.north) / 2 };
};
function fogAt(data: ExplorationFogData, point: { longitude: number; latitude: number }) {
  return data.features.filter(feature => {
    const ring = feature.geometry.coordinates[0], west = ring[0][0], south = ring[0][1], east = ring[1][0], north = ring[2][1];
    return point.longitude > west && point.longitude < east && point.latitude > south && point.latitude < north;
  }).length;
}
function rectangle(x: number, y: number, width: number, height: number): ExplorationBounds {
  const first = explorationCellBounds(explorationCellId(x, y)!)!, last = explorationCellBounds(explorationCellId(x + width - 1, y + height - 1)!)!;
  return { west: first.west, north: first.north, east: last.east, south: last.south };
}

test("z18 cell IDs and point conversion are canonical, bounded and geographically reversible", () => {
  assert.deepEqual(explorationCellAt({ longitude: 0, latitude: 0 }), { id: "wm18:131072:131072", x: 131072, y: 131072 });
  const point = { longitude: 144.967146, latitude: -37.816813 }, cell = explorationCellAt(point)!;
  const bounds = explorationCellBounds(cell.id)!;
  assert.ok(bounds.west <= point.longitude && bounds.east > point.longitude && bounds.south < point.latitude && bounds.north >= point.latitude);
  assert.deepEqual(explorationCellAt(centre(cell.id)), cell);
  for (const value of ["wm17:1:2", "wm18:01:2", "wm18:-1:2", "wm18:262144:0", "wm18:0:262144", "wm18:1.5:2", "wm18:1:2:3", "wm18:999999999:0", null, { x: 1, y: 2 }]) {
    assert.equal(parseExplorationCellId(value), null); assert.equal(explorationCellBounds(value), null);
  }
  assert.equal(explorationCellId(-1, 0), null); assert.equal(explorationCellId(0, 1.5), null);
  assert.equal(explorationCellAt({ longitude: 0, latitude: 90 }), null);
  assert.equal(explorationCellAt({ longitude: NaN, latitude: 0 }), null);
  assert.equal(explorationCellAt({ longitude: 0, latitude: Infinity }), null);
});

test("the date line wraps once and Mercator latitude edges remain finite without moving out-of-range users", () => {
  assert.deepEqual(explorationCellAt({ longitude: 180, latitude: 0 }), explorationCellAt({ longitude: -180, latitude: 0 }));
  assert.equal(explorationCellAt({ longitude: 0, latitude: EXPLORATION_MAX_LATITUDE })!.y, 0);
  assert.equal(explorationCellAt({ longitude: 0, latitude: -EXPLORATION_MAX_LATITUDE })!.y, EXPLORATION_GRID_SIZE - 1);
  assert.equal(explorationCellBounds("wm18:0:0")!.west, -180);
  assert.equal(explorationCellBounds(`wm18:${EXPLORATION_GRID_SIZE - 1}:${EXPLORATION_GRID_SIZE - 1}`)!.east, 180);
  assert.ok(Math.abs(explorationCellBounds("wm18:0:0")!.north - EXPLORATION_MAX_LATITUDE) < 1e-10);
  assert.equal(explorationCellAt({ longitude: 0, latitude: EXPLORATION_MAX_LATITUDE + .0001 }), null);
});

test("visual radius reveals adjacent geographic cells while uncertainty and work remain bounded", () => {
  const origin = explorationCellAt({ longitude: 144.967146, latitude: -37.816813 })!;
  assert.deepEqual(revealExplorationCells({ point: centre(origin.id), accuracyMetres: 0, radiusMetres: 0 }), [origin.id]);
  const corner = revealExplorationCells({ point: { longitude: 0, latitude: 0 }, accuracyMetres: 0, radiusMetres: 1 });
  assert.deepEqual(new Set(corner), new Set(["wm18:131071:131071", "wm18:131072:131071", "wm18:131071:131072", "wm18:131072:131072"]));
  const wide = revealExplorationCells({ point: centre(origin.id), accuracyMetres: 0, radiusMetres: 180 });
  const uncertain = revealExplorationCells({ point: centre(origin.id), accuracyMetres: 35, radiusMetres: 180 });
  assert.ok(uncertain.every(id => wide.includes(id))); assert.ok(wide.length > 1);
  const polar = revealExplorationCells({ point: { longitude: 10, latitude: EXPLORATION_MAX_LATITUDE }, accuracyMetres: 0, radiusMetres: 180 });
  assert.equal(polar.length, 25); assert.equal(new Set(polar).size, 25);
  for (const input of [
    { point: centre(origin.id), accuracyMetres: 36 }, { point: centre(origin.id), accuracyMetres: -1 },
    { point: centre(origin.id), accuracyMetres: NaN }, { point: centre(origin.id), accuracyMetres: 5, radiusMetres: 181 },
    { point: { longitude: 181, latitude: 0 }, accuracyMetres: 5 },
  ]) assert.deepEqual(revealExplorationCells(input), []);
});

test("reveal radius crosses the date line without revealing remote cells", () => {
  const east = revealExplorationCells({ point: { longitude: 180, latitude: 0 }, accuracyMetres: 0, radiusMetres: 30 });
  const west = revealExplorationCells({ point: { longitude: -180, latitude: 0 }, accuracyMetres: 0, radiusMetres: 30 });
  assert.deepEqual(new Set(east), new Set(west));
  assert.deepEqual(new Set(east.map(id => parseExplorationCellId(id)!.x)), new Set([0, EXPLORATION_GRID_SIZE - 1]));
});

test("recorded data and manual/demo previews cannot merge into each other or claim rewards", () => {
  const id = "wm18:1:2", other = "wm18:2:2";
  const manual = { ...createCosmeticExploration(), cells: [id] }, demo = { ...createCosmeticExploration("demo"), cells: [other] };
  const recorded = { ...createRecordedExploration(), cells: [other] };
  assert.equal(mergeExplorationStates(manual, recorded), null); assert.equal(mergeExplorationStates(recorded, manual), null);
  assert.equal(mergeExplorationStates(manual, demo), null);
  const merged = mergeExplorationStates(manual, { ...manual, cells: [other] })!;
  assert.deepEqual(merged.cells, [id, other]); assert.equal(merged.source, "manual"); assert.equal(merged.rewardEligible, false);
  assert.deepEqual(manual.cells, [id], "Previous state stays immutable");
  assert.deepEqual(mergeExplorationStates(recorded, recorded), recorded);
  for (const value of [{ ...recorded, rewardEligible: true }, { ...recorded, verified: true }, { ...recorded, consentVersion: 2 },
    { ...recorded, cells: [id, id] }, { ...recorded, xp: 100 }, { ...manual, consentVersion: 1 }]) assert.equal(explorationStateSchema.safeParse(value).success, false);
  assert.equal(recordedExplorationSchema.safeParse(manual).success, false);
});

test("state capacity overflow is rejected instead of silently losing persistent discoveries", () => {
  const cells = Array.from({ length: EXPLORATION_MAX_STORED_CELLS }, (_, x) => explorationCellId(x, 0)!);
  const full = { ...createRecordedExploration(), cells };
  assert.ok(recordedExplorationSchema.safeParse(full).success);
  assert.equal(mergeExplorationStates(full, { ...createRecordedExploration(), cells: [explorationCellId(EXPLORATION_MAX_STORED_CELLS, 0)!] }), null);
});

test("fog consists of geographic unexplored cell runs with actual gaps for revealed cells", () => {
  const x = 131072, y = 131072, viewport = rectangle(x, y, 2, 2), explored = explorationCellId(x, y)!;
  const result = explorationFogGeometry({ viewport, exploredCellIds: [explored] });
  assert.equal(result.status, "ready"); assert.equal(result.visibleCellCount, 4); assert.equal(result.exploredCellCount, 1); assert.equal(result.exploredPercent, 25);
  assert.equal(result.data.features.length, 2, "Adjacent fog cells share one horizontal run");
  assert.equal(fogAt(result.data, centre(explored)), 0);
  for (const id of [explorationCellId(x + 1, y)!, explorationCellId(x, y + 1)!, explorationCellId(x + 1, y + 1)!]) assert.equal(fogAt(result.data, centre(id)), 1);
  const all = [explored, explorationCellId(x + 1, y)!, explorationCellId(x, y + 1)!, explorationCellId(x + 1, y + 1)!];
  const revealed = explorationFogGeometry({ viewport, exploredCellIds: all });
  assert.deepEqual(revealed.data.features, []); assert.equal(revealed.exploredPercent, 100);
});

test("fog partitions a full bounded viewport exactly, including alternating discovered cells", () => {
  const x0 = 236000, y0 = 160000, viewport = rectangle(x0, y0, 32, 32);
  const explored: string[] = [];
  for (let dy = 0; dy < 32; dy++) for (let dx = 0; dx < 32; dx++) if ((dx + dy) % 2 === 0) explored.push(explorationCellId(x0 + dx, y0 + dy)!);
  const result = explorationFogGeometry({ viewport, exploredCellIds: explored });
  assert.equal(result.status, "ready"); assert.equal(result.visibleCellCount, 1024); assert.equal(result.exploredCellCount, 512);
  assert.equal(result.data.features.reduce((total, feature) => total + feature.properties.cellCount, 0), 512);
  const clear = new Set(explored);
  for (let dy = 0; dy < 32; dy++) for (let dx = 0; dx < 32; dx++) {
    const id = explorationCellId(x0 + dx, y0 + dy)!;
    assert.equal(fogAt(result.data, centre(id)), clear.has(id) ? 0 : 1);
  }
});

test("fog polygons clip to viewport boundaries and use closed counterclockwise rings", () => {
  const full = rectangle(131072, 131072, 1, 1), dx = (full.east - full.west) / 5, dy = (full.north - full.south) / 5;
  const viewport = { west: full.west + dx, east: full.east - dx, south: full.south + dy, north: full.north - dy };
  const result = explorationFogGeometry({ viewport, exploredCellIds: [] });
  assert.equal(result.visibleCellCount, 1); assert.equal(result.data.features.length, 1);
  const ring = result.data.features[0].geometry.coordinates[0];
  assert.deepEqual(ring, [[viewport.west, viewport.south], [viewport.east, viewport.south], [viewport.east, viewport.north], [viewport.west, viewport.north], [viewport.west, viewport.south]]);
  const area = ring.slice(0, -1).reduce((sum, point, index) => sum + point[0] * ring[index + 1][1] - ring[index + 1][0] * point[1], 0);
  assert.ok(area > 0);
});

test("fog splits antimeridian viewports into small canonical polygons and accepts adjacent world copies", () => {
  const viewport = { west: 179.999, east: -179.999, south: -.001, north: .001 };
  const result = explorationFogGeometry({ viewport, exploredCellIds: [] });
  assert.equal(result.status, "ready"); assert.equal(result.visibleCellCount, 4);
  assert.equal(result.data.features.length, 4);
  for (const feature of result.data.features) {
    const ring = feature.geometry.coordinates[0];
    assert.ok(ring.every(point => point[0] >= -180 && point[0] <= 180));
    assert.ok(Math.abs(ring[1][0] - ring[0][0]) < .002);
  }
  const copy = explorationFogGeometry({ viewport: { ...viewport, east: 180.001 }, exploredCellIds: [] });
  assert.equal(copy.visibleCellCount, 4); assert.equal(copy.data.features.length, 4);
  const explored = explorationFogGeometry({ viewport, exploredCellIds: ["wm18:262143:131071", "wm18:262143:131072"] });
  assert.equal(explored.exploredPercent, 50); assert.ok(explored.data.features.every(feature => feature.geometry.coordinates[0][0][0] === -180));
});

test("oversized and malformed fog requests are bounded before geometry allocation", () => {
  const wide = explorationFogGeometry({ viewport: { west: -180, east: 180, south: -80, north: 80 }, exploredCellIds: [] });
  assert.equal(wide.status, "viewport-too-large"); assert.deepEqual(wide.data.features, []); assert.equal(wide.exploredPercent, null);
  const over = explorationFogGeometry({ viewport: rectangle(131072, 131072, 10, 10), exploredCellIds: [], maxCells: 99 });
  assert.equal(over.status, "viewport-too-large"); assert.equal(over.visibleCellCount, 100); assert.deepEqual(over.data.features, []);
  for (const input of [
    { viewport: { west: 0, east: 0, south: 0, north: 1 }, exploredCellIds: [] },
    { viewport: { west: 0, east: 1, south: 1, north: 0 }, exploredCellIds: [] },
    { viewport: { west: 0, east: 1, south: 0, north: 90 }, exploredCellIds: [] },
    { viewport: rectangle(131072, 131072, 1, 1), exploredCellIds: ["bad"] },
    { viewport: rectangle(131072, 131072, 1, 1), exploredCellIds: [], maxCells: 100000 },
  ]) assert.equal(explorationFogGeometry(input).status, "invalid-input");
});
