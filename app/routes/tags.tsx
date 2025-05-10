import { useState } from "react";
import { Form, useFetcher, useLoaderData } from "react-router";

import { transactionTags } from "../../database/schema";
import type { Route } from "./+types/tags";

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const tagsList = await context.db.query.transactionTags.findMany({
      orderBy: (transactionTags, { asc }) => [asc(transactionTags.name)],
      with: {
        parentTag: true,
      },
    });

    return { tags: tagsList, error: null };
  } catch (error) {
    console.error("Error loading tags:", error);
    return { tags: [], error: "Failed to load tags" };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description") || null;
  const color = formData.get("colorHex");
  const method = formData.get("_method");
  const parentId = formData.get("parent_id") || null;

  if (method === "patch") {
    // This is handled by the route for editing a specific tag
    return null;
  }

  try {
    await context.db.insert(transactionTags).values({
      name,
      description,
      color,
      parent_id: parentId ? parseInt(parentId as string) : null,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating tag:", error);
    return { success: false, error: "Failed to create tag" };
  }
}

export default function TagsIndex() {
  const { tags, error } = useLoaderData<typeof loader>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const fetcher = useFetcher();

  const openEditModal = (tag) => {
    setEditingTag(tag);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTag(null);
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
        <button onClick={openCreateModal} className="btn btn-primary">
          Add Tag
        </button>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
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
                  <button
                    onClick={() => openEditModal(tag)}
                    className="btn btn-sm"
                  >
                    Edit
                  </button>
                  <fetcher.Form method="delete" action={`/tags/${tag.id}`}>
                    <button type="submit" className="btn btn-sm btn-error">
                      Delete
                    </button>
                  </fetcher.Form>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Tag Modal */}
      {isModalOpen && (
        <dialog open className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {editingTag ? "Edit Tag" : "Add New Tag"}
            </h3>
            <Form
              method="post"
              action={editingTag ? `/tags/${editingTag.id}` : undefined}
            >
              {editingTag && (
                <input type="hidden" name="_method" value="patch" />
              )}

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Tag name"
                  className="input input-bordered"
                  defaultValue={editingTag?.name || ""}
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
                  defaultValue={editingTag?.description || ""}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Parent Tag</span>
                </label>
                <select
                  name="parent_id"
                  className="select select-bordered"
                  defaultValue={editingTag?.parent_id || ""}
                >
                  <option value="">No parent</option>
                  {tags
                    .filter((tag) => !editingTag || tag.id !== editingTag.id)
                    .map((tag) => (
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
                    defaultValue={editingTag?.color || "#3b82f6"}
                  />
                  <input
                    type="text"
                    name="colorHex"
                    placeholder="#RRGGBB"
                    className="input input-bordered flex-grow"
                    defaultValue={editingTag?.color || "#3b82f6"}
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
