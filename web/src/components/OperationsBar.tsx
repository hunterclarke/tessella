import type {
  GroundStation,
  TrackedObjectSummary,
  VisibilityPass,
} from "../api";
import type { GroupedMetadata, PositionTuple } from "../types";
import { ObjectCombobox } from "./ObjectCombobox";

export function OperationsBar({
  groupedMetadata,
  selectedObject,
  selectedPosition,
  groundStation,
  passes,
  passesStatus,
  onSelectObject,
}: {
  groupedMetadata: GroupedMetadata;
  selectedObject: TrackedObjectSummary | null;
  selectedPosition: PositionTuple | null;
  groundStation: GroundStation;
  passes: VisibilityPass[];
  passesStatus: "loading" | "ready" | "error";
  onSelectObject: (catId: number) => void;
}) {
  return (
    <section className="operations-bar" aria-label="Operations context">
      <div className="operations-section input-context">
        <p className="eyebrow">Tracking Inputs</p>

        <div className="input-stack">
          <ObjectCombobox
            groupedMetadata={groupedMetadata}
            selectedObject={selectedObject}
            onSelect={onSelectObject}
            label="Tracked Object"
          />

          <div className="station-field">
            <span className="station-label">Station</span>
            <div className="station-value">
              <span>{groundStation.name}</span>
              <strong>
                {groundStation.latitude.toFixed(2)},{" "}
                {groundStation.longitude.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="operations-section live-context">
        <div className="live-heading">
          <p className="eyebrow eyebrow-tracked">Live State</p>
          <h2>{selectedObject?.object_name || "--"}</h2>
        </div>
        <dl className="metrics live-metrics">
          <div>
            <dt>NORAD ID</dt>
            <dd>{selectedObject?.cat_id || "--"}</dd>
          </div>
          <div>
            <dt>Latitude</dt>
            <dd>
              {selectedPosition
                ? `${selectedPosition[1].toFixed(2)} deg`
                : "--"}
            </dd>
          </div>
          <div>
            <dt>Longitude</dt>
            <dd>
              {selectedPosition
                ? `${selectedPosition[2].toFixed(2)} deg`
                : "--"}
            </dd>
          </div>
          <div>
            <dt>Altitude</dt>
            <dd>
              {selectedPosition
                ? `${selectedPosition[3].toFixed(0)} km`
                : "--"}
            </dd>
          </div>
          <div>
            <dt>Velocity</dt>
            <dd>
              {selectedPosition
                ? `${selectedPosition[4].toFixed(2)} km/s`
                : "--"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="operations-section visibility-context">
        <div className="visibility-heading">
          <p className="eyebrow eyebrow-ground">Visibility Windows</p>
          {passesStatus !== "ready" && <strong>{passesStatus}</strong>}
        </div>

        <div className="visibility-pair" aria-label="Visibility relationship">
          <span className="visibility-token tracked-token">
            {selectedObject?.object_name || "Tracked object"}
          </span>
          <span className="visibility-connector" aria-hidden="true">
            to
          </span>
          <span className="visibility-token station-token">
            {groundStation.name}
          </span>
        </div>

        <div className="passes-list">
          {passes.slice(0, 2).map((visibilityPass) => (
            <article key={visibilityPass.rise} className="pass-row">
              <div>
                <span>Rise</span>
                <strong>
                  {new Date(visibilityPass.rise).toLocaleTimeString()}
                </strong>
              </div>
              <div>
                <span>Peak Elevation</span>
                <strong>{visibilityPass.max_elevation.toFixed(0)} deg</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>
                  {Math.round(visibilityPass.duration_seconds / 60)} min
                </strong>
              </div>
            </article>
          ))}

          {passesStatus === "ready" && passes.length === 0 && (
            <p className="empty-state">No visible passes in the next 24 hours.</p>
          )}
        </div>
      </div>
    </section>
  );
}
