import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { parsePopularTransactionsFile } from "./bankFileParser";

describe("Bank File Parser", () => {
  describe("parsePopularTransactionsFile", () => {
    let csvFile: File;

    // Set up the test file before running tests
    beforeAll(async () => {
      // Read the CSV file from the public directory
      const csvPath = path.join(
        process.cwd(),
        "public",
        "Banco Popular Dominicano 537-2.csv"
      );
      const csvBuffer = fs.readFileSync(csvPath);

      // Create a File object from the CSV content
      csvFile = new File([csvBuffer], "Banco Popular Dominicano 537-2.csv", {
        type: "text/csv",
      });
    });

    it("should parse the CSV file and return valid transaction data", async () => {
      // Parse the CSV file
      const result = await parsePopularTransactionsFile(csvFile);

      // Verify the parsing was successful
      expect(result.status).toBe("success");
      expect(result.transactions).toBeDefined();
      expect(result.transactions?.length).toBeGreaterThan(0);

      // Verify metadata was extracted correctly
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.bank).toBe("Popular Dominicano");
      expect(result.metadata?.account).toContain("000000000000844987537");

      // Check the first transaction to ensure it was parsed correctly
      const firstTransaction = result.transactions?.[0];
      expect(firstTransaction).toBeDefined();
      expect(firstTransaction?.type).toBe("credit");
      expect(firstTransaction?.amount).toBe(8000);
      expect(firstTransaction?.serial).toBe("0000120117775");
      expect(firstTransaction?.bank_description).toBe(
        "Desde INTERNET 120117775"
      );

      // Verify various transaction types are included
      const hasDebits = result.transactions?.some((t) => t.type === "debit");
      const hasCredits = result.transactions?.some((t) => t.type === "credit");
      expect(hasDebits).toBe(true);
      expect(hasCredits).toBe(true);

      // Verify all transactions have required fields
      result.transactions?.forEach((transaction) => {
        expect(transaction.type).toBeDefined();
        expect(transaction.amount).toBeDefined();
        expect(transaction.date).toBeDefined();
        // Description might be null in some cases
      });
    });
  });
});
