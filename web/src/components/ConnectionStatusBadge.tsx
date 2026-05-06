import { formatLiveTime } from "../space";
import type { ConnectionStatus } from "../types";

export function ConnectionStatusBadge({
  connectionStatus,
  now,
}: {
  connectionStatus: ConnectionStatus;
  now: Date;
}) {
  return (
    <div className={`connection-status ${connectionStatus}`}>
      <span aria-hidden="true" />
      <strong>{connectionStatus}</strong>
      <time>{formatLiveTime(now)}</time>
    </div>
  );
}
