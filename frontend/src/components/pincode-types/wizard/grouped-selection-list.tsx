import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  ChevronDown,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react";

// ===========================
// Type Definitions
// ===========================

export interface GroupedItem {
  id: string;
  name: string;
  code?: string;
  subtitle?: string;
}

export interface ItemGroup<T extends GroupedItem> {
  id: string;
  title: string;
  subtitle?: string;
  items: T[];
}

export interface GroupedSelectionListProps<T extends GroupedItem> {
  // Data
  groups: ItemGroup<T>[];
  selectedIds: string[];

  // Callbacks
  onToggle: (item: T) => void;
  onToggleGroup: (groupId: string, items: T[]) => void;

  // UI Options
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptySearchMessage?: string;
  maxHeight?: string;

  // Loading state
  isLoading?: boolean;
}

// ===========================
// Helper Components
// ===========================

interface GroupHeaderProps {
  title: string;
  subtitle?: string;
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  onToggleAll: () => void;
  isLoading?: boolean;
}

function GroupHeader({
  title,
  subtitle,
  selectedCount,
  totalCount,
  isAllSelected,
  onToggleAll,
  isLoading,
}: GroupHeaderProps) {
  return (
    <div className="flex items-center justify-between w-full text-left">
      <div className="flex items-center gap-3 flex-1">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={onToggleAll}
          disabled={isLoading || totalCount === 0}
          className="shrink-0 pointer-events-auto"
        />
        <div className="flex flex-col">
          <span className="font-medium text-sm text-left">{title}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground text-left">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <Badge
        variant={selectedCount > 0 ? "default" : "secondary"}
        className={cn(
          "shrink-0",
          selectedCount === totalCount && selectedCount > 0 && "bg-green-600",
        )}
      >
        {selectedCount}/{totalCount}
      </Badge>
    </div>
  );
}

interface ItemRowProps {
  item: GroupedItem;
  isSelected: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

function ItemRow({ item, isSelected, onToggle, isLoading }: ItemRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 hover:bg-accent rounded-md transition-colors cursor-pointer",
        isSelected && "bg-blue-50 dark:bg-blue-950/30",
      )}
      onClick={() => !isLoading && onToggle()}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={isLoading}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{item.name}</span>
        {item.subtitle && (
          <span className="text-xs text-muted-foreground truncate block">
            {item.subtitle}
          </span>
        )}
      </div>
      {item.code && (
        <Badge variant="outline" className="shrink-0 text-xs">
          {item.code}
        </Badge>
      )}
      {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
    </div>
  );
}

// ===========================
// Main Component
// ===========================

export function GroupedSelectionList<T extends GroupedItem>({
  groups,
  selectedIds,
  onToggle,
  onToggleGroup,
  searchPlaceholder = "Search...",
  emptyMessage = "No items available",
  emptySearchMessage = "No items match your search",
  maxHeight = "400px",
  isLoading = false,
}: GroupedSelectionListProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(
    groups.map((g) => g.id),
  );

  // Sync expanded groups when groups prop changes (e.g., when data loads after initialization)
  useEffect(() => {
    if (groups.length > 0 && expandedGroups.length === 0) {
      // If we have groups but nothing expanded, expand all by default
      setExpandedGroups(groups.map((g) => g.id));
    } else if (groups.length > 0) {
      // Add any new group IDs to expanded groups
      setExpandedGroups((prev) => {
        const newIds = groups.map((g) => g.id);
        const combined = [...new Set([...prev, ...newIds])];
        return combined;
      });
    }
  }, [groups]);

  // Filter groups and items based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groups;
    }

    const query = searchQuery.toLowerCase();

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.code?.toLowerCase().includes(query) ||
            item.subtitle?.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, searchQuery]);

  // Calculate totals
  const totalItems = useMemo(() => {
    return groups.reduce((sum, group) => sum + group.items.length, 0);
  }, [groups]);

  const totalSelected = selectedIds.length;

  // Toggle group expansion
  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  // Check if all items in a group are selected
  const isGroupAllSelected = (group: ItemGroup<T>) => {
    return (
      group.items.length > 0 &&
      group.items.every((item) => selectedIds.includes(item.id))
    );
  };

  // Check if some items in a group are selected
  const isGroupSomeSelected = (group: ItemGroup<T>) => {
    return group.items.some((item) => selectedIds.includes(item.id));
  };

  return (
    <div className="space-y-4">
      {/* Search and Summary Bar */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>

        {/* Selection Summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {totalItems} item{totalItems !== 1 ? "s" : ""} available
          </span>
          {totalSelected > 0 && (
            <Badge variant="default" className="bg-blue-600">
              {totalSelected} selected
            </Badge>
          )}
        </div>
      </div>

      {/* Groups List */}
      <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery ? emptySearchMessage : emptyMessage}
            </p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={expandedGroups}
            onValueChange={(values) => setExpandedGroups(values as string[])}
            className="space-y-2"
          >
            {filteredGroups.map((group) => {
              const groupSelectedCount = group.items.filter((item) =>
                selectedIds.includes(item.id),
              ).length;
              const isAllSelected = isGroupAllSelected(group);
              const isSomeSelected = isGroupSomeSelected(group);
              const isExpanded = expandedGroups.includes(group.id);

              return (
                <AccordionItem
                  key={group.id}
                  value={group.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <AccordionTrigger
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="px-4 py-3 hover:no-underline [&[data-state=open]]:bg-accent/50 hover:bg-accent data-[state=open]:bg-accent/50"
                  >
                    <div className="flex items-center justify-between w-full pr-2">
                      <GroupHeader
                        title={group.title}
                        subtitle={group.subtitle}
                        selectedCount={groupSelectedCount}
                        totalCount={group.items.length}
                        isAllSelected={isAllSelected}
                        onToggleAll={() => onToggleGroup(group.id, group.items)}
                        isLoading={isLoading}
                      />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-0">
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          isSelected={selectedIds.includes(item.id)}
                          onToggle={() => onToggle(item)}
                          isLoading={isLoading}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* Expand/Collapse All Buttons */}
      {!isLoading && filteredGroups.length > 0 && (
        <div className="flex items-center justify gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpandedGroups(filteredGroups.map((g) => g.id))}
          >
            Expand All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpandedGroups([])}
          >
            Collapse All
          </Button>
        </div>
      )}
    </div>
  );
}
