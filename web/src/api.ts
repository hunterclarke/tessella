export type TrackedObjectSummary = {
  cat_id: number;
  object_name: string;
};

export type GroundStation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
};

export type VisibilityPass = {
  rise: string;
  set: string;
  max_elevation: number;
  max_elevation_time: string;
  duration_seconds: number;
};

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getTrackedObjects() {
  return getJson<TrackedObjectSummary[]>("/api/tracked_objects");
}

export function getPasses(catId: number, station: GroundStation) {
  const params = new URLSearchParams({
    latitude: String(station.latitude),
    longitude: String(station.longitude),
    altitude_m: String(station.altitude_m),
    hours: "24",
    min_elevation: "10",
  });

  return getJson<VisibilityPass[]>(
    `/api/tracked_objects/${catId}/passes?${params}`,
  );
}
