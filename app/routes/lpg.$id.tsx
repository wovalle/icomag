import { Link, useLoaderData } from "react-router";
import { useIsAdmin } from "~/hooks";
import type { LpgRefillWithDetails } from "../types";

interface LoaderData {
  refill: LpgRefillWithDetails | null;
  error: string | null;
  isAdmin: boolean;
}

export async function loader({
  params,
  context,
}: {
  params: { id: string };
  context: any;
}): Promise<LoaderData> {
  try {
    const session = await context.getSession();
    const refillId = parseInt(params.id);

    if (isNaN(refillId)) {
      return {
        refill: null,
        error: "Invalid refill ID",
        isAdmin: session?.isAdmin ?? false,
      };
    }

    // Get repository
    const lpgRefillsRepo = context.dbRepository.getLpgRefillsRepository();

    // Get refill with all details
    const refill = await lpgRefillsRepo.findByIdWithDetails(refillId);

    if (!refill) {
      return {
        refill: null,
        error: "Refill not found",
        isAdmin: session?.isAdmin ?? false,
      };
    }

    return {
      refill,
      error: null,
      isAdmin: session?.isAdmin ?? false,
    };
  } catch (error) {
    console.error("Error loading LPG refill details:", error);
    return {
      refill: null,
      error: "Failed to load refill details",
      isAdmin: false,
    };
  }
}

export default function LpgRefillDetail() {
  const { refill, error } = useLoaderData<LoaderData>();
  const isAdmin = useIsAdmin();

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date function
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Calculate totals from entries
  const totalConsumption =
    refill?.entries?.reduce(
      (sum, entry) => sum + (entry.consumption || 0),
      0
    ) || 0;

  const totalAmount =
    refill?.entries?.reduce(
      (sum, entry) => sum + (entry.total_amount || 0),
      0
    ) || 0;

  if (error || !refill) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">LPG Refill Details</h1>
          <Link to="/lpg" className="btn">
            ← Back to List
          </Link>
        </div>

        <div role="alert" className="alert alert-error">
          <span>{error || "Refill not found"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 1.343-4 2.657-4a4 4 0 014 4c0-1 0-3 2-3a8 8 0 01-1.657 11.657z"
              />
            </svg>
            LPG Refill Details
          </h1>
          <p className="text-gray-500">
            Refill from {formatDate(refill.refill_date)}
          </p>
        </div>
      </div>

      {/* Refill Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Basic Information */}
        <div className="card shadow-md">
          <div className="card-body">
            <h2 className="card-title">Refill Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Date:</span>
                <span>{formatDate(refill.refill_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Gallons Refilled:</span>
                <span>{refill.gallons_refilled} gal</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Bill Amount:</span>
                <span className="font-bold text-lg">
                  {formatCurrency(refill.bill_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Efficiency Percentage:</span>
                <span>{refill.efficiency_percentage || 0}%</span>
              </div>
              {refill.tag && (
                <div className="flex justify-between">
                  <span className="font-medium">Tag:</span>
                  <div className="badge badge-info">{refill.tag.name}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="card shadow-md">
          <div className="card-body">
            <h2 className="card-title">Summary</h2>
            <div className="stats stats-vertical shadow-none">
              <div className="stat">
                <div className="stat-title">Apartments</div>
                <div className="stat-value text-2xl">
                  {refill.entries?.length || 0}
                </div>
                <div className="stat-desc">participating apartments</div>
              </div>
              <div className="stat">
                <div className="stat-title">Total Consumption</div>
                <div className="stat-value text-2xl">
                  {totalConsumption.toFixed(2)}
                </div>
                <div className="stat-desc">total gallons consumed</div>
              </div>
              <div className="stat">
                <div className="stat-title">Total Amount</div>
                <div className="stat-value text-2xl">
                  {formatCurrency(totalAmount)}
                </div>
                <div className="stat-desc">including efficiency</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attachments */}
      {refill.attachments && refill.attachments.length > 0 && (
        <div className="card shadow-md mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">Attachments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {refill.attachments.map((attachment) => (
                <div key={attachment.id} className="card bg-base-200">
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium truncate"
                          title={attachment.filename}
                        >
                          {attachment.filename}
                        </p>
                        <p className="text-sm text-gray-500">
                          {attachment.size
                            ? `${(attachment.size / 1024).toFixed(1)} KB`
                            : "Unknown size"}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="card-actions justify-end mt-2">
                        <Link
                          to={`/attachment/${attachment.id}`}
                          className="btn btn-sm btn-primary"
                          target="_blank"
                        >
                          View
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Apartment Entries Table */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <h2 className="card-title mb-4">Apartment Breakdown</h2>
          {refill.entries && refill.entries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Apartment</th>
                    <th>Owner</th>
                    <th>Previous Reading</th>
                    <th>Current Reading</th>
                    <th>Consumption</th>
                    <th>Percentage</th>
                    <th>Subtotal</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {refill.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div className="font-bold">
                          {entry.owner?.apartment_id}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <div className="font-medium">{entry.owner?.name}</div>
                          {entry.owner?.email && (
                            <div className="text-sm text-gray-500">
                              {entry.owner.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{entry.previous_reading?.toFixed(2) || "0.00"}</td>
                      <td className="font-medium">
                        {entry.current_reading?.toFixed(2) || "0.00"}
                      </td>
                      <td>
                        <span
                          className={
                            (entry.consumption || 0) >= 0
                              ? "text-success font-medium"
                              : "text-error font-medium"
                          }
                        >
                          {entry.consumption?.toFixed(2) || "0.00"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span>{entry.percentage?.toFixed(2) || "0.00"}%</span>
                          <progress
                            className="progress progress-primary w-16"
                            value={entry.percentage || 0}
                            max="100"
                          ></progress>
                        </div>
                      </td>
                      <td>{formatCurrency(entry.subtotal || 0)}</td>
                      <td className="font-bold">
                        {formatCurrency(entry.total_amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={4}>Totals</td>
                    <td>{totalConsumption.toFixed(2)}</td>
                    <td>100.00%</td>
                    <td>{formatCurrency(refill.bill_amount)}</td>
                    <td>{formatCurrency(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No apartment entries found</p>
            </div>
          )}
        </div>
      </div>

      {/* Transactions for this Refill */}
      {refill.tag && (
        <div className="card shadow-md">
          <div className="card-body">
            <h2 className="card-title mb-4">Associated Transactions</h2>
            <div className="text-center py-8">
              <p className="text-base-content/70">
                Transactions associated with tag "{refill.tag.name}" will be
                displayed here.
              </p>
              <Link
                to={`/transactions?tagId=${refill.tag.id}`}
                className="btn btn-primary mt-4"
              >
                View Transactions
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
