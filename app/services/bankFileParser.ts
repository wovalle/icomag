/**
 * Bank File Parser
 *
 * This file contains parsers for different bank transaction file formats
 */

export type ParsedTransaction = {
  type: string;
  amount: number;
  description: string | null;
  date: number; // Unix timestamp
  reference: string | null;
  serial: string | null;
  bank_description: string | null;
};

export type FileParseResult = {
  status: "success" | "error";
  message?: string;
  filename?: string;
  originalFilename?: string;
  transactions?: ParsedTransaction[];
  metadata?: {
    bank?: string;
    account?: string;
    dateRange?: string;
  };
};

/**
 * Helper function to convert date format from DD/MM/YYYY to YYYY-MM-DD
 */
function convertDateFormat(dateStr: string): string | null {
  if (!dateStr) return null;

  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr; // Return as is if not in expected format

  const day = parts[0];
  const month = parts[1];
  const year = parts[2];

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Helper function to properly split CSV lines handling quoted fields
 */
function splitCSVLine(line: string, delimiter = ","): string[] {
  const result = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(currentValue.trim());
      currentValue = "";
    } else {
      currentValue += char;
    }
  }

  // Add the last field
  result.push(currentValue.trim());

  return result;
}

/**
 * Parses a CSV file from Popular Bank
 *
 * @param file The file to parse
 * @returns A result object with parsed transactions or error
 */
export async function parsePopularTransactionsFile(
  file: File
): Promise<FileParseResult> {
  if (!file) {
    return {
      status: "error",
      message: "No file provided",
    };
  }

  try {
    // Generate a unique filename to store the batch
    const timestamp = Date.now();
    const originalFilename = file.name;
    const uniqueFilename = `${timestamp}-${originalFilename.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;

    // Parse the CSV file
    const csvText = await file.text();
    const lines = csvText.split("\n");

    // Extract metadata
    let accountNumber = "";
    const metadataLines = lines.slice(0, 8);
    for (const line of metadataLines) {
      if (line.includes("Cuenta:")) {
        accountNumber = line.replace("Cuenta:", "").trim();
        break;
      }
    }

    // Skip the first 8 lines as they're metadata
    const dataStart = lines.findIndex(
      (line) =>
        line.includes("Fecha Posteo,") ||
        line.includes("Fecha Posteo;") ||
        line.includes("Fecha Posteo|")
    );

    if (dataStart === -1) {
      return {
        status: "error",
        message:
          "CSV format not recognized. Please upload a valid Popular bank statement CSV file.",
      };
    }

    // Determine delimiter (comma, semicolon, etc.)
    const headerLine = lines[dataStart];
    let delimiter = ",";
    if (headerLine.includes(";")) delimiter = ";";
    if (headerLine.includes("|")) delimiter = "|";

    const headers = headerLine.split(delimiter).map((h) => h.trim());

    // Parse transactions after the header line, ignoring empty lines
    const parsedTransactions = lines
      .slice(dataStart + 1)
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const values = splitCSVLine(line, delimiter);

        // Create an object mapping headers to values
        return headers.reduce<Record<string, string>>((obj, header, index) => {
          obj[header] = values[index] || "";
          return obj;
        }, {});
      })
      .filter(
        (transaction) =>
          transaction["Fecha Posteo"] &&
          transaction["Monto Transacción"] &&
          (transaction["Descripción Corta"]?.includes("Débito") ||
            transaction["Descripción Corta"]?.includes("Crédito") ||
            transaction["Descripción"]?.includes("PAGO IMPUESTO"))
      )
      .map((transaction) => {
        // Determine if it's a debit or credit transaction
        const isDebit =
          transaction["Descripción Corta"]?.includes("Débito") ||
          transaction["Descripción"]?.includes("PAGO IMPUESTO");
        const type = isDebit ? "debit" : "credit";

        // Parse amount (removing commas and converting to number)
        const amountStr = transaction["Monto Transacción"].replace(/,/g, "");
        const amount = parseFloat(amountStr);

        // Parse date (DD/MM/YYYY)
        const dateString = transaction["Fecha Posteo"];
        const convertedDate = convertDateFormat(dateString);
        const date = convertedDate
          ? Math.floor(new Date(convertedDate).getTime() / 1000)
          : Math.floor(Date.now() / 1000); // Fallback to current time if date is invalid

        // Get reference and serial
        const reference = transaction["No. Referencia"] || null;
        const serial = transaction["No. Serial"] || null;
        const bankDescription = transaction["Descripción"] || null;

        return {
          type,
          amount,
          description: bankDescription,
          date,
          reference,
          serial,
          bank_description: bankDescription,
        };
      });

    if (parsedTransactions.length === 0) {
      return {
        status: "error",
        message:
          "No transactions found in the CSV file. Please check the format.",
      };
    }

    return {
      status: "success",
      filename: uniqueFilename,
      originalFilename,
      transactions: parsedTransactions,
      metadata: {
        bank: "Popular Dominicano",
        account: accountNumber,
        dateRange: metadataLines[2] || "",
      },
    };
  } catch (error) {
    console.error("Error processing CSV file:", error);
    let errorMessage = "Failed to process CSV file";
    if (error instanceof Error) {
      errorMessage = `${errorMessage}: ${error.message}`;
    }
    return {
      status: "error",
      message: errorMessage,
    };
  }
}
