import {
  Calendar,
  CreditCard,
  Filter,
  RotateCcw,
  Search,
  Tag as TagIcon,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import type { Owner, Tag } from "../types";

interface TransactionFiltersProps {
  owners: Owner[];
  tags: Tag[];
  initialFilters: {
    ownerId: string | null;
    transactionType: string | null;
    tagId: string | null;
    search: string | null;
    startDate: string | null;
    endDate: string | null;
    noOwner: boolean | null;
    noTags: boolean | null;
  };
  onApplyFilters: (filters: {
    type: string;
    ownerId: string;
    tagId: string;
    search: string;
    startDate: string;
    endDate: string;
    noOwner: boolean;
    noTags: boolean;
  }) => void;
  onResetFilters: () => void;
}

export default function TransactionFilters({
  owners,
  tags,
  initialFilters,
  onApplyFilters,
  onResetFilters,
}: TransactionFiltersProps) {
  const [filterType, setFilterType] = useState(
    initialFilters.transactionType || ""
  );
  const [filterOwner, setFilterOwner] = useState(() => {
    if (initialFilters.noOwner) return "no-owner";
    return initialFilters.ownerId || "";
  });
  const [filterTag, setFilterTag] = useState(() => {
    if (initialFilters.noTags) return "no-tags";
    return initialFilters.tagId || "";
  });
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || "");
  const [startDate, setStartDate] = useState(initialFilters.startDate || "");
  const [endDate, setEndDate] = useState(initialFilters.endDate || "");
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters function
  const applyCurrentFilters = () => {
    const isNoOwner = filterOwner === "no-owner";
    const isNoTags = filterTag === "no-tags";

    onApplyFilters({
      type: filterType,
      ownerId: isNoOwner ? "" : filterOwner,
      tagId: isNoTags ? "" : filterTag,
      search: searchTerm,
      startDate,
      endDate,
      noOwner: isNoOwner,
      noTags: isNoTags,
    });
  };

  const resetAllFilters = () => {
    setFilterType("");
    setFilterOwner("");
    setFilterTag("");
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    onResetFilters();
  };

  const removeFilter = (filterName: string) => {
    switch (filterName) {
      case "type":
        setFilterType("");
        break;
      case "owner":
        setFilterOwner("");
        break;
      case "tag":
        setFilterTag("");
        break;
      case "search":
        setSearchTerm("");
        break;
      case "startDate":
        setStartDate("");
        break;
      case "endDate":
        setEndDate("");
        break;
    }
  };

  // Get active filters for display
  const getActiveFilters = () => {
    const filters = [];

    if (filterType) {
      filters.push({
        key: "type",
        label: filterType === "debit" ? "Money In" : "Money Out",
        icon: CreditCard,
      });
    }

    if (filterOwner) {
      const label =
        filterOwner === "no-owner"
          ? "No Owner"
          : owners.find((o) => o.id.toString() === filterOwner)?.name ||
            "Unknown Owner";
      filters.push({
        key: "owner",
        label,
        icon: User,
      });
    }

    if (filterTag) {
      const label =
        filterTag === "no-tags"
          ? "No Tags"
          : tags.find((t) => t.id.toString() === filterTag)?.name ||
            "Unknown Tag";
      filters.push({
        key: "tag",
        label,
        icon: TagIcon,
      });
    }

    if (searchTerm) {
      filters.push({
        key: "search",
        label: `"${searchTerm}"`,
        icon: Search,
      });
    }

    if (startDate) {
      filters.push({
        key: "startDate",
        label: `From ${startDate}`,
        icon: Calendar,
      });
    }

    if (endDate) {
      filters.push({
        key: "endDate",
        label: `Until ${endDate}`,
        icon: Calendar,
      });
    }

    return filters;
  };

  const activeFilters = getActiveFilters();
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="bg-base-200 p-4 rounded-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <h3 className="font-semibold">Filters</h3>
          {hasActiveFilters && (
            <div className="badge badge-primary badge-sm">
              {activeFilters.length}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-ghost md:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            {showFilters ? "Hide" : "Show"}
          </button>
          {hasActiveFilters && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={resetAllFilters}
              title="Clear all filters"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-base-100 rounded-lg">
          {activeFilters.map((filter) => {
            const IconComponent = filter.icon;
            return (
              <div
                key={filter.key}
                className="badge badge-primary gap-1 py-2 px-3"
              >
                <IconComponent className="w-3 h-3" />
                <span className="text-xs">{filter.label}</span>
                <button
                  onClick={() => removeFilter(filter.key)}
                  className="ml-1 hover:bg-primary-focus rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search is always visible */}
      <div className="form-control mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/50" />
          <input
            type="text"
            placeholder="Search descriptions, references..."
            className="input input-bordered w-full pl-10"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              // Use setTimeout to apply filters after state update
              setTimeout(() => applyCurrentFilters(), 0);
            }}
          />
        </div>
      </div>

      <div className={`${showFilters ? "block" : "hidden"} md:block`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-1">
                <CreditCard className="w-4 h-4" />
                Type
              </span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setTimeout(() => applyCurrentFilters(), 0);
              }}
            >
              <option value="">All Types</option>
              <option value="debit">Money In</option>
              <option value="credit">Money Out</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-1">
                <User className="w-4 h-4" />
                Owner
              </span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterOwner}
              onChange={(e) => {
                setFilterOwner(e.target.value);
                setTimeout(() => applyCurrentFilters(), 0);
              }}
            >
              <option value="">All Owners</option>
              <option value="no-owner">No Owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.apartment_id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-1">
                <TagIcon className="w-4 h-4" />
                Tags
              </span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterTag}
              onChange={(e) => {
                setFilterTag(e.target.value);
                setTimeout(() => applyCurrentFilters(), 0);
              }}
            >
              <option value="">All Tags</option>
              <option value="no-tags">No Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Date
              </span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-sm text-base-content/70">From:</span>
                <input
                  type="date"
                  className="input input-bordered w-full text-sm"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setTimeout(() => applyCurrentFilters(), 0);
                  }}
                />
              </div>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-sm text-base-content/70">To:</span>
                <input
                  type="date"
                  className="input input-bordered w-full text-sm"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setTimeout(() => applyCurrentFilters(), 0);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
