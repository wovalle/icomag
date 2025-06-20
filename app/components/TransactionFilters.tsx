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
import {
  useTransactionFilters,
  type TransactionFilterId,
} from "../hooks/useTransactionFilters";
import type { Owner, Tag } from "../types";

interface TransactionFiltersProps {
  owners: Owner[];
  tags: Tag[];
}

export default function TransactionFilters({
  owners,
  tags,
}: TransactionFiltersProps) {
  const {
    filters,
    appliedFilters,
    applyFilter,
    resetFilters,
    hasActiveFilters,
  } = useTransactionFilters(owners, tags);
  const [showFilters, setShowFilters] = useState(false);

  const removeFilter = (filterId: TransactionFilterId) => {
    applyFilter(filterId, null);
  };

  const getFilterIcon = (filterId: TransactionFilterId) => {
    switch (filterId) {
      case "type":
        return CreditCard;
      case "ownerId":
        return User;
      case "tagId":
        return TagIcon;
      case "search":
        return Search;
      case "startDate":
      case "endDate":
        return Calendar;
      default:
        return Filter;
    }
  };

  return (
    <div className="bg-base-200 p-4 rounded-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <h3 className="font-semibold">Filters</h3>
          {hasActiveFilters && (
            <div className="badge badge-primary badge-sm">
              {appliedFilters.length}
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
              onClick={resetFilters}
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
          {appliedFilters.map((filter) => {
            const IconComponent = getFilterIcon(filter.id);
            return (
              <div
                key={filter.id}
                className="badge badge-primary gap-1 py-2 px-3"
              >
                <IconComponent className="w-3 h-3" />
                <span className="text-xs">{filter.label}</span>
                <button
                  onClick={() => removeFilter(filter.id)}
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
            value={filters.search || ""}
            onChange={(e) => applyFilter("search", e.target.value || null)}
          />
        </div>
      </div>

      <div className={`${showFilters ? "block" : "hidden"} md:block`}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-1">
                <CreditCard className="w-4 h-4" />
                Type
              </span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filters.type || ""}
              onChange={(e) => applyFilter("type", e.target.value || null)}
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
              value={filters.ownerId || ""}
              onChange={(e) => applyFilter("ownerId", e.target.value || null)}
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
              value={filters.tagId || ""}
              onChange={(e) => applyFilter("tagId", e.target.value || null)}
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
                  value={filters.startDate || ""}
                  onChange={(e) =>
                    applyFilter("startDate", e.target.value || null)
                  }
                />
              </div>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-sm text-base-content/70">To:</span>
                <input
                  type="date"
                  className="input input-bordered w-full text-sm"
                  value={filters.endDate || ""}
                  onChange={(e) =>
                    applyFilter("endDate", e.target.value || null)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
