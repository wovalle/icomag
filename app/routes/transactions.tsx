import { and, eq, gte, lte, sql } from "drizzle-orm";
import { useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import {
  owners,
  transactionTags,
  transactionToTags,
  transactions,
} from "../../database/schema";
import AddTransactionModal from "../components/AddTransactionModal";
import TransactionFilters from "../components/TransactionFilters";
import TransactionTable from "../components/TransactionTable";
import {
  addTagToTransaction,
  assignOwnerToTransaction,
  formatters,
  removeTagFromTransaction,
  updateTransactionDescription,
} from "../services/transactionService";
import type { Route } from "./+types/transactions";

export async function loader({ context, request }: Route.LoaderArgs) {
  try {
    // Get filter params from URL
    const url = new URL(request.url);
    const ownerId = url.searchParams.get("ownerId");
    const transactionType = url.searchParams.get("type");
    const tagId = url.searchParams.get("tagId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
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

    // Add date range filters
    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      whereClause.push(gte(transactions.date, startTimestamp));
    }

    if (endDate) {
      // Set to end of day for the end date
      const endTimestamp = Math.floor(
        new Date(endDate + "T23:59:59").getTime() / 1000
      );
      whereClause.push(lte(transactions.date, endTimestamp));
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
        startDate,
        endDate,
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
  const [actionError, setActionError] = useState<string | null>(null);

  // Handle filter application
  const applyFilters = (filters: {
    type: string;
    ownerId: string;
    tagId: string;
    search: string;
    startDate: string;
    endDate: string;
  }) => {
    const newParams = new URLSearchParams();

    if (filters.type) newParams.append("type", filters.type);
    if (filters.ownerId) newParams.append("ownerId", filters.ownerId);
    if (filters.tagId) newParams.append("tagId", filters.tagId);
    if (filters.search) newParams.append("search", filters.search);
    if (filters.startDate) newParams.append("startDate", filters.startDate);
    if (filters.endDate) newParams.append("endDate", filters.endDate);
    newParams.append("page", "1"); // Reset to first page on filter change

    setSearchParams(newParams);
  };

  // Handle filter reset
  const resetFilters = () => {
    setSearchParams({});
  };

  // Handle pagination
  const goToPage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", page.toString());
    setSearchParams(newParams);
  };

  // Handle transaction description updates
  const handleDescriptionUpdate = async (
    transactionId: number,
    description: string
  ) => {
    setActionError(null);
    const result = await updateTransactionDescription(
      transactionId,
      description
    );
    if (!result.success && result.error) {
      setActionError(result.error);
    }
  };

  // Handle owner assignment
  const handleOwnerChange = async (transactionId: number, ownerId: string) => {
    setActionError(null);
    const result = await assignOwnerToTransaction(transactionId, ownerId);
    if (!result.success && result.error) {
      setActionError(result.error);
    }
  };

  // Handle tag operations
  const handleAddTag = async (transactionId: number, tagId: string) => {
    setActionError(null);
    const result = await addTagToTransaction(transactionId, tagId);
    if (!result.success && result.error) {
      setActionError(result.error);
    }
  };

  const handleRemoveTag = async (transactionId: number, tagId: number) => {
    setActionError(null);
    const result = await removeTagFromTransaction(transactionId, tagId);
    if (!result.success && result.error) {
      setActionError(result.error);
    }
  };

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

      {(error || actionError) && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error || actionError}</span>
        </div>
      )}

      {/* Filter Section */}
      <TransactionFilters
        owners={owners}
        tags={tags}
        initialFilters={filters}
        onApplyFilters={applyFilters}
        onResetFilters={resetFilters}
      />

      {/* Transactions Table */}
      <TransactionTable
        transactions={transactions}
        owners={owners}
        tags={tags}
        pagination={pagination}
        formatters={formatters}
        onPageChange={goToPage}
        onDescriptionUpdate={handleDescriptionUpdate}
        onOwnerChange={handleOwnerChange}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isModalOpen}
        owners={owners}
        tags={tags}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
