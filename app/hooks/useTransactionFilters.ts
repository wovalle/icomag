import { useCallback } from "react";
import { useSearchParams } from "react-router";

// Export filter types for use elsewhere
export type TransactionFilterId =
  | "type"
  | "ownerId"
  | "tagId"
  | "search"
  | "startDate"
  | "endDate";

export type TransactionFilterValue = string | null;

export interface AppliedFilter {
  id: TransactionFilterId;
  value: string;
  label: string;
}

export interface TransactionFilters {
  type: string | null;
  ownerId: string | null;
  tagId: string | null;
  search: string | null;
  startDate: string | null;
  endDate: string | null;
  noOwner: boolean;
  noTags: boolean;
}

export interface UseTransactionFiltersReturn {
  filters: TransactionFilters;
  appliedFilters: AppliedFilter[];
  applyFilter: (
    filterId: TransactionFilterId,
    filterValue: TransactionFilterValue
  ) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

export function useTransactionFilters(
  owners: Array<{ id: number; name: string; apartment_id: string }> = [],
  tags: Array<{ id: number; name: string }> = []
): UseTransactionFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current filters from URL
  const filters: TransactionFilters = {
    type: searchParams.get("type"),
    ownerId: searchParams.get("ownerId"),
    tagId: searchParams.get("tagId"),
    search: searchParams.get("search"),
    startDate: searchParams.get("startDate"),
    endDate: searchParams.get("endDate"),
    noOwner: searchParams.get("ownerId") === "no-owner",
    noTags: searchParams.get("tagId") === "no-tags",
  };

  // Generate applied filters for display
  const appliedFilters: AppliedFilter[] = [];

  if (filters.type) {
    appliedFilters.push({
      id: "type",
      value: filters.type,
      label: filters.type === "debit" ? "Money In" : "Money Out",
    });
  }

  if (filters.ownerId) {
    const label =
      filters.ownerId === "no-owner"
        ? "No Owner"
        : owners.find((o) => o.id.toString() === filters.ownerId)?.name ||
          "Unknown Owner";
    appliedFilters.push({
      id: "ownerId",
      value: filters.ownerId,
      label,
    });
  }

  if (filters.tagId) {
    const label =
      filters.tagId === "no-tags"
        ? "No Tags"
        : tags.find((t) => t.id.toString() === filters.tagId)?.name ||
          "Unknown Tag";
    appliedFilters.push({
      id: "tagId",
      value: filters.tagId,
      label,
    });
  }

  if (filters.search) {
    appliedFilters.push({
      id: "search",
      value: filters.search,
      label: `"${filters.search}"`,
    });
  }

  if (filters.startDate) {
    appliedFilters.push({
      id: "startDate",
      value: filters.startDate,
      label: `From ${filters.startDate}`,
    });
  }

  if (filters.endDate) {
    appliedFilters.push({
      id: "endDate",
      value: filters.endDate,
      label: `Until ${filters.endDate}`,
    });
  }

  const hasActiveFilters = appliedFilters.length > 0;

  // Apply a single filter
  const applyFilter = useCallback(
    (filterId: TransactionFilterId, filterValue: TransactionFilterValue) => {
      const newParams = new URLSearchParams(searchParams);

      if (filterValue === null || filterValue === "") {
        // Remove the filter
        newParams.delete(filterId);
      } else {
        // Add/update the filter
        newParams.set(filterId, filterValue);
      }

      // Reset to first page when filters change
      newParams.set("page", "1");

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return {
    filters,
    appliedFilters,
    applyFilter,
    resetFilters,
    hasActiveFilters,
  };
}
