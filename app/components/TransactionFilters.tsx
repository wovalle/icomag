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
  const [filterOwner, setFilterOwner] = useState(initialFilters.ownerId || "");
  const [filterTag, setFilterTag] = useState(initialFilters.tagId || "");
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || "");
  const [startDate, setStartDate] = useState(initialFilters.startDate || "");
  const [endDate, setEndDate] = useState(initialFilters.endDate || "");
  const [noOwner, setNoOwner] = useState(initialFilters.noOwner || false);
  const [noTags, setNoTags] = useState(initialFilters.noTags || false);
  const [showFilters, setShowFilters] = useState(false);

  // Update filters whenever any control changes
  const handleFilterChange = (
    updater: React.Dispatch<React.SetStateAction<string | boolean>>,
    value: string | boolean
  ) => {
    updater(value);

    setTimeout(() => {
      // If "No Owner" is selected, reset the owner filter
      let currentOwner = filterOwner;
      let currentNoOwner = noOwner;

      if (updater === setNoOwner && value === true) {
        currentOwner = "";
        setFilterOwner("");
      } else if (updater === setFilterOwner && value !== "") {
        currentNoOwner = false;
        setNoOwner(false);
      }

      // If "No Tags" is selected, reset the tag filter
      let currentTag = filterTag;
      let currentNoTags = noTags;

      if (updater === setNoTags && value === true) {
        currentTag = "";
        setFilterTag("");
      } else if (updater === setFilterTag && value !== "") {
        currentNoTags = false;
        setNoTags(false);
      }

      // Apply filters
      onApplyFilters({
        type: filterType,
        ownerId: updater === setFilterOwner ? value.toString() : currentOwner,
        tagId: updater === setFilterTag ? value.toString() : currentTag,
        search: searchTerm,
        startDate: startDate,
        endDate: endDate,
        noOwner: updater === setNoOwner ? Boolean(value) : currentNoOwner,
        noTags: updater === setNoTags ? Boolean(value) : currentNoTags,
      });
    }, 0);
  };

  const resetFilters = () => {
    setFilterType("");
    setFilterOwner("");
    setFilterTag("");
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setNoOwner(false);
    setNoTags(false);
    onResetFilters();
  };

  // Check if any filters are active
  const hasActiveFilters =
    filterType ||
    filterOwner ||
    filterTag ||
    searchTerm ||
    startDate ||
    endDate ||
    noOwner ||
    noTags;

  return (
    <div className="bg-base-200 p-4 rounded-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Filter Transactions</h3>
          {hasActiveFilters && (
            <div className="badge badge-primary badge-sm">Active</div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-sm btn-ghost md:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 15.75l7.5-7.5 7.5 7.5"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            )}
            Filter
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={resetFilters}
            title="Reset Filters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Search is always visible */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Search</span>
        </label>
        <input
          type="text"
          placeholder="Search descriptions, references..."
          className="input input-bordered w-full"
          value={searchTerm}
          onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
        />
      </div>

      <div className={`${showFilters ? "block" : "hidden"} md:block`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Transaction Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterType}
              onChange={(e) =>
                handleFilterChange(setFilterType, e.target.value)
              }
            >
              <option value="">All Types</option>
              <option value="debit">Debit (Money In)</option>
              <option value="credit">Credit (Money Out)</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Owner</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterOwner}
              onChange={(e) =>
                handleFilterChange(setFilterOwner, e.target.value)
              }
              disabled={noOwner}
            >
              <option value="">All Owners</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.apartment_id})
                </option>
              ))}
            </select>
            <div className="mt-2">
              <label className="cursor-pointer label justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={noOwner}
                  onChange={(e) =>
                    handleFilterChange(setNoOwner, e.target.checked)
                  }
                />
                <span className="label-text">
                  Only show transactions with no owner
                </span>
              </label>
            </div>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Tags</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterTag}
              onChange={(e) => handleFilterChange(setFilterTag, e.target.value)}
              disabled={noTags}
            >
              <option value="">All Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <div className="mt-2">
              <label className="cursor-pointer label justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={noTags}
                  onChange={(e) =>
                    handleFilterChange(setNoTags, e.target.checked)
                  }
                />
                <span className="label-text">
                  Only show transactions with no tags
                </span>
              </label>
            </div>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Start Date</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={startDate}
              onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">End Date</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={endDate}
              onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
