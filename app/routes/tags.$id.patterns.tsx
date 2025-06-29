import { and, eq } from "drizzle-orm";
import { redirect } from "react-router";
import { tagPatterns, transactionToTags } from "../../database/schema";
import type { Route } from "./+types/tags.$id";

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to modify tag patterns",
    };
  }

  console.log("Action triggered for tag patterns", params.id);

  const tagId = parseInt(params.id);

  // Make sure we have a valid tag ID
  if (isNaN(tagId)) {
    return { success: false, error: "Invalid tag ID" };
  }

  // Get repositories
  const tagPatternsRepo = context.dbRepository.getTagPatternsRepository();
  const transactionsRepo = context.dbRepository.getTransactionsRepository();
  const transactionToTagsRepo =
    context.dbRepository.getTransactionToTagsRepository();

  // Get the form data
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  // Handle different operations based on intent
  switch (intent) {
    case "create": {
      const pattern = formData.get("pattern")?.toString();
      const description = formData.get("description")?.toString() || null;
      const applyToExisting = formData.get("applyToExisting") === "on";

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

        // Create pattern using repository
        await tagPatternsRepo.create({
          tag_id: tagId,
          pattern,
          description,
          is_active: 1,
        });

        // If applyToExisting is true, assign the tag to matching transactions
        if (applyToExisting) {
          // Get all transactions using repository
          const allTransactions = await transactionsRepo.findMany();

          // Create a RegExp object for the pattern
          const regex = new RegExp(pattern);

          // Filter transactions that match the pattern
          const matchingTransactions = allTransactions.filter((transaction) => {
            const description =
              transaction.description || transaction.bank_description || "";
            return regex.test(description);
          });

          // For each matching transaction, add this tag
          for (const transaction of matchingTransactions) {
            // Check if the tag is already associated with this transaction using repository
            const existingLink = await transactionToTagsRepo.findOne({
              where: and(
                eq(transactionToTags.transaction_id, transaction.id),
                eq(transactionToTags.tag_id, tagId)
              ),
            });

            if (!existingLink) {
              // Add the tag to the transaction using repository
              await transactionToTagsRepo.create({
                transaction_id: transaction.id,
                tag_id: tagId,
              });
            }
          }
        }

        return redirect(`/tags/${tagId}`);
      } catch (error) {
        console.error("Error adding recognition pattern:", error);
        return { success: false, error: "Failed to add recognition pattern" };
      }
    }

    case "toggle": {
      const patternId = parseInt(formData.get("patternId")?.toString() || "0");

      try {
        // Find pattern using repository
        const pattern = await tagPatternsRepo.findOne({
          where: and(
            eq(tagPatterns.id, patternId),
            eq(tagPatterns.tag_id, tagId)
          ),
        });

        if (!pattern) {
          return { success: false, error: "Recognition pattern not found" };
        }

        // Update pattern using repository
        await tagPatternsRepo.update(patternId, {
          is_active: pattern.is_active ? 0 : 1,
        });

        return redirect(`/tags/${tagId}`);
      } catch (error) {
        console.error("Error toggling pattern status:", error);
        return { success: false, error: "Failed to update pattern status" };
      }
    }

    case "delete": {
      const patternId = parseInt(formData.get("patternId")?.toString() || "0");

      try {
        // Delete pattern using repository
        await tagPatternsRepo.delete(patternId);

        return redirect(`/tags/${tagId}`);
      } catch (error) {
        console.error("Error deleting pattern:", error);
        return { success: false, error: "Failed to delete pattern" };
      }
    }

    default:
      return { success: false, error: "Invalid action" };
  }
}
