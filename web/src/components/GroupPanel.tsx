import { groupLabel } from "../space";
import type { ObjectGroup } from "../types";

export function GroupPanel({
  selectedGroup,
  groupCounts,
  onSelectGroup,
}: {
  selectedGroup: ObjectGroup;
  groupCounts: Record<ObjectGroup, number>;
  onSelectGroup: (group: ObjectGroup) => void;
}) {
  return (
    <section className="group-panel" aria-label="Object group highlight">
      {(["stations", "starlink", "other"] as ObjectGroup[]).map((group) => (
        <button
          key={group}
          type="button"
          className={selectedGroup === group ? "active" : ""}
          onClick={() => onSelectGroup(group)}
        >
          <span>{groupLabel(group)}</span>
          <strong>{groupCounts[group]}</strong>
        </button>
      ))}
    </section>
  );
}
