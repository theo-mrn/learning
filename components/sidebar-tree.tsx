"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  type ClientRect,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical } from "lucide-react";
import { SidebarItem } from "@/components/sidebar-item";
import { movePage } from "@/lib/actions";
import { flattenTree, isSelfOrDescendant, type FlattenedPage } from "@/lib/flatten-tree";
import type { PageWithChildren } from "@/lib/types";

type DropIntent = {
  targetId: string;
  /** "before"/"after" reorder as a sibling of the target; "inside" makes
   * the dragged page a child of the target instead. */
  position: "before" | "after" | "inside";
} | null;

export function SidebarSortableGroup({ pages }: { pages: PageWithChildren[] }) {
  const [syncedPages, setSyncedPages] = useState(pages);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent>(null);
  const [, startTransition] = useTransition();
  const dndContextId = useId();
  // dnd-kit only fires onDragOver when the *target* changes, not on every
  // pointer move — so it can't tell us where within that target the
  // cursor is. We track the current target's id/rect from onDragOver, and
  // recompute the before/after/inside zone on every native pointermove
  // instead, which is what actually needs the live cursor position.
  const overTargetRef = useRef<{ id: string; rect: ClientRect } | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const flatRef = useRef<FlattenedPage[]>([]);

  if (pages !== syncedPages) {
    setSyncedPages(pages);
  }

  const flat = useMemo(
    () => flattenTree(syncedPages, expandedIds),
    [syncedPages, expandedIds]
  );
  const activePage = flat.find((p) => p.id === activeId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  useEffect(() => {
    flatRef.current = flat;
  }, [flat]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const target = overTargetRef.current;
      const draggedId = draggedIdRef.current;
      if (!target || !draggedId) return;
      if (isSelfOrDescendant(flatRef.current, draggedId, target.id)) return;

      const relativeY = (e.clientY - target.rect.top) / target.rect.height;
      if (relativeY < 0.25) {
        setDropIntent({ targetId: target.id, position: "before" });
      } else if (relativeY > 0.75) {
        setDropIntent({ targetId: target.id, position: "after" });
      } else {
        setDropIntent({ targetId: target.id, position: "inside" });
      }
    }
    document.addEventListener("pointermove", onPointerMove, { capture: true });
    return () =>
      document.removeEventListener("pointermove", onPointerMove, {
        capture: true,
      });
  }, []);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !over.rect) {
      overTargetRef.current = null;
      setDropIntent(null);
      return;
    }

    const overId = String(over.id);
    if (isSelfOrDescendant(flat, String(active.id), overId)) {
      overTargetRef.current = null;
      setDropIntent(null);
      return;
    }

    overTargetRef.current = { id: overId, rect: over.rect };
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active } = event;
    const intent = dropIntent;
    if (!intent) return;

    const draggedId = String(active.id);
    const target = flat.find((p) => p.id === intent.targetId);
    if (!target) return;

    if (intent.position === "inside") {
      setExpandedIds((prev) => new Set(prev).add(target.id));
      startTransition(() => {
        movePage(draggedId, target.id, null, "after");
      });
      return;
    }

    const position = intent.position;
    startTransition(() => {
      movePage(draggedId, target.parentId, target.id, position);
    });
  }

  function resetDragState() {
    setActiveId(null);
    setDropIntent(null);
    draggedIdRef.current = null;
    overTargetRef.current = null;
  }

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => {
        setActiveId(String(e.active.id));
        draggedIdRef.current = String(e.active.id);
      }}
      onDragOver={handleDragOver}
      onDragEnd={(e) => {
        handleDragEnd(e);
        resetDragState();
      }}
      onDragCancel={resetDragState}
    >
      <SortableContext
        items={flat.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        {flat.map((page) => (
          <DroppableSidebarRow
            key={page.id}
            page={page}
            isExpanded={expandedIds.has(page.id)}
            onToggleExpanded={() => toggleExpanded(page.id)}
            dropIntent={
              dropIntent?.targetId === page.id ? dropIntent.position : null
            }
          />
        ))}
      </SortableContext>
      <DragOverlay>
        {activePage && (
          <div className="flex items-center gap-1.5 rounded-md border bg-popover px-2 py-1.5 text-sm shadow-md">
            <span className="shrink-0">
              {activePage.icon ?? (
                <FileText className="size-4 text-muted-foreground" />
              )}
            </span>
            <span className="truncate">{activePage.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableSidebarRow({
  page,
  isExpanded,
  onToggleExpanded,
  dropIntent,
}: {
  page: FlattenedPage;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  dropIntent: "before" | "after" | "inside" | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    isDragging,
  } = useSortable({ id: page.id });

  return (
    <SidebarItem
      page={page}
      itemRef={setSortableRef}
      itemStyle={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        marginLeft: page.depth * 12,
      }}
      dragHandleProps={{ attributes, listeners }}
      dragHandleIcon={<GripVertical className="size-3.5 text-muted-foreground" />}
      isExpanded={isExpanded}
      onToggleExpanded={onToggleExpanded}
      dropIndicator={dropIntent}
    />
  );
}
