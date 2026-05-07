import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  getPasses,
  getTrackedObjects,
  type GroundStation,
  type TrackedObjectSummary,
  type VisibilityPass,
} from "./api";
import { ConnectionStatusBadge } from "./components/ConnectionStatusBadge";
import { GroupPanel } from "./components/GroupPanel";
import { OperationsBar } from "./components/OperationsBar";
import { DEFAULT_GROUND_STATION, PASS_REFRESH_MS } from "./constants";
import { Scene } from "./scene/Scene";
import { classifyObject, isTrackedObjectsFrame } from "./space";
import { createSocket } from "./socket";
import type {
  ConnectionStatus,
  GroupedMetadata,
  GroupedPositions,
  ObjectGroup,
  PositionTuple,
} from "./types";

const GITHUB_REPOSITORY_URL = "https://github.com/hunterclarke/tessella";

function App() {
  const [selectedCatId, setSelectedCatId] = useState(25544);
  const [selectedGroup, setSelectedGroup] = useState<ObjectGroup>("stations");
  const [groundStation, setGroundStation] = useState<GroundStation>(
    DEFAULT_GROUND_STATION,
  );
  const [passes, setPasses] = useState<VisibilityPass[]>([]);
  const [passesStatus, setPassesStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [metadata, setMetadata] = useState<TrackedObjectSummary[]>([]);
  const [positions, setPositions] = useState<PositionTuple[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    getTrackedObjects()
      .then(setMetadata)
      .catch((error: unknown) => {
        console.error("tracked object metadata load failed", error);
      });
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let active = true;
    let permissionStatus: PermissionStatus | null = null;

    const updateFromGeolocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active) return;
          setGroundStation({
            id: "current",
            name: "Current Location",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude_m: position.coords.altitude ?? 0,
          });
        },
        () => {
          if (active) setGroundStation(DEFAULT_GROUND_STATION);
        },
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 5_000 },
      );
    };

    updateFromGeolocation();

    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (!active) return;
          permissionStatus = status;
          status.onchange = () => {
            if (status.state === "granted") {
              updateFromGeolocation();
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      active = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    const socket = createSocket();
    const channel = socket.channel("tracked_objects", {});

    channel
      .join()
      .receive("ok", (payload: unknown) => {
        if (!active) return;
        if (isTrackedObjectsFrame(payload)) {
          setPositions(payload.objects);
        }
        setConnectionStatus("live");
      })
      .receive("error", (error: unknown) => {
        console.error("tracked objects channel join failed", error);
        if (active) setConnectionStatus("error");
      });

    channel.on("frame", (payload: unknown) => {
      if (!active) return;
      if (isTrackedObjectsFrame(payload)) {
        setPositions(payload.objects);
      }
      setConnectionStatus("live");
    });

    channel.onError(() => {
      if (active) setConnectionStatus("error");
    });

    return () => {
      active = false;
      channel.leave();
      socket.disconnect();
    };
  }, []);

  const metadataById = useMemo(
    () => new Map(metadata.map((object) => [object.cat_id, object])),
    [metadata],
  );
  const positionById = useMemo(
    () => new Map(positions.map((position) => [position[0], position])),
    [positions],
  );
  const groupedPositions = useMemo(() => {
    const grouped: GroupedPositions = {
      stations: [],
      starlink: [],
      other: [],
    };

    positions.forEach((position) => {
      const group = classifyObject(metadataById.get(position[0]));
      grouped[group].push(position);
    });

    return grouped;
  }, [metadataById, positions]);
  const groupCounts = useMemo(
    () => ({
      stations: groupedPositions.stations.length,
      starlink: groupedPositions.starlink.length,
      other: groupedPositions.other.length,
    }),
    [groupedPositions],
  );
  const groupedMetadata = useMemo(() => {
    const grouped: GroupedMetadata = {
      stations: [],
      starlink: [],
      other: [],
    };

    metadata.forEach((object) => {
      grouped[classifyObject(object)].push(object);
    });

    return grouped;
  }, [metadata]);
  const selectedObject =
    metadataById.get(selectedCatId) ?? metadata[0] ?? null;
  const selectedPosition =
    positionById.get(selectedObject?.cat_id ?? selectedCatId) ?? null;

  useEffect(() => {
    if (!selectedObject) return;

    let active = true;
    let timeoutId: number | undefined;

    const refreshPasses = (showLoading: boolean) => {
      if (showLoading) {
        setPassesStatus("loading");
      }

      getPasses(selectedObject.cat_id, groundStation)
        .then((nextPasses) => {
          if (!active) return;
          setPasses(nextPasses);
          setPassesStatus("ready");
        })
        .catch((error: unknown) => {
          console.error("pass prediction load failed", error);
          if (!active) return;
          setPasses([]);
          setPassesStatus("error");
        })
        .finally(() => {
          if (!active) return;
          timeoutId = window.setTimeout(
            () => refreshPasses(false),
            PASS_REFRESH_MS,
          );
        });
    };

    refreshPasses(true);

    return () => {
      active = false;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [groundStation, selectedObject]);

  return (
    <main className="app-shell">
      <Canvas camera={{ position: [0, 0.7, 6.4], fov: 45 }} dpr={[1, 2]}>
        <Scene
          groupedPositions={groupedPositions}
          selectedPosition={selectedPosition}
          selectedGroup={selectedGroup}
          groundStation={groundStation}
        />
      </Canvas>

      <GroupPanel
        selectedGroup={selectedGroup}
        groupCounts={groupCounts}
        onSelectGroup={setSelectedGroup}
      />

      <OperationsBar
        groupedMetadata={groupedMetadata}
        selectedObject={selectedObject}
        selectedPosition={selectedPosition}
        groundStation={groundStation}
        passes={passes}
        passesStatus={passesStatus}
        onSelectObject={setSelectedCatId}
      />

      <div className="top-actions" aria-label="Application links and status">
        <a
          className="github-link"
          href={GITHUB_REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="View Tessella on GitHub"
        >
          <svg aria-hidden="true" focusable="false">
            <use href="/icons.svg#github-icon" />
          </svg>
          <span>GitHub</span>
        </a>
        <ConnectionStatusBadge connectionStatus={connectionStatus} now={now} />
      </div>
    </main>
  );
}

export default App;
