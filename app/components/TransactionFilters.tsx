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
  };
  onApplyFilters: (filters: {
    type: string;
    ownerId: string;
    tagId: string;
    search: string;
    startDate: string;
    endDate: string;
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

  // Update filters whenever any control changes
  const handleFilterChange = (
    updater: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    updater(value);

    // Apply filters after a short delay to prevent excessive updates during typing
    setTimeout(() => {
      onApplyFilters({
        type: filterType,
        ownerId: filterOwner,
        tagId: filterTag,
        search: searchTerm,
        startDate: startDate,
        endDate: endDate,
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
    onResetFilters();
  };

  return (
    <div className="bg-base-200 p-4 rounded-lg mb-6">
      <div className="flex justify-between mb-2">
        <h3 className="font-semibold">Filter Transactions</h3>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Transaction Type</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={filterType}
            onChange={(e) => handleFilterChange(setFilterType, e.target.value)}
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
            onChange={(e) => handleFilterChange(setFilterOwner, e.target.value)}
          >
            <option value="">All Owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.apartment_id})
              </option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Tags</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={filterTag}
            onChange={(e) => handleFilterChange(setFilterTag, e.target.value)}
          >
            <option value="">All Tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
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
        <div className="form-control">
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
      </div>
    </div>
  );
}
