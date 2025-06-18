import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from "react-router";
import type { Route } from "./+types/owners.$id";

import { owners } from "../../database/schema";

export async function loader({ params, context }: Route.LoaderArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    throw redirect("/owners");
  }

  const ownerId = Number.parseInt(params.id);

  // Make sure we have a valid numeric ID
  if (isNaN(ownerId)) {
    throw new Response("Invalid owner ID", { status: 400 });
  }

  try {
    const owner = await context.db.query.owners.findFirst({
      where: eq(owners.id, ownerId),
    });

    if (!owner) {
      // Don't catch this error, let it propagate to the router
      throw new Response("Owner not found", { status: 404 });
    }

    return {
      owner,
      error: null,
      isAdmin: session?.isAdmin ?? false,
    };
  } catch (error) {
    // Only catch non-Response errors
    if (!(error instanceof Response)) {
      console.error("Error loading owner data:", error);
      throw new Response("Failed to load owner data", { status: 500 });
    }
    throw error;
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to edit owners",
    };
  }

  const ownerId = Number.parseInt(params.id);

  // Make sure we have a valid numeric ID
  if (isNaN(ownerId)) {
    return { success: false, error: "Invalid owner ID" };
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString();
    const apartment_id = formData.get("apartment_id")?.toString();
    const email = formData.get("email")?.toString() || null;
    const phone = formData.get("phone")?.toString() || null;
    const is_active = formData.get("is_active") ? 1 : 0;

    if (!name || !apartment_id) {
      return { success: false, error: "Name and Apartment ID are required" };
    }

    const updateData = {
      name,
      apartment_id,
      email,
      phone,
      is_active,
      updated_at: Math.floor(Date.now() / 1000),
    };

    await context.dbRepository
      .getOwnersRepository()
      .update(ownerId, updateData);

    return { success: true, redirect: `/owners/${ownerId}` };
  } catch (error) {
    console.error("Error updating owner:", error);
    return { success: false, error: "Failed to update owner" };
  }
}

export default function EditOwnerPage() {
  const { owner, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<boolean>(false);

  // Handle redirect when action is successful
  useEffect(() => {
    if (actionData?.success && actionData?.redirect) {
      navigate(actionData.redirect);
    } else if (actionData?.error) {
      setActionError(actionData.error);
    }
  }, [actionData, navigate]);

  if (!owner && !error) {
    return <div className="p-6">Loading...</div>;
  }

  if (!owner) {
    return (
      <div className="p-6">
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
        <div className="mt-4">
          <Link to="/owners" className="btn">
            Back to Owners
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Owner</h1>
          <p className="text-gray-500">Update information for {owner.name}</p>
        </div>
        <div className="join mt-4 md:mt-0">
          <Link to={`/owners/${owner.id}`} className="btn join-item">
            Cancel
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div role="alert" className="alert alert-success mb-6">
          <span>Owner updated successfully!</span>
        </div>
      )}

      <div className="card shadow-md">
        <div className="card-body">
          <h2 className="card-title">Owner Details</h2>
          <Form method="post" onSubmit={() => setActionError(null)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={owner.name}
                  placeholder="Full name"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Apartment ID</span>
                </label>
                <input
                  type="text"
                  name="apartment_id"
                  defaultValue={owner.apartment_id}
                  placeholder="e.g. A-101"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Email</span>
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={owner.email || ""}
                  placeholder="Email address"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Phone</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={owner.phone || ""}
                  placeholder="Phone number"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Active</span>
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={owner.is_active === 1}
                    className="checkbox checkbox-primary"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
