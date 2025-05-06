import { and, eq } from "drizzle-orm";
import { useState } from "react";
import { redirect, useLoaderData } from "react-router";
import {
  bankAccounts,
  transactionBatches,
  transactions,
} from "../../database/schema";

type ImportLoaderData = {
  error: string | null;
};

export async function loader() {
  return { error: null };
}

export async function action({ request, context }) {
  const formData = await request.formData();
  const file = formData.get("csvFile");
  const autoMatch = formData.get("autoMatch") === "on";

  if (!file || !(file instanceof File)) {
    return { error: "No file uploaded. Please select a CSV file." };
  }

  try {
    // Generate a unique filename to store the batch
    const timestamp = Date.now();
    const originalFilename = file.name;
    const uniqueFilename = `${timestamp}-${originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    
    // Parse the CSV file
    const csvText = await file.text();
    const lines = csvText.split("\\n");
    
    // Skip the first 6 lines as they're metadata
    const dataStart = lines.findIndex(line => 
      line.includes("Fecha Posteo,") || 
      line.includes("Fecha Posteo;") || 
      line.includes("Fecha Posteo|")
    );
    
    if (dataStart === -1) {
      return { error: "CSV format not recognized. Please upload a valid bank statement CSV file." };
    }
    
    // Determine delimiter (comma, semicolon, etc.)
    const headerLine = lines[dataStart];
    let delimiter = ',';
    if (headerLine.includes(';')) delimiter = ';';
    if (headerLine.includes('|')) delimiter = '|';
    
    const headers = lines[dataStart].split(delimiter).map(h => h.trim());
    
    // Parse transactions after the header line, ignoring empty lines
    const parsedTransactions = lines.slice(dataStart + 1)
      .filter(line => line.trim() !== '')
      .map(line => {
        const values = splitCSVLine(line, delimiter);
        
        // Create an object mapping headers to values
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
        }, {});
      });
    
    if (parsedTransactions.length === 0) {
      return { error: "No transactions found in the CSV file. Please check the format." };
    }

    // Create a new batch record
    const [batchRecord] = await context.db
      .insert(transactionBatches)
      .values({
        filename: uniqueFilename,
        original_filename: originalFilename,
        processed_at: Math.floor(Date.now() / 1000),
        total_transactions: parsedTransactions.length,
        new_transactions: 0, // To be updated later
        duplicated_transactions: 0, // To be updated later
        created_at: Math.floor(Date.now() / 1000),
      })
      .returning();
    
    // Get all bank accounts for auto-matching
    const allBankAccounts = autoMatch 
      ? await context.db.query.bankAccounts.findMany({
          with: { owner: true }
        }) 
      : [];
      
    // Process each transaction
    let newTransactions = 0;
    let duplicatedTransactions = 0;
    
    for (const transaction of parsedTransactions) {
      // Determine if it's a debit or credit transaction
      const type = transaction["Descripción Corta"]?.includes("Débito") ? "credit" : "debit";
      
      // Parse amount
      const amount = parseFloat(transaction["Monto Transacción"].replace(/,/g, ""));
      
      // Parse date (DD/MM/YYYY)
      const dateString = transaction["Fecha Posteo"];
      const date = Math.floor(new Date(convertDateFormat(dateString)).getTime() / 1000);
      
      // Get reference and serial
      const reference = transaction["No. Referencia"] || null;
      const serial = transaction["No. Serial"] || null;
      const bankDescription = transaction["Descripción"] || null;
      
      // Check if transaction already exists by comparing date, amount, type, and reference/serial
      const existingTransaction = await context.db.query.transactions.findFirst({
        where: and(
          eq(transactions.date, date),
          eq(transactions.amount, amount),
          eq(transactions.type, type),
          serial ? eq(transactions.serial, serial) : undefined
        )
      });
      
      // Determine owner_id through auto-matching
      let owner_id = null;
      let bank_account_id = null;
      
      if (autoMatch && type === "debit" && serial) {
        // Try to match the serial number to a bank account
        const matchingAccount = allBankAccounts.find(account => 
          serial.includes(account.account_number)
        );
        
        if (matchingAccount) {
          owner_id = matchingAccount.owner_id;
          bank_account_id = matchingAccount.id;
        }
      }
      
      if (existingTransaction) {
        // If transaction exists, mark as duplicate but still add to the batch
        duplicatedTransactions++;
        await context.db
          .insert(transactions)
          .values({
            type,
            amount,
            description: existingTransaction.description, // Keep the existing description
            date,
            owner_id: existingTransaction.owner_id, // Keep the existing owner
            bank_account_id: existingTransaction.bank_account_id,
            reference,
            category: existingTransaction.category, // Keep the existing category
            serial,
            bank_description: bankDescription,
            batch_id: batchRecord.id,
            is_duplicate: 1, // Mark as duplicate
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          });
      } else {
        // Create new transaction
        newTransactions++;
        await context.db
          .insert(transactions)
          .values({
            type,
            amount,
            description: bankDescription, // Initially use bank description
            date,
            owner_id,
            bank_account_id,
            reference,
            category: null,
            serial,
            bank_description: bankDescription,
            batch_id: batchRecord.id,
            is_duplicate: 0, // Not a duplicate
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          });
      }
    }
    
    // Update batch statistics
    await context.db
      .update(transactionBatches)
      .set({
        new_transactions: newTransactions,
        duplicated_transactions: duplicatedTransactions,
      })
      .where(eq(transactionBatches.id, batchRecord.id));
    
    return redirect("/batches");
  } catch (error) {
    console.error("Error processing CSV file:", error);
    return { error: `Failed to process CSV file: ${error.message}` };
  }
}

// Helper function to convert DD/MM/YYYY to YYYY-MM-DD for Date constructor
function convertDateFormat(dateStr) {
  if (!dateStr) return null;
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr; // Return as is if not in expected format
  
  const day = parts[0];
  const month = parts[1];
  const year = parts[2];
  
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Helper function to properly split CSV lines handling quoted fields
function splitCSVLine(line, delimiter = ',') {
  const result = [];
  let inQuotes = false;
  let currentValue = '';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // Add the last field
  result.push(currentValue.trim());
  
  return result;
}

export default function ImportBatchPage() {
  const { error } = useLoaderData<ImportLoaderData>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  
  const handleSubmit = (event) => {
    if (!fileSelected) {
      event.preventDefault();
      return;
    }
    setIsSubmitting(true);
  };
  
  const handleFileChange = (event) => {
    setFileSelected(event.target.files.length > 0);
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
        <div>
          <Link to="/batches" className="btn btn-outline">
            Back to Batches
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="bg-base-100 rounded-box shadow p-6 max-w-2xl mx-auto">
        <form method="post" encType="multipart/form-data" onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">CSV File</span>
            </label>
            <div className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center">
              <input
                type="file"
                name="csvFile"
                accept=".csv"
                className="file-input file-input-bordered w-full max-w-xs mb-2"
                onChange={handleFileChange}
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                The file should be a CSV export from your bank. The first 6 lines will be
                ignored as they contain metadata.
              </p>
            </div>
          </div>

          <div className="divider">Configuration</div>

          <div className="form-control mb-6">
            <label className="label cursor-pointer justify-start">
              <span className="label-text mr-4">Auto-match transactions to owners based on bank accounts</span>
              <input type="checkbox" name="autoMatch" className="checkbox" defaultChecked />
            </label>
            <p className="text-sm text-gray-500">
              When enabled, the system will automatically link transactions to owners
              based on the bank account number found in the transaction details.
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
        </form>
      </div>
    </div>
  );
}