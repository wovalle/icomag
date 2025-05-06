import { and, eq, sql } from "drizzle-orm";
import { useRef, useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import {
  owners,
  transactionTags,
  transactionToTags,
  transactions,
} from "../../database/schema";
import type { Route } from "./+types/transactions";

export async function loader({ context, request }: Route.LoaderArgs) {
  try {
    // Get filter params from URL
    const url = new URL(request.url);
    const ownerId = url.searchParams.get("ownerId");
    const transactionType = url.searchParams.get("type");
    const tagId = url.searchParams.get("tagId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const searchTerm = url.searchParams.get("search") || "";
    const limit = 20;
    const offset = (page - 1) * limit;

    // Build the where clause based on filters
    let whereClause = [];

    if (ownerId) {
      whereClause.push(eq(transactions.owner_id, parseInt(ownerId)));
    }

    if (transactionType) {
      whereClause.push(eq(transactions.type, transactionType));
    }

    if (searchTerm) {
      whereClause.push(
        sql`(${transactions.description} LIKE ${"%" + searchTerm + "%"} OR 
            ${transactions.bank_description} LIKE ${"%" + searchTerm + "%"} OR 
            ${transactions.reference} LIKE ${"%" + searchTerm + "%"} OR 
            ${transactions.serial} LIKE ${"%" + searchTerm + "%"})`
      );
    }

    // Base query for transactions, always filtering out duplicates
    const baseQuery =
      whereClause.length > 0
        ? and(eq(transactions.is_duplicate, 0), ...whereClause)
        : eq(transactions.is_duplicate, 0);

    // Count total transactions for pagination
    const totalCountResult = await context.db
      .select({ count: sql`count(*)` })
      .from(transactions)
      .where(baseQuery);

    const totalCount = Number(totalCountResult[0]?.count || 0);

    // Get transactions with pagination
    let transactionsList = await context.db.query.transactions.findMany({
      where: baseQuery,
      orderBy: (transactions, { desc }) => [desc(transactions.date)],
      limit: limit,
      offset: offset,
      with: {
        owner: true,
      },
    });

    // If filtering by tag, we need to manually filter the results
    // This is a workaround since drizzle doesn't support many-to-many relation filtering directly
    if (tagId) {
      const transactionsWithTag = await context.db
        .select({ transaction_id: transactionToTags.transaction_id })
        .from(transactionToTags)
        .where(eq(transactionToTags.tag_id, parseInt(tagId)));

      const transactionIdsWithTag = transactionsWithTag.map(
        (t) => t.transaction_id
      );

      transactionsList = transactionsList.filter((transaction) =>
        transactionIdsWithTag.includes(transaction.id)
      );
    }

    // Load tags for each transaction
    const transactionIds = transactionsList.map((t) => t.id);

    // Get all transaction to tag relationships for these transactions
    const transactionTagRelations =
      transactionIds.length > 0
        ? await context.db
            .select()
            .from(transactionToTags)
            .innerJoin(
              transactionTags,
              eq(transactionToTags.tag_id, transactionTags.id)
            )
            .where(
              sql`${transactionToTags.transaction_id} IN (${sql.join(
                transactionIds,
                sql`, `
              )})`
            )
        : [];

    // Group tags by transaction id
    const transactionTagsMap = transactionTagRelations.reduce(
      (acc, { transaction_to_tags, transaction_tags }) => {
        if (!acc[transaction_to_tags.transaction_id]) {
          acc[transaction_to_tags.transaction_id] = [];
        }
        acc[transaction_to_tags.transaction_id].push(transaction_tags);
        return acc;
      },
      {}
    );

    // Add tags to each transaction
    const enhancedTransactions = transactionsList.map((transaction) => ({
      ...transaction,
      tags: transactionTagsMap[transaction.id] || [],
    }));

    // Load all owners for the dropdown
    const ownersList = await context.db.query.owners.findMany({
      where: eq(owners.is_active, 1),
      orderBy: (owners, { asc }) => [asc(owners.name)],
    });

    // Load all tags for filtering and assignment
    const tagsList = await context.db.query.transactionTags.findMany({
      orderBy: (transactionTags, { asc }) => [asc(transactionTags.name)],
    });

    return {
      transactions: enhancedTransactions,
      owners: ownersList,
      tags: tagsList,
      pagination: {
        totalCount,
        pageCount: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
      filters: {
        ownerId,
        transactionType,
        tagId,
        search: searchTerm,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error loading transactions:", error);
    return {
      transactions: [],
      owners: [],
      tags: [],
      pagination: {
        totalCount: 0,
        pageCount: 0,
        currentPage: 1,
        limit: 20,
      },
      filters: {},
      error: "Failed to load transactions",
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const type = formData.get("type");
    const amount = parseFloat(formData.get("amount"));
    const description = formData.get("description");
    const dateValue = formData.get("date");
    const owner_id = formData.get("owner_id") || null;
    const reference = formData.get("reference") || null;
    const category = formData.get("category") || null;
    const tagIds = formData.getAll("tag_ids");

    // Convert date string to unix timestamp
    const date = Math.floor(new Date(dateValue).getTime() / 1000);

    try {
      // Insert the transaction
      const [transaction] = await context.db
        .insert(transactions)
        .values({
          type,
          amount,
          description,
          date,
          owner_id,
          reference,
          category,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        })
        .returning();

      // Add tags if any were selected
      if (tagIds.length > 0) {
        const tagValues = tagIds.map((tagId) => ({
          transaction_id: transaction.id,
          tag_id: parseInt(tagId),
          created_at: Math.floor(Date.now() / 1000),
        }));

        await context.db.insert(transactionToTags).values(tagValues);
      }

      return { success: true };
    } catch (error) {
      console.error("Error creating transaction:", error);
      return { success: false, error: "Failed to create transaction" };
    }
  } else if (intent === "updateDescription") {
    const id = formData.get("id");
    const description = formData.get("description");

    try {
      await context.db
        .update(transactions)
        .set({
          description,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactions.id, parseInt(id)));

      return { success: true };
    } catch (error) {
      console.error("Error updating transaction description:", error);
      return {
        success: false,
        error: "Failed to update transaction description",
      };
    }
  } else if (intent === "assignOwner") {
    const id = formData.get("id");
    const owner_id = formData.get("owner_id") || null;

    try {
      await context.db
        .update(transactions)
        .set({
          owner_id,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactions.id, parseInt(id)));

      return { success: true };
    } catch (error) {
      console.error("Error assigning owner to transaction:", error);
      return { success: false, error: "Failed to assign owner to transaction" };
    }
  } else if (intent === "addTag") {
    const transaction_id = parseInt(formData.get("transaction_id"));
    const tag_id = parseInt(formData.get("tag_id"));

    try {
      // Check if the tag is already assigned to the transaction
      const existingTag = await context.db
        .select()
        .from(transactionToTags)
        .where(
          and(
            eq(transactionToTags.transaction_id, transaction_id),
            eq(transactionToTags.tag_id, tag_id)
          )
        )
        .limit(1);

      if (existingTag.length === 0) {
        await context.db.insert(transactionToTags).values({
          transaction_id,
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
    const transaction_id = parseInt(formData.get("transaction_id"));
    const tag_id = parseInt(formData.get("tag_id"));

    try {
      await context.db
        .delete(transactionToTags)
        .where(
          and(
            eq(transactionToTags.transaction_id, transaction_id),
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

export default function TransactionsPage() {
  const { transactions, owners, tags, pagination, filters, error } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const descriptionInputRef = useRef(null);

  const [filterType, setFilterType] = useState(filters.transactionType || "");
  const [filterOwner, setFilterOwner] = useState(filters.ownerId || "");
  const [filterTag, setFilterTag] = useState(filters.tagId || "");
  const [searchTerm, setSearchTerm] = useState(filters.search || "");

  // Format currency function
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date function
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Handle inline description editing
  const startEditingDescription = (transaction) => {
    setEditingTransaction(transaction);
    setEditedDescription(
      transaction.description || transaction.bank_description || ""
    );

    // Focus the input after it renders
    setTimeout(() => {
      if (descriptionInputRef.current) {
        descriptionInputRef.current.focus();
      }
    }, 50);
  };

  const saveDescription = async (transactionId) => {
    // Create a FormData object to submit the description update
    const formData = new FormData();
    formData.append("intent", "updateDescription");
    formData.append("id", transactionId);
    formData.append("description", editedDescription);

    // Submit the form data using fetch
    const response = await fetch("/transactions", {
      method: "POST",
      body: formData,
    });

    // Reset editing state
    setEditingTransaction(null);
    setEditedDescription("");
  };

  // Handle owner assignment
  const handleOwnerChange = async (transactionId, ownerId) => {
    const formData = new FormData();
    formData.append("intent", "assignOwner");
    formData.append("id", transactionId);
    formData.append("owner_id", ownerId);

    await fetch("/transactions", {
      method: "POST",
      body: formData,
    });
  };

  // Handle tag addition
  const handleAddTag = async (transactionId) => {
    if (!selectedTagId) return;

    const formData = new FormData();
    formData.append("intent", "addTag");
    formData.append("transaction_id", transactionId);
    formData.append("tag_id", selectedTagId);

    await fetch("/transactions", {
      method: "POST",
      body: formData,
    });

    setSelectedTagId("");
  };

  // Handle tag removal
  const handleRemoveTag = async (transactionId, tagId) => {
    const formData = new FormData();
    formData.append("intent", "removeTag");
    formData.append("transaction_id", transactionId);
    formData.append("tag_id", tagId);

    await fetch("/transactions", {
      method: "POST",
      body: formData,
    });
  };

  // Handle filter application
  const applyFilters = () => {
    const newParams = new URLSearchParams();

    if (filterType) newParams.append("type", filterType);
    if (filterOwner) newParams.append("ownerId", filterOwner);
    if (filterTag) newParams.append("tagId", filterTag);
    if (searchTerm) newParams.append("search", searchTerm);
    newParams.append("page", "1"); // Reset to first page on filter change

    setSearchParams(newParams);
  };

  // Handle filter reset
  const resetFilters = () => {
    setFilterType("");
    setFilterOwner("");
    setFilterTag("");
    setSearchTerm("");
    setSearchParams({});
  };

  // Calculate pagination range
  const goToPage = (page) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", page.toString());
    setSearchParams(newParams);
  };

  // Calculate pagination links
  const paginationLinks = [];
  for (let i = 1; i <= pagination.pageCount; i++) {
    if (
      i === 1 ||
      i === pagination.pageCount ||
      (i >= pagination.currentPage - 2 && i <= pagination.currentPage + 2)
    ) {
      paginationLinks.push(i);
    } else if (
      (i === pagination.currentPage - 3 && i > 1) ||
      (i === pagination.currentPage + 3 && i < pagination.pageCount)
    ) {
      paginationLinks.push("...");
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-gray-500">
            Manage financial transactions and link them to owners
          </p>
        </div>
        <div className="join">
          <Link to="/batches/import" className="btn btn-secondary join-item">
            Import Transactions
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary join-item"
          >
            Add Transaction
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Filter Section */}
      <div className="bg-base-200 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-2">Filter Transactions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Transaction Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="debit">Debit (Money In)</option>
              <option value="credit">Credit (Money Out)</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Owner</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="">All Owners</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.apartment_id})
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Tags</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="">All Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Search</span>
            </label>
            <div className="join w-full">
              <input
                type="text"
                placeholder="Search descriptions, references..."
                className="input input-bordered join-item flex-grow"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              />
              <button className="btn join-item" onClick={applyFilters}>
                Search
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn btn-outline mr-2" onClick={resetFilters}>
            Reset Filters
          </button>
          <button className="btn btn-primary" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </div>

      {/* Transactions Table */}
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
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    No transactions found. Add your first transaction or adjust
                    your filters.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.date)}</td>
                    <td className="max-w-xs">
                      {editingTransaction?.id === transaction.id ? (
                        <div className="flex">
                          <input
                            ref={descriptionInputRef}
                            type="text"
                            className="input input-bordered input-sm mr-1 w-full"
                            value={editedDescription}
                            onChange={(e) =>
                              setEditedDescription(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveDescription(transaction.id);
                              } else if (e.key === "Escape") {
                                setEditingTransaction(null);
                              }
                            }}
                          />
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => saveDescription(transaction.id)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setEditingTransaction(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-base-200 p-1 rounded"
                          onClick={() => startEditingDescription(transaction)}
                          title="Click to edit"
                        >
                          {transaction.description ||
                            transaction.bank_description ||
                            "No description"}
                        </div>
                      )}
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
                      <select
                        className="select select-bordered select-sm w-full max-w-xs"
                        value={transaction.owner_id || ""}
                        onChange={(e) =>
                          handleOwnerChange(transaction.id, e.target.value)
                        }
                      >
                        <option value="">No Owner</option>
                        {owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.name} ({owner.apartment_id})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {transaction.tags &&
                          transaction.tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="badge gap-1"
                              style={{ backgroundColor: tag.color || "#888" }}
                            >
                              {tag.name}
                              <button
                                className="btn btn-xs btn-circle btn-ghost"
                                onClick={() =>
                                  handleRemoveTag(transaction.id, tag.id)
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                      <div className="flex">
                        <select
                          className="select select-bordered select-xs w-full max-w-[120px]"
                          value={
                            transaction.id === parseInt(selectedOwner)
                              ? selectedTagId
                              : ""
                          }
                          onChange={(e) => {
                            setSelectedOwner(transaction.id.toString());
                            setSelectedTagId(e.target.value);
                          }}
                        >
                          <option value="">Add tag...</option>
                          {tags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn btn-xs ml-1"
                          disabled={
                            !selectedTagId ||
                            parseInt(selectedOwner) !== transaction.id
                          }
                          onClick={() => handleAddTag(transaction.id)}
                        >
                          Add
                        </button>
                      </div>
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

        {/* Pagination */}
        {pagination.pageCount > 1 && (
          <div className="flex justify-center my-4">
            <div className="join">
              <button
                className="join-item btn"
                disabled={pagination.currentPage <= 1}
                onClick={() => goToPage(pagination.currentPage - 1)}
              >
                «
              </button>

              {paginationLinks.map((link, index) =>
                typeof link === "number" ? (
                  <button
                    key={index}
                    className={`join-item btn ${
                      pagination.currentPage === link ? "btn-primary" : ""
                    }`}
                    onClick={() => goToPage(link)}
                  >
                    {link}
                  </button>
                ) : (
                  <button key={index} className="join-item btn btn-disabled">
                    {link}
                  </button>
                )
              )}

              <button
                className="join-item btn"
                disabled={pagination.currentPage >= pagination.pageCount}
                onClick={() => goToPage(pagination.currentPage + 1)}
              >
                »
              </button>
            </div>
          </div>
        )}

        {/* Pagination info */}
        <div className="text-center text-sm text-gray-600 pb-4">
          Showing{" "}
          {Math.min(
            (pagination.currentPage - 1) * pagination.limit + 1,
            pagination.totalCount
          )}{" "}
          -{" "}
          {Math.min(
            pagination.currentPage * pagination.limit,
            pagination.totalCount
          )}{" "}
          of {pagination.totalCount} transactions
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <dialog open className="modal">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg">Add New Transaction</h3>
            <form method="post">
              <input type="hidden" name="intent" value="create" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Type</span>
                  </label>
                  <select
                    name="type"
                    className="select select-bordered"
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="debit">Debit (Money In)</option>
                    <option value="credit">Credit (Money Out)</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    placeholder="0.00"
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
                    placeholder="Transaction description"
                    className="input input-bordered"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Date</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    className="input input-bordered"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Owner</span>
                  </label>
                  <select name="owner_id" className="select select-bordered">
                    <option value="">Select Owner (optional)</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} ({owner.apartment_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Reference Number</span>
                  </label>
                  <input
                    type="text"
                    name="reference"
                    placeholder="Bank reference number"
                    className="input input-bordered"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Category</span>
                  </label>
                  <input
                    type="text"
                    name="category"
                    placeholder="Category"
                    className="input input-bordered"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Tags</span>
                  </label>
                  <select
                    name="tag_ids"
                    className="select select-bordered"
                    multiple
                    size="3"
                  >
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-1">
                    Hold Ctrl (Cmd on Mac) to select multiple tags
                  </p>
                </div>
              </div>

              <div className="modal-action">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
