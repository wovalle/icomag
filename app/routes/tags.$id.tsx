import { eq, ne } from "drizzle-orm";
import { useEffect, useState } from "react";
import {
  Link,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "react-router";
import {
  tagPatterns,
  transactionTags,
  transactionToTags,
} from "../../database/schema";
import type { Route } from "./+types/tags.$id";

export async function loader({ params, context, request }: Route.LoaderArgs) {
  await context.assertLoggedInUser({ context, request });

  // Get the current user to check if they're an admin
  const user = await context.getCurrentUser({ request, context });
  const isAdmin = user?.isAdmin || false;

  const tagId = Number.parseInt(params.id);

  // Make sure we have a valid numeric ID
  if (isNaN(tagId)) {
    throw new Response("Invalid tag ID", { status: 400 });
  }

  try {
    const tag = await context.db.query.transactionTags.findFirst({
      where: eq(transactionTags.id, tagId),
      with: {
        parentTag: true,
      },
    });

    if (!tag) {
      // Don't catch this error, let it propagate to the router
      throw new Response("Tag not found", { status: 404 });
    }

    // Get all tags for the parent tag selection
    const allTags = await context.db.query.transactionTags.findMany({
      where: (tags) => ne(tags.id, tagId), // Exclude current tag
      orderBy: (tags, { asc }) => [asc(tags.name)],
    });

    // Get recognition patterns for this tag
    const patterns = await context.db.query.tagPatterns.findMany({
      where: eq(tagPatterns.tag_id, tagId),
      orderBy: (patterns, { desc }) => [desc(patterns.created_at)],
    });

    // Get recent transactions for this tag
    const transactionLinks = await context.db.query.transactionToTags.findMany({
      where: eq(transactionToTags.tag_id, tagId),
      with: {
        transaction: true,
      },
      limit: 20,
    });

    const recentTransactions = transactionLinks
      .filter((link) => link.transaction !== null)
      .filter((link) => link.transaction.is_duplicate === 0)
      .map((link) => link.transaction)
      .sort((a, b) => b.date - a.date); // Sort by date descending, don't know how to do it in drizzle yet

    return {
      tag,
      allTags,
      patterns,
      recentTransactions,
      error: null,
      isAdmin,
    };
  } catch (error) {
    // Only catch non-Response errors
    if (!(error instanceof Response)) {
      console.error("Error loading tag data:", error);
      throw new Response("Failed to load tag data", { status: 500 });
    }
    throw error;
  }
}

export async function action({ request, context, params }: Route.ActionArgs) {
  await context.assertLoggedInUser({ context, request });

  // Check if the user is an admin
  const user = await context.getCurrentUser({ request, context });
  if (!user?.isAdmin) {
    return redirect("/unauthorized");
  }

  const id = parseInt(params.id || "0");
  if (!id) {
    return { success: false, error: "Invalid tag ID" };
  }

  const formData = await request.formData();
  const method = formData.get("_method");

  // Handle editing a tag
  if (method === "patch") {
    const name = formData.get("name")?.toString();
    const description = formData.get("description")?.toString() || null;
    const parentId = formData.get("parentId")?.toString();
    const color = formData.get("color")?.toString() || null;

    if (!name) {
      return { success: false, error: "Name is required", action: "edit" };
    }

    try {
      await context.db
        .update(transactionTags)
        .set({
          name,
          description,
          parent_id: parentId ? parseInt(parentId) : null,
          color,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactionTags.id, id));

      return { success: true, redirect: `/tags/${id}`, action: "edit" };
    } catch (error) {
      console.error("Error updating tag:", error);
      return { success: false, error: "Failed to update tag", action: "edit" };
    }
  }

  if (method === "delete") {
    try {
      await context.db
        .delete(transactionTags)
        .where(eq(transactionTags.id, id));
      return { success: true, redirect: "/tags", action: "delete" };
    } catch (error) {
      console.error("Error deleting tag:", error);
      return {
        success: false,
        error: "Failed to delete tag",
        action: "delete",
      };
    }
  }

  return { success: false, error: "Invalid action" };
}

export default function TagDetailsPage() {
  const { tag, allTags, patterns, recentTransactions, error, isAdmin } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create a single fetcher instance
  const fetcher = useFetcher();

  useEffect(() => {
    if (
      fetcher.formAction?.includes("/patterns") &&
      fetcher.state === "idle" &&
      fetcher.data
    ) {
      console.log("Pattern fetcher state:", fetcher.state, fetcher.data);
    }
  }, [fetcher.state, fetcher.data, fetcher.formAction]);

  // Handle redirect when action is successful
  useEffect(() => {
    if (actionData?.success && actionData?.redirect) {
      navigate(actionData.redirect);
    }

    if (actionData?.error) {
      setActionError(actionData.error);
    } else {
      setActionError(null);
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

  if (!tag && !error) {
    return <div className="p-6">Loading...</div>;
  }

  if (!tag) {
    return (
      <div className="p-6">
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
        <div className="mt-4">
          <Link to="/tags" className="btn">
            Back to Tags
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {actionError && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{actionError}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">{tag.name}</h1>
          {tag.color && (
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: tag.color }}
            ></div>
          )}
        </div>
        <div className="join mt-4 md:mt-0">
          {isAdmin && (
            <>
              <button
                className="btn join-item"
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit Tag
              </button>
              <fetcher.Form
                method="post"
                className="inline"
                onSubmit={(e) => {
                  if (
                    !confirm(
                      "Are you sure you want to delete this tag? This will remove the tag from all transactions."
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="_method" value="delete" />
                <button type="submit" className="btn btn-error join-item">
                  Delete
                </button>
              </fetcher.Form>
            </>
          )}
          <Link to="/tags" className="btn join-item">
            Back to Tags
          </Link>
        </div>
      </div>

      {/* Tag Information */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <h2 className="card-title">Tag Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Description:</p>
              <p>{tag.description || "N/A"}</p>
            </div>
            <div>
              <p className="font-semibold">Parent Tag:</p>
              <p>
                {tag.parentTag ? (
                  <Link
                    to={`/tags/${tag.parentTag.id}`}
                    className="link link-primary"
                  >
                    {tag.parentTag.name}
                  </Link>
                ) : (
                  "No parent tag"
                )}
              </p>
            </div>
            <div>
              <p className="font-semibold">Created:</p>
              <p>{formatDate(tag.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recognition Patterns Section */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Recognition Patterns</h2>
            {isAdmin && (
              <button
                onClick={() => setIsPatternModalOpen(true)}
                className="btn btn-primary btn-sm"
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
                        {isAdmin && (
                          <>
                            <fetcher.Form
                              method="post"
                              action={`/tags/${tag.id}/patterns`}
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
                            </fetcher.Form>
                            <fetcher.Form
                              method="post"
                              action={`/tags/${tag.id}/patterns`}
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
                            </fetcher.Form>
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
            <Link to={`/transactions?tagId=${tag.id}`} className="btn btn-sm">
              View All Transactions
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-4">
              <p>No transactions found with this tag.</p>
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

      {/* Edit Tag Modal */}
      {isEditModalOpen && (
        <dialog open className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Edit Tag</h3>
            <fetcher.Form method="post">
              <input type="hidden" name="_method" value="patch" />
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={tag.name}
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
                  defaultValue={tag.description || ""}
                  className="input input-bordered"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Parent Tag</span>
                </label>
                <select
                  name="parentId"
                  className="select select-bordered"
                  defaultValue={tag.parent_id?.toString() || ""}
                >
                  <option value="">No Parent Tag</option>
                  {allTags.map((otherTag) => (
                    <option key={otherTag.id} value={otherTag.id}>
                      {otherTag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Color</span>
                </label>
                <input
                  type="color"
                  name="color"
                  defaultValue={tag.color || "#000000"}
                  className="input input-bordered h-12"
                />
              </div>

              <div className="modal-action">
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsEditModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Add Recognition Pattern Modal */}
      {isPatternModalOpen && (
        <dialog open className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add Recognition Pattern</h3>
            <fetcher.Form method="post" action={`/tags/${tag.id}/patterns`}>
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
                  placeholder="e.g. Groceries, Utilities"
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
            </fetcher.Form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsPatternModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
