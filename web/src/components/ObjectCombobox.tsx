import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackedObjectSummary } from "../api";
import { groupLabel } from "../space";
import type { GroupedMetadata, ObjectGroup } from "../types";

type ObjectSelectorRow =
  | { type: "header"; id: string; label: string }
  | { type: "object"; id: string; object: TrackedObjectSummary };

export function ObjectCombobox({
  groupedMetadata,
  selectedObject,
  onSelect,
  label = "Object",
}: {
  groupedMetadata: GroupedMetadata;
  selectedObject: TrackedObjectSummary | null;
  onSelect: (catId: number) => void;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const search = query.trim().toLowerCase();

  const rows = useMemo(() => {
    const nextRows: ObjectSelectorRow[] = [];

    (["stations", "starlink", "other"] as ObjectGroup[]).forEach((group) => {
      const objects = groupedMetadata[group].filter((object) => {
        if (!search) return true;

        return (
          object.object_name.toLowerCase().includes(search) ||
          String(object.cat_id).includes(search)
        );
      });

      if (objects.length === 0) return;

      nextRows.push({
        type: "header",
        id: `header:${group}`,
        label: groupLabel(group),
      });

      objects.forEach((object) => {
        nextRows.push({
          type: "object",
          id: `object:${object.cat_id}`,
          object,
        });
      });
    });

    return nextRows;
  }, [groupedMetadata, search]);

  const selectableIndexes = useMemo(
    () =>
      rows.reduce<number[]>((indexes, row, index) => {
        if (row.type === "object") indexes.push(index);
        return indexes;
      }, []),
    [rows],
  );

  // TanStack Virtual exposes imperative helpers; this hook is intentionally not compiler-memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => (rows[index]?.type === "header" ? 30 : 44),
    overscan: 6,
  });

  useEffect(() => {
    setActiveIndex(selectableIndexes[0] ?? 0);
  }, [selectableIndexes]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const selectRow = (row: ObjectSelectorRow | undefined) => {
    if (!row || row.type !== "object") return;
    onSelect(row.object.cat_id);
    setQuery("");
    setIsOpen(false);
  };

  const moveActive = (direction: 1 | -1) => {
    if (selectableIndexes.length === 0) return;

    const currentSelectableIndex = Math.max(
      selectableIndexes.indexOf(activeIndex),
      0,
    );
    const nextSelectableIndex =
      (currentSelectableIndex + direction + selectableIndexes.length) %
      selectableIndexes.length;
    const nextIndex = selectableIndexes[nextSelectableIndex];

    setActiveIndex(nextIndex);
    virtualizer.scrollToIndex(nextIndex, { align: "auto" });
  };

  return (
    <div ref={rootRef} className="object-combobox">
      <label htmlFor="tracked-object-search">{label}</label>
      <button
        type="button"
        className="object-combobox-trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="object-combobox-value">
          <span>{selectedObject?.object_name ?? "Select object"}</span>
          <strong>{selectedObject?.cat_id ?? "--"}</strong>
        </span>
        <span className="object-combobox-affordance" aria-hidden="true">
          Change
          <span className="chevron" />
        </span>
      </button>

      {isOpen && (
        <div className="object-combobox-menu">
          <input
            id="tracked-object-search"
            autoFocus
            value={query}
            placeholder="Search name or NORAD ID"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActive(1);
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActive(-1);
              }

              if (event.key === "Enter") {
                event.preventDefault();
                selectRow(rows[activeIndex]);
              }

              if (event.key === "Escape") {
                setIsOpen(false);
              }
            }}
          />

          <div ref={listRef} className="object-combobox-list">
            <div
              className="object-combobox-spacer"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];

                if (row.type === "header") {
                  return (
                    <div
                      key={row.id}
                      className="object-combobox-header"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.label}
                    </div>
                  );
                }

                const isActive = virtualRow.index === activeIndex;

                return (
                  <button
                    key={row.id}
                    type="button"
                    className={isActive ? "active" : ""}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onMouseEnter={() => setActiveIndex(virtualRow.index)}
                    onClick={() => selectRow(row)}
                  >
                    <span>{row.object.object_name}</span>
                    <strong>{row.object.cat_id}</strong>
                  </button>
                );
              })}

              {rows.length === 0 && (
                <p className="object-combobox-empty">No matching objects.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
