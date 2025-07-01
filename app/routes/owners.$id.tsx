import { and, eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { Form, Link, useActionData } from "react-router";
import { useIsAdmin } from "~/hooks";
import type { Route } from "./+types/owners.$id";

import { TrendingDown, TrendingUp, UserPen } from "lucide-react";
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
    const lpgRefillsRepo = context.dbRepository.getLpgRefillsRepository();

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

    const recentTransactions = await transactionsRepo.findManyWithTags({
      where: and(
        eq(transactions.owner_id, ownerId),
        eq(transactions.is_duplicate, 0)
      ),
      orderBy: [{ column: transactions.date, direction: "desc" }],
      pagination: { limit: 5 },
    });

    // Get refill history for this owner
    const refillHistory = await lpgRefillsRepo.findRefillsByOwnerId(ownerId);

    return {
      owner,
      patterns,
      recentTransactions,
      refillHistory,
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

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to edit owners",
    };
  }

  const ownerId = Number.parseInt(params.id);

  // Make sure we have a valid numeric ID
  if (isNaN(ownerId)) {
    return { success: false, error: "Invalid owner ID" };
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString();
    const apartment_id = formData.get("apartment_id")?.toString();
    const email = formData.get("email")?.toString() || null;
    const phone = formData.get("phone")?.toString() || null;
    const is_active = formData.get("is_active") ? 1 : 0;

    if (!name || !apartment_id) {
      return { success: false, error: "Name and Apartment ID are required" };
    }

    const updateData = {
      name,
      apartment_id,
      email,
      phone,
      is_active,
      updated_at: Math.floor(Date.now() / 1000),
    };

    await context.dbRepository
      .getOwnersRepository()
      .update(ownerId, updateData);

    return { success: true };
  } catch (error) {
    console.error("Error updating owner:", error);
    return { success: false, error: "Failed to update owner" };
  }
}

export default function OwnerDetailsPage({ loaderData }: Route.ComponentProps) {
  const { owner, patterns, recentTransactions, refillHistory, error } =
    loaderData;
  const isAdmin = useIsAdmin();
  const actionData = useActionData<any>();
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Handle action results
  useEffect(() => {
    if (actionData?.success) {
      setIsEditingOwner(false);
      setActionError(null);
    } else if (actionData?.error) {
      setActionError(actionData.error);
    }
  }, [actionData]);

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

      {actionError && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{actionError}</span>
        </div>
      )}

      {/* Owner Information */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Owner Information</h2>
            {isAdmin && !isEditingOwner && (
              <button
                onClick={() => setIsEditingOwner(true)}
                className="btn btn-sm"
              >
                <UserPen className="w-4 h-4" />
              </button>
            )}
          </div>

          {isEditingOwner && isAdmin ? (
            <Form method="post" onSubmit={() => setActionError(null)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Name</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={owner.name}
                    placeholder="Full name"
                    className="input input-bordered"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Apartment ID</span>
                  </label>
                  <input
                    type="text"
                    name="apartment_id"
                    defaultValue={owner.apartment_id}
                    placeholder="e.g. A-101"
                    className="input input-bordered"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Email</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={owner.email || ""}
                    placeholder="Email address"
                    className="input input-bordered"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Phone</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={owner.phone || ""}
                    placeholder="Phone number"
                    className="input input-bordered"
                  />
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Active</span>
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={owner.is_active === 1}
                      className="checkbox checkbox-primary"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingOwner(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </Form>
          ) : (
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
          )}
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

      {/* Transactions Section */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Transactions</h2>
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
                    <th>Tags</th>
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
                        <div className="flex items-center gap-2">
                          {transaction.type === "credit" ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          {formatCurrency(transaction.amount)}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {transaction.tags && transaction.tags.length > 0 ? (
                            transaction.tags.map((tag) => (
                              <div
                                key={tag.id}
                                className="badge badge-info badge-sm"
                              >
                                {tag.name}
                              </div>
                            ))
                          ) : (
                            <span className="text-base-content/50 text-sm">
                              No tags
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Refill History Section */}
      <div className="card shadow-md">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Refill History</h2>
            <Link to="/lpg" className="btn btn-sm btn-outline">
              View All Refills
            </Link>
          </div>

          {refillHistory && refillHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-base-content/70">
                No refill history found for this owner.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Consumption</th>
                    <th>Percentage</th>
                    <th>Tag</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refillHistory &&
                    refillHistory.map((refill: any) => (
                      <tr key={refill.id}>
                        <td>{formatDate(refill.refill_date)}</td>
                        <td className="font-semibold">
                          {formatCurrency(refill.ownerEntry?.total_amount || 0)}
                        </td>
                        <td>
                          <span className="text-info font-medium">
                            {refill.ownerEntry?.consumption?.toFixed(2) ||
                              "0.00"}{" "}
                            gal
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {refill.ownerEntry?.percentage?.toFixed(1) ||
                                "0.0"}
                              %
                            </span>
                            <progress
                              className="progress progress-primary w-16"
                              value={refill.ownerEntry?.percentage || 0}
                              max="100"
                            ></progress>
                          </div>
                        </td>
                        <td>
                          {refill.tag ? (
                            <div className="badge badge-info badge-sm">
                              {refill.tag.name}
                            </div>
                          ) : (
                            <span className="text-base-content/50 text-sm">
                              No tag
                            </span>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/lpg/${refill.id}`}
                            className="btn btn-sm btn-outline"
                          >
                            View Details
                          </Link>
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
