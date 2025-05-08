import { useState } from "react";

interface Owner {
  id: number;
  name: string;
  apartment_id: string;
}

interface Tag {
  id: number;
  name: string;
}

interface TransactionFiltersProps {
  owners: Owner[];
  tags: Tag[];
  initialFilters: {
    transactionType?: string;
    ownerId?: string;
    tagId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
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

  const applyFilters = () => {
    onApplyFilters({
      type: filterType,
      ownerId: filterOwner,
      tagId: filterTag,
      search: searchTerm,
      startDate: startDate,
      endDate: endDate,
    });
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
      <h3 className="font-semibold mb-2">Filter Transactions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Transaction Type</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
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
            onChange={(e) => setFilterOwner(e.target.value)}
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
            onChange={(e) => setFilterTag(e.target.value)}
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
            onChange={(e) => setStartDate(e.target.value)}
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
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Search</span>
          </label>
          <div className="join w-full">
            <input
              type="text"
              placeholder="Search descriptions, references..."
              className="input input-bordered join-item flex-grow"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
            <button className="btn join-item" onClick={applyFilters}>
              Search
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn btn-outline mr-2" onClick={resetFilters}>
          Reset Filters
        </button>
        <button className="btn btn-primary" onClick={applyFilters}>
          Apply Filters
        </button>
      </div>
    </div>
  );
}
