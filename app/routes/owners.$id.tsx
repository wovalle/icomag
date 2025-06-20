import { and, eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { Form, Link, useActionData, useNavigate } from "react-router";
import { useIsAdmin } from "~/hooks";
import type { Route } from "./+types/owners.$id";

import { ownerPatterns, owners, transactions } from "../../database/schema";

export async function loader({ params, context }: Route.LoaderArgs) {
  const ownerId = Number.parseInt(params.id);

  // Make sure we have a valid numeric ID
  if (isNaN(ownerId)) {
    throw new Response("Invalid owner ID", { status: 400 });
  }

  try {
    const session = await context.getSession();

    // Get repositories
    const ownersRepo = context.dbRepository.getOwnersRepository();
    const ownerPatternsRepo = context.dbRepository.getOwnerPatternsRepository();
    const transactionsRepo = context.dbRepository.getTransactionsRepository();

    // Find owner using repository
    const owner = await ownersRepo.findOne({
      where: eq(owners.id, ownerId),
    });

    if (!owner) {
      // Don't catch this error, let it propagate to the router
      throw new Response("Owner not found", { status: 404 });
    }

    // Get all recognition patterns for this owner using repository
    const patterns = await ownerPatternsRepo.findMany({
      where: eq(ownerPatterns.owner_id, ownerId),
      orderBy: [{ column: ownerPatterns.created_at, direction: "desc" }],
    });

    // Get recent transactions for this owner using repository
    const recentTransactions = await transactionsRepo.findMany({
      where: and(
        eq(transactions.owner_id, ownerId),
        eq(transactions.is_duplicate, 0)
      ),
      orderBy: [{ column: transactions.date, direction: "desc" }],
      pagination: { limit: 5 },
    });

    return {
      owner,
      patterns,
      recentTransactions,
      error: null,
      isAdmin: session?.isAdmin ?? false,
    };
  } catch (error) {
    // Only catch non-Response errors
    if (!(error instanceof Response)) {
      console.error("Error loading owner data:", error);
      throw new Response("Failed to load owner data", { status: 500 });
    }
    throw error;
  }
}

export default function OwnerDetailsPage({ loaderData }: Route.ComponentProps) {
  const { owner, patterns, recentTransactions, error } = loaderData;
  const isAdmin = useIsAdmin();
  const actionData = useActionData<any>();
  const navigate = useNavigate();
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);

  // Handle action results, including redirects
  useEffect(() => {
    if (actionData?.success && actionData?.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);

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

  if (!owner && !error) {
    return <div className="p-6">Loading...</div>;
  }

  if (!owner) {
    return (
      <div className="p-6">
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
        <div className="mt-4">
          <Link to="/owners" className="btn">
            Back to Owners
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
        <div className="mt-4">
          <Link to="/owners" className="btn">
            Back to Owners
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{owner.name}</h1>
          <p className="text-gray-500">Apartment: {owner.apartment_id}</p>
        </div>
        <div className="join mt-4 md:mt-0">
          {isAdmin ? (
            <Link to={`/owners/${owner.id}/edit`} className="btn join-item">
              Edit Owner
            </Link>
          ) : (
            <button
              className="btn join-item btn-disabled"
              title="Admin access required"
            >
              Edit Owner
            </button>
          )}
          <Link to="/owners" className="btn join-item">
            Back to Owners
          </Link>
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
          <span>Admin access required to modify owner information</span>
        </div>
      )}

      {/* Owner Information */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <h2 className="card-title">Owner Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Status:</p>
              {owner.is_active ? (
                <div className="badge badge-success">Active</div>
              ) : (
                <div className="badge badge-error">Inactive</div>
              )}
            </div>
            {owner.email && (
              <div>
                <p className="font-semibold">Email:</p>
                <p>{owner.email}</p>
              </div>
            )}
            {owner.phone && (
              <div>
                <p className="font-semibold">Phone:</p>
                <p>{owner.phone}</p>
              </div>
            )}
            <div>
              <p className="font-semibold">Created:</p>
              <p>{formatDate(owner.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recognition Patterns Section */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Recognition Patterns</h2>
            {isAdmin ? (
              <button
                onClick={() => setIsPatternModalOpen(true)}
                className="btn btn-primary btn-sm"
              >
                Add Recognition Pattern
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm btn-disabled"
                title="Admin access required"
              >
                Add Recognition Pattern
              </button>
            )}
          </div>

          {patterns.length === 0 ? (
            <div className="text-center py-4">
              <p>
                No recognition patterns found. Add a pattern to automatically
                match transactions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th className="w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((pattern) => (
                    <tr key={pattern.id}>
                      <td className="font-mono">{pattern.pattern}</td>
                      <td>{pattern.description || "N/A"}</td>
                      <td>
                        {pattern.is_active ? (
                          <div className="badge badge-success">Active</div>
                        ) : (
                          <div className="badge badge-error">Inactive</div>
                        )}
                      </td>
                      <td className="flex gap-2">
                        {isAdmin ? (
                          <>
                            <Form
                              method="post"
                              action={`/owners/${owner.id}/patterns`}
                              className="inline"
                            >
                              <input
                                type="hidden"
                                name="intent"
                                value="toggle"
                              />
                              <input
                                type="hidden"
                                name="patternId"
                                value={pattern.id}
                              />
                              <button type="submit" className="btn btn-sm">
                                {pattern.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </Form>
                            <Form
                              method="post"
                              action={`/owners/${owner.id}/patterns`}
                              className="inline"
                              onSubmit={(e) => {
                                if (
                                  !confirm(
                                    "Are you sure you want to delete this pattern?"
                                  )
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <input
                                type="hidden"
                                name="intent"
                                value="delete"
                              />
                              <input
                                type="hidden"
                                name="patternId"
                                value={pattern.id}
                              />
                              <button
                                type="submit"
                                className="btn btn-sm btn-error"
                              >
                                Delete
                              </button>
                            </Form>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-sm btn-disabled"
                              title="Admin access required"
                            >
                              {pattern.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              className="btn btn-sm btn-error btn-disabled"
                              title="Admin access required"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="card shadow-md">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Recent Transactions</h2>
            <Link
              to={`/transactions?ownerId=${owner.id}`}
              className="btn btn-sm"
            >
              View All Transactions
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-4">
              <p>No transactions found for this owner.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.date)}</td>
                      <td>{transaction.description}</td>
                      <td
                        className={
                          transaction.type === "credit"
                            ? "text-success"
                            : "text-error"
                        }
                      >
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td>
                        {transaction.type === "credit" ? (
                          <div className="badge badge-success">Money In</div>
                        ) : (
                          <div className="badge badge-error">Money Out</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Recognition Pattern Modal */}
      {isAdmin && isPatternModalOpen && (
        <dialog open className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add Recognition Pattern</h3>
            <Form method="post" action={`/owners/${owner.id}/patterns`}>
              <input type="hidden" name="intent" value="create" />
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Pattern</span>
                </label>
                <input
                  type="text"
                  name="pattern"
                  placeholder="Enter regex pattern"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <input
                  type="text"
                  name="description"
                  placeholder="e.g. Rent Payment, Utility Bill"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control mt-4">
                <label className="label cursor-pointer">
                  <span className="label-text">
                    Apply to existing transactions
                  </span>
                  <input
                    type="checkbox"
                    name="applyToExisting"
                    className="checkbox"
                    defaultChecked={true}
                  />
                </label>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">
                    Only apply to transactions with no owner
                  </span>
                  <input
                    type="checkbox"
                    name="onlyNullOwners"
                    className="checkbox"
                    defaultChecked={true}
                  />
                </label>
              </div>

              <div className="modal-action">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsPatternModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </Form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsPatternModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
