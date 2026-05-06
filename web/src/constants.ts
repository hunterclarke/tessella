import type { GroundStation } from "./api";

export const EARTH_RADIUS_KM = 6378.137;
export const EARTH_SCENE_RADIUS = 2.15;
export const INTERPOLATION_MS = 6_500;
export const PASS_REFRESH_MS = 60_000;
export const SCENE_VERTICAL_OFFSET = 0.42;
export const SUN_LIGHT_DISTANCE = 10;

export const DEFAULT_GROUND_STATION: GroundStation = {
  id: "centennial",
  name: "Centennial, CO",
  latitude: 39.5807,
  longitude: -104.8772,
  altitude_m: 1777,
};
