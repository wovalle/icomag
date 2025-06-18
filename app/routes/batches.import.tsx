import { and, eq } from "drizzle-orm";
import { useState } from "react";
import { Form, redirect, useLoaderData } from "react-router";
import { transactions } from "../../database/schema";
import { parsePopularTransactionsFile } from "../services/bankFileParser";
import type { Route } from "./+types/batches.import";

type ImportLoaderData = {
  error: string | null;
  isAdmin: boolean;
};

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    throw redirect("/batches");
  }

  return {
    error: null,
    isAdmin: session?.isAdmin ?? false,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return { error: "Admin privileges required to import batches" };
  }

  const formData = await request.formData();
  const file = formData.get("csvFile");
  const usePatternMatching = formData.get("usePatternMatching") === "on";

  if (!file || !(file instanceof File)) {
    return { error: "No file uploaded. Please select a CSV file." };
  }

  try {
    // Parse the CSV file using our extracted parser
    const parseResult = await parsePopularTransactionsFile(file);

    if (parseResult.status === "error") {
      return { error: parseResult.message };
    }

    const {
      filename,
      originalFilename,
      transactions: parsedTransactions,
    } = parseResult;

    if (!parsedTransactions || parsedTransactions.length === 0) {
      return {
        error:
          "No transactions found in the CSV file. Please check the format.",
      };
    }

    // Get repositories
    const transactionBatchesRepo =
      context.dbRepository.getTransactionBatchesRepository();
    const ownerPatternsRepo = context.dbRepository.getOwnerPatternsRepository();
    const transactionsRepo = context.dbRepository.getTransactionsRepository();

    // Create a new batch record using repository
    const batchRecord = await transactionBatchesRepo.create({
      filename: filename!,
      original_filename: originalFilename!,
      processed_at: Math.floor(Date.now() / 1000),
      total_transactions: parsedTransactions.length,
      new_transactions: 0, // To be updated later
      duplicated_transactions: 0, // To be updated later
    });

    // Get all owner patterns for pattern matching using repository
    const allOwnerPatterns = usePatternMatching
      ? await ownerPatternsRepo.findMany()
      : [];

    // Process each transaction
    let newTransactions = 0;
    let duplicatedTransactions = 0;

    for (const transaction of parsedTransactions) {
      // Check if transaction already exists by comparing date, amount, type, and reference/serial
      const existingTransaction = await transactionsRepo.findOne({
        where: and(
          eq(transactions.date, transaction.date),
          eq(transactions.amount, transaction.amount),
          eq(transactions.type, transaction.type),
          transaction.serial
            ? eq(transactions.serial, transaction.serial)
            : undefined
        ),
      });

      // Determine owner_id through auto-matching or pattern matching
      let owner_id = null;

      if (usePatternMatching && !owner_id) {
        // Try to match the transaction description to an owner pattern
        const matchingPattern = allOwnerPatterns.find(
          (pattern) =>
            transaction.description &&
            new RegExp(pattern.pattern).test(transaction.description)
        );

        if (matchingPattern) {
          owner_id = matchingPattern.owner_id;
        }
      }

      if (existingTransaction) {
        // If transaction exists, mark as duplicate but still add to the batch
        duplicatedTransactions++;
        await transactionsRepo.create({
          type: transaction.type,
          amount: transaction.amount,
          description: existingTransaction.description, // Keep the existing description
          date: transaction.date,
          owner_id: existingTransaction.owner_id, // Keep the existing owner
          reference: transaction.reference,
          category: existingTransaction.category, // Keep the existing category
          serial: transaction.serial,
          bank_description: transaction.bank_description,
          batch_id: batchRecord.id,
          is_duplicate: 1, // Mark as duplicate
        });
      } else {
        // Create new transaction
        newTransactions++;
        await transactionsRepo.create({
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description, // Initially use bank description
          date: transaction.date,
          owner_id,
          reference: transaction.reference,
          category: null,
          serial: transaction.serial,
          bank_description: transaction.bank_description,
          batch_id: batchRecord.id,
          is_duplicate: 0, // Not a duplicate
        });
      }
    }

    // Update batch statistics using repository
    await transactionBatchesRepo.update(batchRecord.id, {
      new_transactions: newTransactions,
      duplicated_transactions: duplicatedTransactions,
    });

    return redirect("/batches");
  } catch (error) {
    console.error("Error processing CSV file:", error);
    let errorMessage = "Failed to process CSV file";
    if (error instanceof Error) {
      errorMessage = `${errorMessage}: ${error.message}`;
    }
    return { error: errorMessage };
  }
}

export default function ImportBatchPage() {
  const { error } = useLoaderData<ImportLoaderData>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!fileSelected) {
      event.preventDefault();
      return;
    }
    setIsSubmitting(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      setFileSelected(false);
      return;
    }

    // Check if the file is larger than 5MB

    setFileSelected(files.length > 0);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Import Transactions</h1>
          <p className="text-gray-500">
            Upload a CSV file from your bank to import transactions
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="bg-base-100 rounded-box shadow p-6 max-w-2xl mx-auto">
        <Form
          method="post"
          encType="multipart/form-data"
          onSubmit={handleSubmit}
        >
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">CSV File</span>
            </label>
            <div className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center">
              <input
                type="file"
                name="csvFile"
                className="file-input file-input-bordered w-full max-w-xs mb-2"
                onChange={handleFileChange}
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                The file should be a CSV export from your bank. The first 6
                lines will be ignored as they contain metadata.
              </p>
            </div>
          </div>

          <div className="divider">Configuration</div>

          <div className="form-control mb-6">
            <label className="label cursor-pointer justify-start">
              <span className="label-text mr-4">
                Use pattern matching for owner identification
              </span>
              <input
                type="checkbox"
                name="usePatternMatching"
                className="checkbox"
                defaultChecked
              />
            </label>
            <p className="text-sm text-gray-500">
              When enabled, the system will use regex patterns to identify
              owners based on transaction descriptions.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
              disabled={isSubmitting || !fileSelected}
            >
              {isSubmitting ? "Processing..." : "Import Transactions"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
