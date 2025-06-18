import { Link, useLoaderData } from "react-router";
import { useIsAdmin } from "~/hooks";
import { transactionBatches } from "../../database/schema";
import type { Route } from "./+types/batches";

type BatchLoaderData = {
  batches: any[];
  error: string | null;
  isAdmin: boolean;
};

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const session = await context.getSession();

    // Get repository
    const transactionBatchesRepo =
      context.dbRepository.getTransactionBatchesRepository();

    // Load batches using repository with ordering
    const batches = await transactionBatchesRepo.findMany({
      orderBy: [{ column: transactionBatches.processed_at, direction: "desc" }],
    });

    return {
      batches,
      error: null,
      isAdmin: session?.isAdmin ?? false,
    };
  } catch (error) {
    console.error("Error loading transaction batches:", error);
    return {
      batches: [],
      error: "Failed to load transaction batches",
      isAdmin: false,
    };
  }
}

export default function BatchesPage() {
  const { batches, error } = useLoaderData<BatchLoaderData>();
  const isAdmin = useIsAdmin();

  // Format date function
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Transaction Batches</h1>
          <p className="text-gray-500">
            View all imported transaction batches and their status
          </p>
        </div>
        <div>
          {isAdmin ? (
            <Link to="/batches/import" className="btn btn-primary">
              Import New Batch
            </Link>
          ) : (
            <button
              className="btn btn-primary btn-disabled"
              title="Admin access required"
            >
              Import New Batch
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="alert alert-warning mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span>Admin access required to import new batches</span>
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="bg-base-100 rounded-box shadow">
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>ID</th>
                <th>Original Filename</th>
                <th>Processed At</th>
                <th>Total Transactions</th>
                <th>New Transactions</th>
                <th>Duplicated Transactions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    No transaction batches found. Import your first batch!
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.id}</td>
                    <td>{batch.original_filename}</td>
                    <td>{formatDate(batch.processed_at)}</td>
                    <td>{batch.total_transactions}</td>
                    <td className="text-success">{batch.new_transactions}</td>
                    <td className="text-warning">
                      {batch.duplicated_transactions}
                    </td>
                    <td>
                      <div className="join">
                        <Link
                          to={`/batches/${batch.id}`}
                          className="btn btn-sm join-item"
                        >
                          View Transactions
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
    </div>
  );
}
