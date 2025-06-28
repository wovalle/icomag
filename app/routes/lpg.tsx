import { Link, useLoaderData } from "react-router";
import { useIsAdmin } from "~/hooks";
import type { LpgRefillWithDetails } from "../types";

interface LoaderData {
  refills: LpgRefillWithDetails[];
  error: string | null;
  isAdmin: boolean;
}

export async function loader({
  request,
  context,
}: {
  request: Request;
  context: any;
}): Promise<LoaderData> {
  try {
    const session = await context.getSession();

    // Get repository
    const lpgRefillsRepo = context.dbRepository.getLpgRefillsRepository();

    // Get refills with summary
    const refillsList = await lpgRefillsRepo.findAllWithSummary();

    return {
      refills: refillsList,
      error: null,
      isAdmin: session?.isAdmin ?? false,
    };
  } catch (error) {
    console.error("Error loading LPG refills:", error);
    return {
      refills: [],
      error: "Failed to load LPG refills",
      isAdmin: false,
    };
  }
}

export default function LpgIndex() {
  const { refills, error } = useLoaderData<LoaderData>();
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
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
            LPG Refills
          </h1>
          <p className="text-gray-500">
            Manage LPG tank refills and apartment consumption
          </p>
        </div>
        {isAdmin ? (
          <Link to="/lpg/new" className="btn btn-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Refill
          </Link>
        ) : (
          <button
            className="btn btn-primary btn-disabled"
            title="Admin access required"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Refill
          </button>
        )}
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
          <span>Admin access required to manage refills</span>
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Date</th>
              <th>Gallons</th>
              <th>Bill Amount</th>
              <th>Efficiency %</th>
              <th>Apartments</th>
              <th>Attachments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {refills.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4">
                  No LPG refills found. Add your first refill!
                </td>
              </tr>
            ) : (
              refills.map((refill: LpgRefillWithDetails) => (
                <tr key={refill.id}>
                  <td>{formatDate(refill.refill_date)}</td>
                  <td>{refill.gallons_refilled} gal</td>
                  <td>{formatCurrency(refill.bill_amount)}</td>
                  <td>{refill.efficiency_percentage || 0}%</td>
                  <td>
                    <div className="badge badge-info">
                      {refill.entries?.length || 0} apartments
                    </div>
                  </td>
                  <td>
                    {refill.attachments && refill.attachments.length > 0 ? (
                      <div className="badge badge-success">
                        {refill.attachments.length} files
                      </div>
                    ) : (
                      <div className="badge badge-ghost">No files</div>
                    )}
                  </td>
                  <td>
                    <div className="join">
                      <Link
                        to={`/lpg/${refill.id}`}
                        className="btn btn-sm join-item"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View
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
  );
}
