"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@multica/ui/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@multica/ui/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@multica/ui/components/ui/sidebar";
import { useWorkspacePaths } from "@multica/core/paths";
import { useDeletePin, useReorderPins } from "@multica/core/pins/mutations";
import type { IssueStatus, PinnedItem } from "@multica/core/types";
import { useNavigation, AppLink } from "../navigation";
import { StatusIcon } from "../issues/components/status-icon";

function SortablePinItem({
  pin,
  href,
  pathname,
  onUnpin,
}: {
  pin: PinnedItem;
  href: string;
  pathname: string;
  onUnpin: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pin.id });
  const wasDragged = useRef(false);

  useEffect(() => {
    if (isDragging) wasDragged.current = true;
  }, [isDragging]);

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isActive = pathname === href;
  const label =
    pin.item_type === "issue" && pin.identifier ? `${pin.identifier} ${pin.title}` : pin.title;

  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={style}
      className={cn("group/pin", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <SidebarMenuButton
        size="sm"
        isActive={isActive}
        render={<AppLink href={href} draggable={false} />}
        onClick={(event) => {
          if (wasDragged.current) {
            wasDragged.current = false;
            event.preventDefault();
            return;
          }
        }}
        className={cn(
          "text-muted-foreground hover:not-data-active:bg-sidebar-accent/70 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground",
          isDragging && "pointer-events-none",
        )}
      >
        {pin.item_type === "issue" && pin.status ? (
          <StatusIcon status={pin.status as IssueStatus} className="!size-3.5 shrink-0" />
        ) : (
          <span className="flex size-3.5 shrink-0 items-center justify-center text-xs leading-none">
            {pin.icon || "📁"}
          </span>
        )}
        <span
          className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
          style={{
            maskImage: "linear-gradient(to right, black calc(100% - 12px), transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, black calc(100% - 12px), transparent)",
          }}
        >
          {label}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={<span role="button" />}
            className="hidden size-2.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground group-hover/pin:flex hover:text-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onUnpin();
            }}
          >
            <X className="size-1" />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            Unpin
          </TooltipContent>
        </Tooltip>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function PinnedItemsSection({ pinnedItems }: { pinnedItems: PinnedItem[] }) {
  const { pathname } = useNavigation();
  const p = useWorkspacePaths();
  const deletePin = useDeletePin();
  const reorderPins = useReorderPins();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Freeze the rendered order during a drag so dnd-kit animations do not fight
  // with background cache refreshes.
  const [localPinned, setLocalPinned] = useState<PinnedItem[]>(pinnedItems);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalPinned(pinnedItems);
    }
  }, [pinnedItems]);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = localPinned.findIndex((pin) => pin.id === active.id);
      const newIndex = localPinned.findIndex((pin) => pin.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(localPinned, oldIndex, newIndex);
      setLocalPinned(reordered);
      reorderPins.mutate(reordered);
    },
    [localPinned, reorderPins],
  );

  if (localPinned.length === 0) return null;

  return (
    <Collapsible defaultOpen>
      <SidebarGroup className="group/pinned">
        <SidebarGroupLabel
          render={<CollapsibleTrigger />}
          className="group/trigger cursor-pointer hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
        >
          <span>已置顶</span>
          <ChevronRight className="!size-3 ml-1 stroke-[2.5] transition-transform duration-200 group-data-[panel-open]/trigger:rotate-90" />
          <span className="ml-auto text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/pinned:opacity-100">
            {localPinned.length}
          </span>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localPinned.map((pin) => pin.id)}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu className="gap-0.5">
                  {localPinned.map((pin) => (
                    <SortablePinItem
                      key={pin.id}
                      pin={pin}
                      href={
                        pin.item_type === "issue"
                          ? p.issueDetail(pin.item_id)
                          : p.projectDetail(pin.item_id)
                      }
                      pathname={pathname}
                      onUnpin={() =>
                        deletePin.mutate({ itemType: pin.item_type, itemId: pin.item_id })
                      }
                    />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
