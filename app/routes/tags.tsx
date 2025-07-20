import { useEffect, useState } from "react";
import { Form, Link, useFetcher, useLoaderData } from "react-router";
import { useIsAdmin } from "~/hooks";
import * as schema from "../../database/schema";
import type { Tag } from "../types";
import type { Route } from "./+types/tags";

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const session = await context.getSession();
    const tagsRepository = context.dbRepository.getTransactionTagsRepository();
    const tags = await tagsRepository.findMany<Tag>({
      orderBy: [{ column: schema.transactionTags.name, direction: "asc" }],
    });
    return {
      tags,
      error: null,
      isAdmin: session?.isAdmin ?? false,
    };
  } catch (error) {
    console.error("Error loading tags:", error);
    return {
      tags: [],
      error: "Failed to load tags",
      isAdmin: false,
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to modify tags",
    };
  }

  const tagsRepository = context.dbRepository.getTransactionTagsRepository();
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const kind = formData.get("kind")?.toString() || null;
    try {
      const tag = await tagsRepository.create({ name, kind });
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
  const isAdmin = useIsAdmin();
  const [actionError, setActionError] = useState<string | null>(null);
  const fetcher = useFetcher<typeof action>();

  useEffect(() => {
    if (fetcher.data?.error) {
      setActionError(fetcher.data.error);
    } else if (fetcher.data?.success) {
      setActionError(null);
    }
  }, [fetcher.data]);

  const handleCreateTag = async (name: string) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to create tags");
      return;
    }

    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("name", name);

    fetcher.submit(formData, { method: "post" });
  };

  const handleDeleteTag = async (id: number) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to delete tags");
      return;
    }

    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("id", id.toString());

    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tags</h1>
        {isAdmin ? (
          <Form method="post" className="flex gap-2">
            <input type="hidden" name="intent" value="create" />
            <input
              type="text"
              name="name"
              placeholder="New tag name"
              className="input input-bordered"
              required
            />
            <select name="kind" className="select select-bordered">
              <option value="">No Kind</option>
              <option value="monthly-payment">Monthly Payment</option>
            </select>
            <button type="submit" className="btn btn-primary">
              Add Tag
            </button>
          </Form>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New tag name"
              className="input input-bordered"
              disabled
            />
            <select className="select select-bordered" disabled>
              <option value="">No Kind</option>
              <option value="monthly-payment">Monthly Payment</option>
            </select>
            <button
              className="btn btn-primary btn-disabled"
              title="Admin access required"
            >
              Add Tag
            </button>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="alert alert-warning">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span>Admin access required to modify tags</span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags.map((tag: Tag) => (
          <div key={tag.id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center gap-2">
                <Link
                  to={`/tags/${tag.id}`}
                  className="card-title hover:text-primary"
                >
                  {tag.name}
                </Link>
                {tag.color && (
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  ></div>
                )}
              </div>
              {tag.kind && (
                <div className="badge badge-info badge-sm">
                  {tag.kind === "monthly-payment"
                    ? "Monthly Payment"
                    : tag.kind}
                </div>
              )}
              <div className="card-actions justify-end">
                {isAdmin ? (
                  <button
                    onClick={() => handleDeleteTag(tag.id)}
                    className="btn btn-error btn-sm"
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    className="btn btn-error btn-sm btn-disabled"
                    title="Admin access required"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
