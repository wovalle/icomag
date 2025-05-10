import { eq } from "drizzle-orm";
import { data } from "react-router";
import { transactionTags } from "../../database/schema";
import type { Route } from "./+types/tags.$id";

export async function action({ request, context, params }: Route.ActionArgs) {
  const id = parseInt(params.id || "0");
  if (!id) {
    return { success: false, error: "Invalid tag ID" };
  }

  const formData = await request.formData();
  const method = formData.get("_method");

  // Handle editing a tag
  if (method === "patch") {
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const color = formData.get("colorHex") as string;
    const parentId = (formData.get("parent_id") as string) || null;

    try {
      await context.db
        .update(transactionTags)
        .set({
          name,
          description,
          color,
          parent_id: parentId ? parseInt(parentId) : null,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(transactionTags.id, id));

      return { success: true };
    } catch (error) {
      console.error("Error updating tag:", error);
      return { success: false, error: "Failed to update tag" };
    }
  }

  if (method === "delete") {
    try {
      await context.db
        .delete(transactionTags)
        .where(eq(transactionTags.id, id));

      return { success: true };
    } catch (error) {
      console.error("Error deleting tag:", error);
      return data(
        { success: false, error: "Failed to delete tag" },
        { status: 500 }
      );
    }
  }

  // Handle deleting a tag
  if (request.method === "POST" && !method) {
    try {
      await context.db
        .delete(transactionTags)
        .where(eq(transactionTags.id, id));

      return { success: true };
    } catch (error) {
      console.error("Error deleting tag:", error);
      return { success: false, error: "Failed to delete tag" };
    }
  }

  return { success: false, error: "Invalid action" };
}
