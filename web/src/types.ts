import type { TrackedObjectSummary } from "./api";

export type ConnectionStatus = "connecting" | "live" | "fallback" | "error";
export type ObjectGroup = "stations" | "starlink" | "other";
export type PositionTuple = [number, number, number, number, number];
export type TrackedObjectsFrame = { objects: PositionTuple[] };
export type GroupedPositions = Record<ObjectGroup, PositionTuple[]>;
export type GroupedMetadata = Record<ObjectGroup, TrackedObjectSummary[]>;
