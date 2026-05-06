import * as THREE from "three";
import type { GroundStation, TrackedObjectSummary } from "./api";
import {
  EARTH_RADIUS_KM,
  EARTH_SCENE_RADIUS,
  SUN_LIGHT_DISTANCE,
} from "./constants";
import type { ObjectGroup, PositionTuple, TrackedObjectsFrame } from "./types";

export function isTrackedObjectsFrame(
  payload: unknown,
): payload is TrackedObjectsFrame {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "objects" in payload &&
    Array.isArray((payload as TrackedObjectsFrame).objects) &&
    (payload as TrackedObjectsFrame).objects.every(
      (object) =>
        Array.isArray(object) &&
        object.length === 5 &&
        object.every((value) => typeof value === "number"),
    )
  );
}

export function writeScenePosition(
  values: Float32Array,
  index: number,
  latitude: number,
  longitude: number,
  altitudeKm: number,
) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(longitude);
  const radius =
    EARTH_SCENE_RADIUS * ((EARTH_RADIUS_KM + altitudeKm) / EARTH_RADIUS_KM);

  values[index * 3] =
    radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians);
  values[index * 3 + 1] = radius * Math.sin(latitudeRadians);
  values[index * 3 + 2] =
    -radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians);
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

function normalizeSignedDegrees(degrees: number) {
  const normalized = normalizeDegrees(degrees);
  return normalized > 180 ? normalized - 360 : normalized;
}

function sceneVectorFromLatLon(
  latitude: number,
  longitude: number,
  radius: number,
) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(longitude);

  return new THREE.Vector3(
    radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
    radius * Math.sin(latitudeRadians),
    -radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
  );
}

function julianDate(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

function greenwichMeanSiderealTime(julianDateValue: number) {
  const daysSinceJ2000 = julianDateValue - 2_451_545.0;
  const centuriesSinceJ2000 = daysSinceJ2000 / 36_525;

  return normalizeDegrees(
    280.46061837 +
      360.98564736629 * daysSinceJ2000 +
      0.000387933 * centuriesSinceJ2000 * centuriesSinceJ2000 -
      (centuriesSinceJ2000 * centuriesSinceJ2000 * centuriesSinceJ2000) /
        38_710_000,
  );
}

export function sunLightPositionFromUtc(date: Date) {
  const julianDateValue = julianDate(date);
  const daysSinceJ2000 = julianDateValue - 2_451_545.0;
  const meanLongitude = normalizeDegrees(280.460 + 0.9856474 * daysSinceJ2000);
  const meanAnomaly = THREE.MathUtils.degToRad(
    normalizeDegrees(357.528 + 0.9856003 * daysSinceJ2000),
  );
  const eclipticLongitude = THREE.MathUtils.degToRad(
    meanLongitude +
      1.915 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly),
  );
  const obliquity = THREE.MathUtils.degToRad(
    23.439 - 0.0000004 * daysSinceJ2000,
  );
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude),
  );
  const subsolarLongitude = normalizeSignedDegrees(
    THREE.MathUtils.radToDeg(rightAscension) -
      greenwichMeanSiderealTime(julianDateValue),
  );
  const subsolarLatitude = THREE.MathUtils.radToDeg(declination);

  return sceneVectorFromLatLon(
    subsolarLatitude,
    subsolarLongitude,
    SUN_LIGHT_DISTANCE,
  );
}

export function scenePositionFromTuple(position: PositionTuple) {
  const values = new Float32Array(3);
  writeScenePosition(values, 0, position[1], position[2], position[3]);
  return new THREE.Vector3(values[0], values[1], values[2]);
}

export function scenePositionFromGroundStation(station: GroundStation) {
  const values = new Float32Array(3);
  writeScenePosition(values, 0, station.latitude, station.longitude, 0);
  return new THREE.Vector3(values[0], values[1], values[2]);
}

export function classifyObject(
  object: TrackedObjectSummary | undefined,
): ObjectGroup {
  if (!object) return "other";

  const name = object.object_name.toUpperCase();

  if (
    name.includes("ISS") ||
    name.includes("ZARYA") ||
    name.includes("TIANGONG") ||
    name.includes("CSS") ||
    name.includes("CREW DRAGON") ||
    name.includes("SOYUZ") ||
    name.includes("PROGRESS") ||
    name.includes("SHENZHOU")
  ) {
    return "stations";
  }

  if (name.includes("STARLINK")) return "starlink";

  return "other";
}

export function groupLabel(group: ObjectGroup) {
  switch (group) {
    case "stations":
      return "Stations";
    case "starlink":
      return "Starlink";
    case "other":
      return "Other";
  }
}

export function formatLiveTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
