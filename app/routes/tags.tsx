import { useState } from "react";
import { Form, Link, redirect, useFetcher, useLoaderData } from "react-router";

import { transactionTags } from "../../database/schema";
import type { Route } from "./+types/tags";

export async function loader({ context, request }: Route.LoaderArgs) {
  await context.assertLoggedInUser({ context, request });

  // Get the current user to check if they're an admin
  const user = await context.getCurrentUser({ request, context });
  const isAdmin = user?.isAdmin || false;

  try {
    const tagsRepository = context.dbRepository.getTransactionTagsRepository();
    const tagsList = await tagsRepository.findMany({
      orderBy: [{ column: transactionTags.name, direction: "asc" }],
      with: { parentTag: true },
    });

    return { tags: tagsList, error: null, isAdmin };
  } catch (error) {
    console.error("Error loading tags:", error);
    return { tags: [], error: "Failed to load tags", isAdmin };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  await context.assertLoggedInUser({ context, request });

  // Check if the user is an admin
  const user = await context.getCurrentUser({ request, context });
  if (!user?.isAdmin) {
    return redirect("/unauthorized");
  }

  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description") || null;
  const color = formData.get("colorHex");
  const parentId = formData.get("parent_id") || null;

  try {
    // Using our custom repository which will trigger the afterCreate hook
    const tagsRepository = context.dbRepository.getTransactionTagsRepository();

    // The afterCreate hook will automatically run after the tag is created
    const newTag = await tagsRepository.create({
      name,
      description,
      color,
      parent_id: parentId ? parseInt(parentId as string) : null,
    });

    return { success: true, tag: newTag };
  } catch (error) {
    console.error("Error creating tag:", error);
    return { success: false, error: "Failed to create tag" };
  }
}

export default function TagsIndex() {
  const { tags, error, isAdmin } = useLoaderData<typeof loader>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetcher = useFetcher();

  const openCreateModal = () => {
    if (!isAdmin) {
      setActionError("Admin privileges required to create tags");
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Transaction Tags</h1>
          <p className="text-gray-500">
            Manage tags to categorize transactions
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreateModal} className="btn btn-primary">
            Add Tag
          </button>
        )}
      </div>

      {(error || actionError) && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error || actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags.length === 0 ? (
          <div className="col-span-full text-center py-6">
            <p>No tags found. Create your first tag!</p>
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="card shadow-sm"
              style={{ borderLeft: `4px solid ${tag.color || "#888"}` }}
            >
              <div className="card-body">
                <div className="flex justify-between items-center">
                  <h2 className="card-title">{tag.name}</h2>
                  <div className="badge badge-ghost">{tag.color}</div>
                </div>
                {tag.description && <p>{tag.description}</p>}
                {tag.parentTag && (
                  <p className="text-sm">
                    Parent:{" "}
                    <span className="font-medium">{tag.parentTag.name}</span>
                  </p>
                )}
                <div className="card-actions justify-end mt-2">
                  <Link to={`/tags/${tag.id}`} className="btn btn-sm">
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Tag Modal */}
      {isAdmin && isModalOpen && (
        <dialog open className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add New Tag</h3>
            <Form method="post">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Tag name"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <input
                  type="text"
                  name="description"
                  placeholder="Tag description"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Parent Tag</span>
                </label>
                <select
                  name="parent_id"
                  className="select select-bordered"
                  defaultValue=""
                >
                  <option value="">No parent</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs mt-1">
                  Use this to create hierarchical tag relationships
                </span>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text">Color</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    name="color"
                    className="w-12 h-12 rounded"
                    defaultValue="#3b82f6"
                  />
                  <input
                    type="text"
                    name="colorHex"
                    placeholder="#RRGGBB"
                    className="input input-bordered flex-grow"
                    defaultValue="#3b82f6"
                  />
                </div>
              </div>

              <div className="modal-action">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </Form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
