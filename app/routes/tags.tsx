import { useState } from "react";
import { Form, useFetcher, useLoaderData } from "react-router";
import type { Route } from "./+types/tags";

interface Tag {
  id: number;
  name: string;
}

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const tagsRepository = context.dbRepository.getTransactionTagsRepository();
    const tags = await tagsRepository.findMany<Tag>({
      orderBy: [{ column: "name", direction: "asc" }],
    });
    return { tags, error: null };
  } catch (error) {
    console.error("Error loading tags:", error);
    return { tags: [], error: "Failed to load tags" };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const tagsRepository = context.dbRepository.getTransactionTagsRepository();
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    try {
      const tag = await tagsRepository.create({ name });
      return { success: true, error: null };
    } catch (error) {
      console.error("Error creating tag:", error);
      return { success: false, error: "Failed to create tag" };
    }
  } else if (intent === "delete") {
    const id = parseInt(formData.get("id") as string);
    try {
      await tagsRepository.delete(id);
      return { success: true, error: null };
    } catch (error) {
      console.error("Error deleting tag:", error);
      return { success: false, error: "Failed to delete tag" };
    }
  }

  return { success: false, error: "Invalid action" };
}

export default function TagsPage() {
  const { tags, error } = useLoaderData<typeof loader>();
  const [actionError, setActionError] = useState<string | null>(null);
  const fetcher = useFetcher<typeof action>();

  const handleCreateTag = async (name: string) => {
    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("name", name);

    fetcher.submit(formData, { method: "post" });
  };

  const handleDeleteTag = async (id: number) => {
    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("id", id.toString());

    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tags</h1>
        <Form method="post" className="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="New tag name"
            className="input input-bordered"
            required
          />
          <button type="submit" className="btn btn-primary">
            Add Tag
          </button>
        </Form>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags.map((tag: Tag) => (
          <div key={tag.id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">{tag.name}</h2>
              <div className="card-actions justify-end">
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="btn btn-error btn-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
