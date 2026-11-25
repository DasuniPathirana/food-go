/**
 * Optional Food Go client-demo scenic planting for the Fitzroy Gardens tour.
 *
 * These are ART-DIRECTED demonstration groves, not actual surveyed tree
 * locations. Never enable for normal Explore, reward verification, routing
 * or any user location observation.
 */
import type { GameWorldObject } from "./game-world-objects";

const center = { longitude: 144.9794, latitude: -37.8134 };
function random(n: number) {
  const x = Math.sin(n * 127.1 + 71.37) * 43758.5453;
  return x - Math.floor(x);
}

/** A few recognisable groves with open area around the avatar and pond. */
export function demoParkScenery(): GameWorldObject[] {
  const clusters = [
    [-165, 115], [155, 136], [-153, -131], [170, -107],
    [6, 235], [-245, -10],
  ] as const;
  const cos = Math.cos(center.latitude * Math.PI / 180);
  const trees: GameWorldObject[] = [];
  for (let cluster=0; cluster<clusters.length; cluster++) {
    const [cx,cy] = clusters[cluster];
    for (let i=0; i<19; i++) {
      const seed=cluster*31+i+7;
      const theta = random(seed + 118)*Math.PI*2;
      const radius = 7 + Math.sqrt(random(seed + 47))*65;
      const east = cx + Math.cos(theta)*radius;
      const north = cy + Math.sin(theta)*radius;
      const distance = Math.hypot(east,north);
      // Keep the playable center visible and leave broad open lawn gaps.
      if(distance<38 || distance>325)continue;
      trees.push({
        id:`illustrative-demo-grove:${cluster}:${i}`,
        kind:"tree",
        longitude:center.longitude+east/(111320*cos),
        latitude:center.latitude+north/111320,
      });
    }
  }
  return trees.slice(0,102);
}
