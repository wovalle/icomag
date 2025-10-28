import { useState } from "react";
import { Link, useFetcher, useLoaderData, useSearchParams } from "react-router";
import AddTransactionModal from "../components/AddTransactionModal";
import TransactionFilters from "../components/TransactionFilters";
import TransactionTable from "../components/TransactionTable";
import { TransactionService, formatters } from "../services/transactionService";
import type { Route } from "./+types/transactions";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const transactionService = new TransactionService(context.dbRepository);
    const session = await context.getSession();

    // Get filter params from URL
    const url = new URL(request.url);
    const rawOwnerId = url.searchParams.get("ownerId");
    const transactionType = url.searchParams.get("type");
    const rawTagId = url.searchParams.get("tagId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const page = parseInt(url.searchParams.get("page") || "1");
    const searchTerm = url.searchParams.get("search") || "";

    // Handle special filter values
    const noOwner = rawOwnerId === "no-owner";
    const noTags = rawTagId === "no-tags";
    const ownerId = noOwner ? null : rawOwnerId;
    const tagId = noTags ? null : rawTagId;

    const limit = 20;

    // Run all queries in parallel with Promise.all
    const [transactionsResult, ownersResult, tagsResult] = await Promise.all([
      transactionService.getTransactions({
        ownerId,
        transactionType,
        tagId,
        startDate,
        endDate,
        searchTerm,
        noOwner,
        noTags,
        page,
        limit,
      }),
      transactionService.getOwners(),
      transactionService.getTagsOrderedByUsage(),
    ]);

    return {
      transactions: transactionsResult.transactions || [],
      owners: ownersResult.owners || [],
      tags: tagsResult.tags || [],
      pagination: transactionsResult.pagination,
      isAdmin: session?.isAdmin ?? false,
      error:
        transactionsResult.error ||
        ownersResult.error ||
        tagsResult.error ||
        null,
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
      isAdmin: false,
      error: "Failed to load transactions",
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin for any data modification action
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to modify transactions",
    };
  }

  const transactionService = new TransactionService(context.dbRepository);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const type = formData.get("type") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const description = formData.get("description") as string;
    const dateValue = formData.get("date") as string;
    const owner_id = formData.get("owner_id")?.toString() || null;
    const reference = formData.get("reference")?.toString() || null;
    const category = formData.get("category")?.toString() || null;
    const tagIds = formData.getAll("tag_ids").map((id) => id.toString());

    const result = await transactionService.createTransaction({
      type,
      amount,
      description,
      date: dateValue,
      owner_id,
      reference,
      category,
      tag_ids: tagIds,
    });

    return { success: result.success, error: result.error };
  } else if (intent === "updateDescription") {
    const id = parseInt(formData.get("id") as string);
    const description = formData.get("description") as string;

    const result = await transactionService.updateTransactionDescription(
      id,
      description
    );
    return { success: result.success, error: result.error };
  } else if (intent === "assignOwner") {
    const id = parseInt(formData.get("id") as string);
    const owner_id = formData.get("owner_id")?.toString() || null;

    const result = await transactionService.assignOwnerToTransaction(
      id,
      owner_id
    );
    return { success: result.success, error: result.error };
  } else if (intent === "addTag") {
    const transaction_id = parseInt(formData.get("transaction_id") as string);
    const tag_id = formData.get("tag_id") as string;

    const result = await transactionService.addTagToTransaction(
      transaction_id,
      tag_id
    );
    return { success: result.success, error: result.error };
  } else if (intent === "removeTag") {
    const transaction_id = parseInt(formData.get("transaction_id") as string);
    const tag_id = parseInt(formData.get("tag_id") as string);

    const result = await transactionService.removeTagFromTransaction(
      transaction_id,
      tag_id
    );
    return { success: result.success, error: result.error };
  } else if (intent === "autoAssignOwner") {
    // Handle auto-assigning an owner based on transaction description
    const transaction_id = parseInt(formData.get("transaction_id") as string);

    const result = await transactionService.autoAssignOwner(transaction_id);
    return {
      success: result.success,
      owner_id: result.owner_id,
      error: result.error,
    };
  } else if (intent === "uploadAttachment") {
    const transaction_id = parseInt(formData.get("transaction_id") as string);
    const file = formData.get("file") as File;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const result = await context.attachmentService.uploadAttachment(
      transaction_id,
      file
    );
    return {
      success: result.success,
      attachment: result.attachment,
      error: result.error,
    };
  } else if (intent === "deleteAttachment") {
    const attachment_id = parseInt(formData.get("attachment_id") as string);

    const result = await context.attachmentService.deleteAttachment(
      attachment_id
    );
    return {
      success: result.success,
      error: result.error,
    };
  }

  return { success: false, error: "Invalid action" };
}

export default function TransactionsPage() {
  const { transactions, owners, tags, pagination, isAdmin, error } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetcher = useFetcher<typeof action>();

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
    if (!isAdmin) {
      setActionError("Admin privileges required to update transactions");
      return;
    }

    setActionError(null);
    const formData = new FormData();
    formData.append("intent", "updateDescription");
    formData.append("id", transactionId.toString());
    formData.append("description", description);

    fetcher.submit(formData, { method: "POST" });

    if (fetcher.data?.error) {
      setActionError(fetcher.data.error);
    }
  };

  // Handle owner assignment
  const handleOwnerChange = async (transactionId: number, ownerId: string) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to assign owners");
      return;
    }

    setActionError(null);
    const formData = new FormData();
    formData.append("intent", "assignOwner");
    formData.append("id", transactionId.toString());
    formData.append("owner_id", ownerId);

    fetcher.submit(formData, { method: "POST" });

    if (fetcher.data?.error) {
      setActionError(fetcher.data.error);
    }
  };

  // Handle tag operations
  const handleAddTag = async (transactionId: number, tagId: string) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to add tags");
      return;
    }

    setActionError(null);
    const formData = new FormData();
    formData.append("intent", "addTag");
    formData.append("transaction_id", transactionId.toString());
    formData.append("tag_id", tagId);

    fetcher.submit(formData, { method: "POST" });

    if (fetcher.data?.error) {
      setActionError(fetcher.data.error);
    }
  };

  const handleRemoveTag = async (transactionId: number, tagId: number) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to remove tags");
      return;
    }

    setActionError(null);
    const formData = new FormData();
    formData.append("intent", "removeTag");
    formData.append("transaction_id", transactionId.toString());
    formData.append("tag_id", tagId.toString());

    fetcher.submit(formData, { method: "POST" });

    if (fetcher.data?.error) {
      setActionError(fetcher.data.error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-gray-500">
            Manage financial transactions and link them to owners
          </p>
        </div>
        {isAdmin && (
          <div className="join w-full sm:w-auto">
            <Link
              to="/batches/import"
              className="btn btn-secondary join-item flex-1 sm:flex-none"
            >
              Import Transactions
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary join-item flex-1 sm:flex-none"
            >
              Add Transaction
            </button>
          </div>
        )}
      </div>

      {(error || actionError) && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error || actionError}</span>
        </div>
      )}

      {/* Filter Section */}
      <TransactionFilters owners={owners} tags={tags} />

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
        isAdmin={isAdmin}
      />

      {/* Add Transaction Modal */}
      {isAdmin && (
        <AddTransactionModal
          isOpen={isModalOpen}
          owners={owners}
          tags={tags}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
