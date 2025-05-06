import { eq } from "drizzle-orm";
import { Link, useLoaderData } from "react-router";
import { transactionBatches } from "../../database/schema";

type BatchLoaderData = {
  batches: any[];
  error: string | null;
};

export async function loader({ context }) {
  try {
    const batches = await context.db.query.transactionBatches.findMany({
      orderBy: (transactionBatches, { desc }) => [desc(transactionBatches.processed_at)]
    });
    
    return {
      batches,
      error: null
    };
  } catch (error) {
    console.error("Error loading transaction batches:", error);
    return {
      batches: [],
      error: "Failed to load transaction batches"
    };
  }
}

export default function BatchesPage() {
  const { batches, error } = useLoaderData<BatchLoaderData>();

  // Format date function
  const formatDate = (timestamp) => {
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
          <Link to="/batches/import" className="btn btn-primary">
            Import New Batch
          </Link>
        </div>
      </div>

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