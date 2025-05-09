import { and, eq } from "drizzle-orm";
import { redirect } from "react-router";
import { ownerPatterns } from "../../database/schema";

interface ActionArgs {
  request: Request;
  params: {
    id: string;
  };
  context: {
    db: any;
  };
}

export async function action({ request, params, context }: ActionArgs) {
  const ownerId = parseInt(params.id);

  // Make sure we have a valid owner ID
  if (isNaN(ownerId)) {
    return { success: false, error: "Invalid owner ID" };
  }

  // Get the form data
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  // Handle different operations based on intent
  switch (intent) {
    case "create": {
      const pattern = formData.get("pattern")?.toString();
      const description = formData.get("description")?.toString() || null;

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

        await context.db.insert(ownerPatterns).values({
          owner_id: ownerId,
          pattern,
          description,
          is_active: 1,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        });

        return redirect(`/owners/${ownerId}`);
      } catch (error) {
        console.error("Error adding recognition pattern:", error);
        return { success: false, error: "Failed to add recognition pattern" };
      }
    }

    case "toggle": {
      const patternId = parseInt(formData.get("patternId")?.toString() || "0");

      try {
        const pattern = await context.db.query.ownerPatterns.findFirst({
          where: and(
            eq(ownerPatterns.id, patternId),
            eq(ownerPatterns.owner_id, ownerId)
          ),
        });

        if (!pattern) {
          return { success: false, error: "Recognition pattern not found" };
        }

        await context.db
          .update(ownerPatterns)
          .set({
            is_active: pattern.is_active ? 0 : 1,
            updated_at: Math.floor(Date.now() / 1000),
          })
          .where(eq(ownerPatterns.id, patternId));

        return redirect(`/owners/${ownerId}`);
      } catch (error) {
        console.error("Error toggling pattern status:", error);
        return { success: false, error: "Failed to update pattern status" };
      }
    }

    case "delete": {
      const patternId = parseInt(formData.get("patternId")?.toString() || "0");

      try {
        await context.db
          .delete(ownerPatterns)
          .where(
            and(
              eq(ownerPatterns.id, patternId),
              eq(ownerPatterns.owner_id, ownerId)
            )
          );

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
