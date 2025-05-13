import { useState } from "react";
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

  return (
    <div className="bg-base-100 rounded-box shadow">
      <div className="p-4 flex justify-end">
        <label className="cursor-pointer label gap-2">
          <span className="label-text">Register Mode</span>
          <input
            type="checkbox"
            className="checkbox"
            checked={registerMode}
            onChange={(e) => setRegisterMode(e.target.checked)}
          />
        </label>
      </div>
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
                    registerMode &&
                    (transaction.owner_id ||
                      (transaction.tags && transaction.tags.length > 0))
                      ? 0.2
                      : 1
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>

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
