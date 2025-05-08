import { eq } from "drizzle-orm";
import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "../+types/root";
import { transactionBatches, transactions } from "../../database/schema";

type BatchDetailLoaderData = {
  batch: any;
  transactions: any[];
  error: string | null;
};

export async function loader({ context, params }: Route.LoaderArgs) {
  if (!params.id) {
    return {
      batch: null,
      transactions: [],
      error: "Batch ID is required",
    };
  }

  const batchId = parseInt(params.id);

  if (isNaN(batchId)) {
    return {
      batch: null,
      transactions: [],
      error: "Invalid batch ID",
    };
  }

  try {
    // Load the batch
    const batch = await context.db.query.transactionBatches.findFirst({
      where: eq(transactionBatches.id, batchId),
    });

    if (!batch) {
      return {
        batch: null,
        transactions: [],
        error: `Batch with ID ${batchId} not found`,
      };
    }

    // Load all transactions from this batch
    const batchTransactions = await context.db.query.transactions.findMany({
      where: eq(transactions.batch_id, batchId),
      orderBy: (transactions, { desc }) => [desc(transactions.date)],
      with: {
        owner: true,
      },
    });

    return {
      batch,
      transactions: batchTransactions,
      error: null,
    };
  } catch (error) {
    console.error(`Error loading batch ${batchId}:`, error);
    return {
      batch: null,
      transactions: [],
      error: "Failed to load batch details",
    };
  }
}

export default function BatchDetailPage() {
  const { batch, transactions, error } = useLoaderData<BatchDetailLoaderData>();
  const [showDuplicates, setShowDuplicates] = useState(true);

  // Format date function
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Filter transactions based on duplicate status
  const filteredTransactions = showDuplicates
    ? transactions
    : transactions.filter((transaction) => transaction.is_duplicate === 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Batch Details</h1>
          <p className="text-gray-500">
            View transactions from batch #{batch?.id}
          </p>
        </div>
        <div>
          <Link to="/batches" className="btn btn-outline">
            Back to Batches
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {batch && (
        <>
          <div className="bg-base-100 rounded-box shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-lg font-semibold">Batch Information</h3>
                <p className="text-sm text-gray-600">
                  Original filename: {batch.original_filename}
                </p>
                <p className="text-sm text-gray-600">
                  Processed at: {formatDate(batch.processed_at)}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Transaction Statistics
                </h3>
                <p className="text-sm text-gray-600">
                  Total transactions: {batch.total_transactions}
                </p>
                <p className="text-sm text-success">
                  New transactions: {batch.new_transactions}
                </p>
                <p className="text-sm text-warning">
                  Duplicate transactions: {batch.duplicated_transactions}
                </p>
              </div>
              <div className="flex justify-end items-center">
                <label className="label cursor-pointer">
                  <span className="label-text mr-2">Show duplicates</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={showDuplicates}
                    onChange={(e) => setShowDuplicates(e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-base-100 rounded-box shadow">
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4">
                        No transactions found in this batch.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className={transaction.is_duplicate ? "opacity-60" : ""}
                      >
                        <td>{formatDate(transaction.date)}</td>
                        <td>
                          {transaction.description ||
                            transaction.bank_description ||
                            "No description"}
                          {transaction.bank_description &&
                            transaction.description !==
                              transaction.bank_description && (
                              <div className="text-xs text-gray-500 mt-1">
                                Original: {transaction.bank_description}
                              </div>
                            )}
                        </td>
                        <td
                          className={
                            transaction.type === "debit"
                              ? "text-success"
                              : "text-error"
                          }
                        >
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td>
                          {transaction.type === "debit" ? (
                            <div className="badge badge-success">Money In</div>
                          ) : (
                            <div className="badge badge-error">Money Out</div>
                          )}
                        </td>
                        <td>
                          {transaction.owner ? (
                            <Link
                              to={`/owners/${transaction.owner.id}`}
                              className="link"
                            >
                              {transaction.owner.name} (
                              {transaction.owner.apartment_id})
                            </Link>
                          ) : (
                            <span className="text-gray-400">Not assigned</span>
                          )}
                        </td>
                        <td>
                          {transaction.is_duplicate ? (
                            <div className="badge badge-warning">Duplicate</div>
                          ) : (
                            <div className="badge badge-success">New</div>
                          )}
                        </td>
                        <td>
                          <div className="join">
                            <Link
                              to={`/transactions/${transaction.id}`}
                              className="btn btn-sm btn-outline join-item"
                            >
                              Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
