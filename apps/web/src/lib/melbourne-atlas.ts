/** WGS84, longitude before latitude. Imagery is aligned in Web Mercator. */
export const ATLAS_CORNERS: [number, number][] = [
  [144.949, -37.803],
  [144.9733, -37.803],
  [144.9733, -37.821],
  [144.949, -37.821],
];

export const ATLAS_CENTER: [number, number] = [144.96115, -37.812];
export const ATLAS_AERIAL = "/atlas/melbourne-aerial.webp";
export const ATLAS_SATELLITE = "/atlas/melbourne-satellite.webp";
export const ATLAS_BUILDINGS = "/atlas/melbourne-buildings.geojson";
export const ATLAS_ATTRIBUTION = "/atlas/sources.html";
export const ATLAS_SATELLITE_DATE = "5 March 2025";

/** City of Melbourne public landmark reference points, separate from partner venue records. */
export const ATLAS_PLACES = [
  { id: "queen-victoria-market", name: "Queen Victoria Market", area: "Melbourne CBD", longitude: 144.957159, latitude: -37.807500 },
  { id: "melbourne-central", name: "Melbourne Central", area: "Melbourne CBD", longitude: 144.962750, latitude: -37.810537 },
  { id: "qv-village", name: "QV Village", area: "Melbourne CBD", longitude: 144.965715, latitude: -37.810689 },
  { id: "federation-square", name: "Federation Square", area: "Melbourne CBD", longitude: 144.968964, latitude: -37.817852 },
];
