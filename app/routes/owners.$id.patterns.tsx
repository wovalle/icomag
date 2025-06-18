import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "react-router";
import { ownerPatterns, transactions } from "../../database/schema";

import type { Route } from "./+types/owners.$id";

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to modify owner patterns",
    };
  }

  const ownerId = parseInt(params.id);

  // Make sure we have a valid owner ID
  if (isNaN(ownerId)) {
    return { success: false, error: "Invalid owner ID" };
  }

  // Get form data
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  // Get repositories
  const ownerPatternsRepo = context.dbRepository.getOwnerPatternsRepository();
  const transactionsRepo = context.dbRepository.getTransactionsRepository();

  // Handle different operations based on intent
  switch (intent) {
    case "create": {
      const pattern = formData.get("pattern")?.toString();
      const description = formData.get("description")?.toString() || null;
      const applyToExisting = formData.get("applyToExisting") === "on";
      const onlyNullOwners = formData.get("onlyNullOwners") === "on";

      if (!pattern) {
        return { success: false, error: "Pattern is required" };
      }

      try {
        // Validate the regex pattern by attempting to create a RegExp object
        try {
          new RegExp(pattern);
        } catch (e) {
          return { success: false, error: "Invalid regex pattern" };
        }

        // Create the pattern using repository
        await ownerPatternsRepo.create({
          owner_id: ownerId,
          pattern,
          description,
          is_active: 1,
        });

        // If applyToExisting is true, assign the owner to matching transactions
        if (applyToExisting) {
          // Get all transactions that match the criteria
          const allTransactions = onlyNullOwners
            ? await transactionsRepo.findMany({
                where: isNull(transactions.owner_id),
              })
            : await transactionsRepo.findMany();

          // Create a RegExp object for the pattern
          const regex = new RegExp(pattern);

          // Filter transactions that match the pattern
          const matchingTransactions = allTransactions.filter((transaction) => {
            const transactionDescription =
              transaction.description || transaction.bank_description || "";
            return regex.test(transactionDescription);
          });

          // Update transactions to set this owner
          for (const transaction of matchingTransactions) {
            await transactionsRepo.update(transaction.id, {
              owner_id: ownerId,
            });
          }
        }

        return redirect(`/owners/${ownerId}`);
      } catch (error) {
        console.error("Error adding recognition pattern:", error);
        return { success: false, error: "Failed to add recognition pattern" };
      }
    }

    case "toggle": {
      const patternId = parseInt(formData.get("patternId")?.toString() || "0");

      try {
        // Find the pattern using repository
        const pattern = await ownerPatternsRepo.findOne({
          where: and(
            eq(ownerPatterns.id, patternId),
            eq(ownerPatterns.owner_id, ownerId)
          ),
        });

        if (!pattern) {
          return { success: false, error: "Recognition pattern not found" };
        }

        // Toggle the pattern status using repository
        await ownerPatternsRepo.update(patternId, {
          is_active: pattern.is_active ? 0 : 1,
        });

        return redirect(`/owners/${ownerId}`);
      } catch (error) {
        console.error("Error toggling pattern status:", error);
        return { success: false, error: "Failed to update pattern status" };
      }
    }

    case "delete": {
      const patternId = parseInt(formData.get("patternId")?.toString() || "0");

      try {
        // Delete the pattern using repository
        await ownerPatternsRepo.delete(patternId);

        return redirect(`/owners/${ownerId}`);
      } catch (error) {
        console.error("Error deleting pattern:", error);
        return { success: false, error: "Failed to delete pattern" };
      }
    }

    default:
      return { success: false, error: "Invalid action" };
  }
}
