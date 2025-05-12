import { and, eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useSubmit,
} from "react-router";
import {
  transactionTags,
  transactionToTags,
  transactions,
} from "../../database/schema";
import {
  requireAdmin,
  requireAuthentication,
} from "../components/ProtectedRoute";
import { formatters } from "../services/transactionService";

import type { Route } from "./+types/transactions.$id";

export async function loader({ context, params }: Route.LoaderArgs) {
  // Check if the user is authenticated
  const authResult = await requireAuthentication({ context });
  console.log("authResult", authResult);
  if (authResult) return authResult;

  const id = parseInt(params.id || "0");

  if (!id) {
    return {
      transaction: null,
      owners: [],
      allTags: [],
      isAdmin: false,
      error: "Invalid transaction ID",
    };
  }

  try {
    // Get current user info
    const userInfo = context.getCurrentUser();
    const isAdmin = userInfo.isAdmin;

    // Fetch transaction with owner
    const transaction = await context.db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      with: {
        owner: true,
      },
    });

    if (!transaction) {
      return {
        transaction: null,
        owners: [],
        allTags: [],
        isAdmin,
        error: "Transaction not found",
      };
    }

    // Get tags for this transaction
    const transactionTagsList = await context.db
      .select({
        id: transactionTags.id,
        name: transactionTags.name,
        color: transactionTags.color,
      })
      .from(transactionToTags)
      .innerJoin(
        transactionTags,
        eq(transactionToTags.tag_id, transactionTags.id)
      )
      .where(eq(transactionToTags.transaction_id, id));

    // Get all owners
    const ownersList = await context.db.query.owners.findMany({
      orderBy: (owners, { asc }) => [asc(owners.name)],
    });

    // Get all tags
    const allTagsList = await context.db.query.transactionTags.findMany({
      orderBy: (transactionTags, { asc }) => [asc(transactionTags.name)],
    });

    return {
      transaction: {
        ...transaction,
        tags: transactionTagsList,
      },
      owners: ownersList,
      allTags: allTagsList,
      isAdmin,
      error: null,
    };
  } catch (error) {
    console.error("Error loading transaction details:", error);
    return {
      transaction: null,
      owners: [],
      allTags: [],
      isAdmin: false,
      error: "Failed to load transaction details",
    };
  }
}

export async function action({ request, context, params }: Route.ActionArgs) {
  // Check if the user is an admin
  const adminResult = await requireAdmin({ context });
  if (adminResult) return adminResult;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = parseInt(params.id || "0");

  if (!id) {
    return { success: false, error: "Invalid transaction ID" };
  }

  if (intent === "updateDescription") {
    const description = formData.get("description") as string;

    try {
      await context.db
        .update(transactions)
        .set({
          description,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactions.id, id));

      return { success: true };
    } catch (error) {
      console.error("Error updating transaction description:", error);
      return {
        success: false,
        error: "Failed to update transaction description",
      };
    }
  } else if (intent === "assignOwner") {
    const owner_id =
      formData.get("owner_id") === "null"
        ? null
        : parseInt(formData.get("owner_id") as string);

    try {
      await context.db
        .update(transactions)
        .set({
          owner_id,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactions.id, id));

      return { success: true };
    } catch (error) {
      console.error("Error assigning owner to transaction:", error);
      return { success: false, error: "Failed to assign owner to transaction" };
    }
  } else if (intent === "addTag") {
    const tag_id = parseInt(formData.get("tag_id") as string);

    try {
      // Check if the tag is already assigned to the transaction
      const existingTag = await context.db
        .select()
        .from(transactionToTags)
        .where(
          and(
            eq(transactionToTags.transaction_id, id),
            eq(transactionToTags.tag_id, tag_id)
          )
        )
        .limit(1);

      if (existingTag.length === 0) {
        await context.db.insert(transactionToTags).values({
          transaction_id: id,
          tag_id,
          created_at: Math.floor(Date.now() / 1000),
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error adding tag to transaction:", error);
      return { success: false, error: "Failed to add tag to transaction" };
    }
  } else if (intent === "removeTag") {
    const tag_id = parseInt(formData.get("tag_id") as string);

    try {
      await context.db
        .delete(transactionToTags)
        .where(
          and(
            eq(transactionToTags.transaction_id, id),
            eq(transactionToTags.tag_id, tag_id)
          )
        );

      return { success: true };
    } catch (error) {
      console.error("Error removing tag from transaction:", error);
      return { success: false, error: "Failed to remove tag from transaction" };
    }
  }

  return { success: false, error: "Invalid action" };
}

export default function TransactionDetail() {
  const {
    transaction,
    owners,
    allTags,
    isAdmin,
    error: loaderError,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setEditedDescription(transaction.description || "");
    }
  }, [transaction]);

  const handleUpdateDescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setActionError(
        "Admin privileges required to update transaction description"
      );
      return;
    }

    const formData = new FormData();
    formData.append("intent", "updateDescription");
    formData.append("description", editedDescription);

    submit(formData, { method: "post" });
    setIsEditing(false);
  };

  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to assign owners");
      return;
    }

    const ownerId = e.target.value;
    const formData = new FormData();
    formData.append("intent", "assignOwner");
    formData.append("owner_id", ownerId);

    submit(formData, { method: "post" });
  };

  const handleAddTag = () => {
    if (!isAdmin) {
      setActionError("Admin privileges required to add tags");
      return;
    }

    if (!selectedTagId) return;

    const formData = new FormData();
    formData.append("intent", "addTag");
    formData.append("tag_id", selectedTagId);

    submit(formData, { method: "post" });
    setSelectedTagId("");
  };

  const handleRemoveTag = (tagId: number) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to remove tags");
      return;
    }

    const formData = new FormData();
    formData.append("intent", "removeTag");
    formData.append("tag_id", tagId.toString());

    submit(formData, { method: "post" });
  };

  // Render loading state
  if (!transaction && !loaderError) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Render error state
  if (loaderError || actionError) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="alert alert-error shadow-lg max-w-md">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{loaderError || actionError}</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/transactions")}
          className="btn btn-primary mt-4"
        >
          Back to Transactions
        </button>
      </div>
    );
  }

  // Render transaction not found
  if (!transaction) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="alert alert-warning shadow-lg max-w-md">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Transaction not found</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/transactions")}
          className="btn btn-primary mt-4"
        >
          Back to Transactions
        </button>
      </div>
    );
  }

  const owner = transaction.owner;

  // Rest of your component remains largely the same, just using the loaderData
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Link to="/transactions" className="btn btn-ghost mr-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">Transaction Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Transaction Information</h2>
            <div className="divider"></div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Transaction ID
                </span>
                <span>{transaction.id}</span>
              </div>

              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Date
                </span>
                <span>{formatters.formatDate(transaction.date)}</span>
              </div>

              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Amount
                </span>
                <span
                  className={`text-lg font-bold ${
                    transaction.type === "credit"
                      ? "text-success"
                      : "text-error"
                  }`}
                >
                  {formatters.formatCurrency(transaction.amount)}
                </span>
              </div>

              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Type
                </span>
                <div className="badge badge-outline">
                  {transaction.type === "credit" ? "Credit" : "Debit"}
                </div>
              </div>

              {transaction.reference && (
                <div>
                  <span className="font-semibold block text-sm opacity-70">
                    Reference
                  </span>
                  <span>{transaction.reference}</span>
                </div>
              )}

              {transaction.serial && (
                <div>
                  <span className="font-semibold block text-sm opacity-70">
                    Serial
                  </span>
                  <span>{transaction.serial}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Description</h2>
            <div className="divider"></div>

            {isEditing ? (
              <Form onSubmit={handleUpdateDescription}>
                <textarea
                  className="textarea textarea-bordered w-full"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={4}
                ></textarea>
                <div className="flex gap-2 mt-2">
                  <button type="submit" className="btn btn-primary">
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedDescription(transaction.description || "");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </Form>
            ) : (
              <div>
                <p className="mb-4">{transaction.description}</p>
                {isAdmin && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Description
                  </button>
                )}
              </div>
            )}

            <div className="mt-4">
              <span className="font-semibold block text-sm opacity-70">
                Bank Description
              </span>
              <p className="text-sm opacity-80">
                {transaction.bank_description}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Owner</h2>
            <div className="divider"></div>

            {isAdmin ? (
              <Form method="post">
                <input type="hidden" name="intent" value="assignOwner" />
                <select
                  name="owner_id"
                  className="select select-bordered w-full"
                  value={transaction.owner_id?.toString() || "null"}
                  onChange={handleOwnerChange}
                >
                  <option value="null">Not assigned</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id.toString()}>
                      {owner.name} ({owner.apartment_id})
                    </option>
                  ))}
                </select>
              </Form>
            ) : (
              <div className="mb-4">
                {owner ? (
                  <p>
                    {owner.name} ({owner.apartment_id})
                  </p>
                ) : (
                  <p className="text-sm opacity-70">No owner assigned</p>
                )}
              </div>
            )}

            {owner && (
              <div className="mt-4">
                <Link
                  to={`/owners/${owner.id}`}
                  className="btn btn-outline btn-sm btn-block"
                >
                  View Owner Details
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Tags</h2>
            <div className="divider"></div>

            <div className="flex flex-wrap gap-2 mb-4">
              {transaction.tags.length === 0 ? (
                <span className="text-sm opacity-70">No tags assigned</span>
              ) : (
                transaction.tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="badge gap-1"
                    style={{
                      backgroundColor: tag.color ?? undefined,
                      color: "#fff",
                    }}
                  >
                    {tag.name}
                    {isAdmin && (
                      <button
                        onClick={() => handleRemoveTag(tag.id)}
                        className="badge badge-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {isAdmin && (
              <div className="join">
                <select
                  className="select select-bordered join-item w-full"
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(e.target.value)}
                >
                  <option value="" disabled>
                    Add a tag
                  </option>
                  {allTags
                    .filter(
                      (tag) => !transaction.tags.some((t) => t.id === tag.id)
                    )
                    .map((tag) => (
                      <option key={tag.id} value={tag.id.toString()}>
                        {tag.name}
                      </option>
                    ))}
                </select>
                <button
                  className="btn join-item"
                  onClick={handleAddTag}
                  disabled={!selectedTagId}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
