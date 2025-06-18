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
  owners,
  transactionTags,
  transactionToTags,
  transactions,
} from "../../database/schema";
import { formatters } from "../services/transactionService";

import type { Route } from "./+types/transactions.$id";

export async function loader({ context, request, params }: Route.LoaderArgs) {
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
    const userInfo = await context.getSession();

    // Get repositories
    const transactionsRepo = context.dbRepository.getTransactionsRepository();
    const ownersRepo = context.dbRepository.getOwnersRepository();
    const transactionTagsRepo = context.dbRepository.forTable(
      transactionTags,
      "TAG"
    );

    // Fetch transaction with owner and attachments using repository
    const transaction = await transactionsRepo.findOneWithOwnerAndAttachments(
      eq(transactions.id, id)
    );

    if (!transaction) {
      return {
        transaction: null,
        owners: [],
        allTags: [],
        isAdmin: userInfo?.isAdmin,
        error: "Transaction not found",
      };
    }

    // Get tags for this transaction - complex join, keep raw query for now
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

    // Get all owners using repository
    const ownersList = await ownersRepo.findMany({
      orderBy: [{ column: owners.name, direction: "asc" }],
    });

    // Get all tags using repository
    const allTagsList = await transactionTagsRepo.findMany({
      orderBy: [{ column: transactionTags.name, direction: "asc" }],
    });

    return {
      transaction: {
        ...transaction,
        tags: transactionTagsList,
      },
      owners: ownersList,
      allTags: allTagsList,
      isAdmin: userInfo?.isAdmin,
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
  const session = await context.getSession();

  // Check if user is admin for any data modification action
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to modify transactions",
    };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = parseInt(params.id || "0");

  if (!id) {
    return { success: false, error: "Invalid transaction ID" };
  }

  // Get repositories
  const transactionsRepo = context.dbRepository.getTransactionsRepository();
  const transactionToTagsRepo =
    context.dbRepository.getTransactionToTagsRepository();

  if (intent === "updateDescription") {
    const description = formData.get("description") as string;

    try {
      // Update transaction using repository
      await transactionsRepo.update(id, {
        description,
      });

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
      // Update transaction owner using repository
      await transactionsRepo.update(id, {
        owner_id,
      });

      return { success: true };
    } catch (error) {
      console.error("Error assigning owner to transaction:", error);
      return { success: false, error: "Failed to assign owner to transaction" };
    }
  } else if (intent === "addTag") {
    const tag_id = parseInt(formData.get("tag_id") as string);

    try {
      // Check if the tag is already assigned to the transaction using repository
      const existingTag = await transactionToTagsRepo.findOne({
        where: and(
          eq(transactionToTags.transaction_id, id),
          eq(transactionToTags.tag_id, tag_id)
        ),
      });

      if (!existingTag) {
        // Create tag association using repository
        await transactionToTagsRepo.create({
          transaction_id: id,
          tag_id,
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
      // Find and delete the specific tag association
      const tagAssociation = await transactionToTagsRepo.findOne({
        where: and(
          eq(transactionToTags.transaction_id, id),
          eq(transactionToTags.tag_id, tag_id)
        ),
      });

      if (tagAssociation) {
        await transactionToTagsRepo.delete(tagAssociation.id);
      }

      return { success: true };
    } catch (error) {
      console.error("Error removing tag from transaction:", error);
      return { success: false, error: "Failed to remove tag from transaction" };
    }
  } else if (intent === "uploadAttachment") {
    const transaction_id = parseInt(formData.get("transaction_id") as string);
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      return { success: false, error: "File is required" };
    }

    try {
      // Here you would implement the file upload logic
      // For now, we just simulate a successful upload
      console.log("Uploading file:", file.name);

      return { success: true };
    } catch (error) {
      console.error("Error uploading file:", error);
      return { success: false, error: "Failed to upload file" };
    }
  } else if (intent === "deleteAttachment") {
    const attachment_id = formData.get("attachment_id");

    try {
      // Here you would implement the file deletion logic
      // For now, we just simulate a successful deletion
      console.log("Deleting attachment ID:", attachment_id);

      return { success: true };
    } catch (error) {
      console.error("Error deleting attachment:", error);
      return { success: false, error: "Failed to delete attachment" };
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

  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

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
          <span>Admin access required to modify transaction details</span>
        </div>
      )}

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

        {/* New Card for Attachments */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Attachments</h2>
            <div className="divider"></div>

            {transaction.attachments && transaction.attachments.length > 0 ? (
              <div className="space-y-4">
                {transaction.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-2 bg-base-200 rounded-lg"
                  >
                    <div className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
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
                      <div>
                        <p className="font-medium">{attachment.filename}</p>
                        <p className="text-xs opacity-70">
                          {formatFileSize(attachment.size)} •{" "}
                          {new Date(
                            attachment.created_at * 1000
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <a
                        href={`/transactions/${transaction.id}/attachment/${attachment.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline"
                      >
                        View
                      </a>
                      {isAdmin && (
                        <Form method="post" action="/transactions">
                          <input
                            type="hidden"
                            name="intent"
                            value="deleteAttachment"
                          />
                          <input
                            type="hidden"
                            name="attachment_id"
                            value={attachment.id}
                          />
                          <button
                            type="submit"
                            className="btn btn-sm btn-error"
                          >
                            Delete
                          </button>
                        </Form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm opacity-70">
                No attachments for this transaction
              </p>
            )}

            {isAdmin && (
              <div className="mt-4">
                <Form
                  method="post"
                  action="/transactions"
                  encType="multipart/form-data"
                >
                  <input type="hidden" name="intent" value="uploadAttachment" />
                  <input
                    type="hidden"
                    name="transaction_id"
                    value={transaction.id}
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      name="file"
                      className="file-input file-input-bordered file-input-sm w-full"
                      accept="image/*,application/pdf"
                      required
                    />
                    <button type="submit" className="btn btn-sm btn-primary">
                      Upload
                    </button>
                  </div>
                  <p className="text-xs mt-1 opacity-70">
                    Accepted file types: Images, PDF documents
                  </p>
                </Form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
