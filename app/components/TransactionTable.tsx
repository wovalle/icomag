import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Owner, Tag, Transaction } from "../types";
import Pagination from "./Pagination";
import TransactionTableRow from "./TransactionTableRow";

interface TransactionTableProps {
  transactions: Transaction[];
  owners: Owner[];
  tags: Tag[];
  pagination: {
    totalCount: number;
    pageCount: number;
    currentPage: number;
    limit: number;
  };
  formatters: {
    formatCurrency: (amount: number) => string;
    formatDate: (timestamp: number) => string;
  };
  onPageChange: (page: number) => void;
  onDescriptionUpdate: (
    transactionId: number,
    description: string
  ) => Promise<void>;
  onOwnerChange: (transactionId: number, ownerId: string) => Promise<void>;
  onAddTag: (transactionId: number, tagId: string) => Promise<void>;
  onRemoveTag: (transactionId: number, tagId: number) => Promise<void>;
  isAdmin?: boolean;
}

export default function TransactionTable({
  transactions,
  owners,
  tags,
  pagination,
  formatters,
  onPageChange,
  onDescriptionUpdate,
  onOwnerChange,
  onAddTag,
  onRemoveTag,
  isAdmin = false,
}: TransactionTableProps) {
  const { formatCurrency, formatDate } = formatters;
  const [registerMode, setRegisterMode] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Check screen width on mount and when window resizes
  useEffect(() => {
    const checkScreenSize = () => {
      setViewMode(window.innerWidth < 768 ? "cards" : "table");
    };

    // Initial check
    checkScreenSize();

    // Add event listener for resize
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  return (
    <div className="bg-base-100 rounded-box shadow">
      <div className="p-4 flex flex-wrap justify-between items-center gap-2">
        <label className="cursor-pointer label gap-2">
          <span className="label-text">Register Mode</span>
          <input
            type="checkbox"
            className="checkbox"
            checked={registerMode}
            onChange={(e) => setRegisterMode(e.target.checked)}
          />
        </label>
        <div className="join">
          <button
            className={`btn btn-sm join-item ${
              viewMode === "table" ? "btn-active" : ""
            }`}
            onClick={() => setViewMode("table")}
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
                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V6.75m18.375 12.75a1.125 1.125 0 001.125-1.125V6.75m-18.375 0V4.875c0-.621.504-1.125 1.125-1.125h16.5c.621 0 1.125.504 1.125 1.125V6.75"
              />
            </svg>
          </button>
          <button
            className={`btn btn-sm join-item ${
              viewMode === "cards" ? "btn-active" : ""
            }`}
            onClick={() => setViewMode("cards")}
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
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
              />
            </svg>
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Tags</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-4">
                    No transactions found. Add your first transaction or adjust
                    your filters.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <TransactionTableRow
                    key={transaction.id}
                    transaction={transaction}
                    owners={owners}
                    tags={tags}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    onDescriptionUpdate={onDescriptionUpdate}
                    onOwnerChange={onOwnerChange}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                    isAdmin={isAdmin}
                    registerMode={registerMode}
                    opacity={
                      registerMode && transaction.tags.length > 0 ? 0.2 : 1
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-2">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base-content/70">
                No transactions found. Add your first transaction or adjust your
                filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="card bg-base-100 border border-base-300"
                  style={{
                    opacity:
                      registerMode && transaction.tags.length > 0 ? 0.2 : 1,
                  }}
                >
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm opacity-70">
                          {formatDate(transaction.date)}
                        </div>
                        <h3 className="font-medium">
                          {transaction.description ||
                            transaction.bank_description ||
                            "No description"}
                        </h3>
                        {transaction.bank_description &&
                          transaction.description !==
                            transaction.bank_description && (
                            <div className="text-xs opacity-50 mt-1">
                              Original: {transaction.bank_description}
                            </div>
                          )}
                      </div>
                      <div className="flex flex-col items-end">
                        <span
                          className={
                            transaction.type === "credit"
                              ? "text-success font-bold"
                              : "text-error font-bold"
                          }
                        >
                          {formatCurrency(transaction.amount)}
                        </span>
                        <div className="badge badge-sm mt-1">
                          {transaction.type === "credit"
                            ? "Money In"
                            : "Money Out"}
                        </div>
                      </div>
                    </div>

                    <div className="divider my-1"></div>

                    <div>
                      <div className="text-sm font-medium mb-1">Owner:</div>
                      {isAdmin ? (
                        <select
                          className="select select-sm select-bordered w-full"
                          value={transaction.owner_id || ""}
                          onChange={(e) =>
                            onOwnerChange(transaction.id, e.target.value)
                          }
                          disabled={!isAdmin}
                        >
                          <option value="">No Owner</option>
                          {owners.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.name} ({owner.apartment_id})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>
                          {transaction.owner_id
                            ? owners.find((o) => o.id === transaction.owner_id)
                                ?.name +
                              ` (${
                                owners.find(
                                  (o) => o.id === transaction.owner_id
                                )?.apartment_id
                              })`
                            : "No Owner"}
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className="text-sm font-medium mb-1">Tags:</div>
                      <div className="flex flex-wrap gap-1">
                        {transaction.tags.length > 0 ? (
                          transaction.tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="badge text-white gap-1"
                              style={{ backgroundColor: tag.color || "#888" }}
                            >
                              {tag.name}
                              {isAdmin && (
                                <button
                                  className="btn-xs btn-circle btn-ghost text-xs"
                                  onClick={() =>
                                    onRemoveTag(transaction.id, tag.id)
                                  }
                                  disabled={!isAdmin}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm opacity-70">No tags</span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex mt-2">
                          <select
                            className="select select-xs select-bordered w-full"
                            defaultValue=""
                            onChange={(e) => {
                              const tagId = e.target.value;
                              if (tagId) {
                                onAddTag(transaction.id, tagId);
                                e.target.value = "";
                              }
                            }}
                            disabled={!isAdmin}
                          >
                            <option value="">Add tag...</option>
                            {tags.map((tag) => (
                              <option key={tag.id} value={tag.id}>
                                {tag.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="card-actions justify-end mt-2">
                      <Link
                        to={`/transactions/${transaction.id}`}
                        className="btn btn-sm"
                      >
                        View Details
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            const formData = new FormData();
                            formData.append("intent", "autoAssignOwner");
                            formData.append(
                              "transaction_id",
                              transaction.id.toString()
                            );

                            // Create a fetcher instance and submit the form
                            const form = document.createElement("form");
                            form.method = "post";
                            form.action = "/transactions";

                            const input = document.createElement("input");
                            input.type = "hidden";
                            input.name = "intent";
                            input.value = "autoAssignOwner";
                            form.appendChild(input);

                            const input2 = document.createElement("input");
                            input2.type = "hidden";
                            input2.name = "transaction_id";
                            input2.value = transaction.id.toString();
                            form.appendChild(input2);

                            document.body.appendChild(form);
                            form.submit();
                            document.body.removeChild(form);
                          }}
                          className="btn btn-sm"
                        >
                          Auto-assign Owner
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Pagination
        currentPage={pagination.currentPage}
        pageCount={pagination.pageCount}
        totalCount={pagination.totalCount}
        limit={pagination.limit}
        onPageChange={onPageChange}
      />
    </div>
  );
}
