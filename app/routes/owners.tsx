import { useState } from "react";
import { Form, Link, useLoaderData } from "react-router";

import { owners } from "../../database/schema";
import type { Route } from "./+types/owners";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const ownersList = await context.db.query.owners.findMany({
      orderBy: (owners, { desc }) => [desc(owners.created_at)],
    });

    return { owners: ownersList, error: null };
  } catch (error) {
    console.error("Error loading owners:", error);
    return { owners: [], error: "Failed to load owners" };
  }
}

export default function OwnersIndex() {
  const { owners, error } = useLoaderData<typeof loader>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Owners</h1>
          <p className="text-gray-500">
            Manage apartment owners and their bank accounts
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          Add Owner
        </button>
      </div>
      {(error || actionError) && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error || actionError}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Apartment</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {owners.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4">
                  No owners found. Add your first owner!
                </td>
              </tr>
            ) : (
              owners.map((owner) => (
                <tr key={owner.id}>
                  <td>{owner.id}</td>
                  <td>{owner.name}</td>
                  <td>{owner.apartment_id}</td>
                  <td>
                    {owner.email && <div>{owner.email}</div>}
                    {owner.phone && <div>{owner.phone}</div>}
                  </td>
                  <td>
                    {owner.is_active ? (
                      <div className="badge badge-success">Active</div>
                    ) : (
                      <div className="badge badge-error">Inactive</div>
                    )}
                  </td>
                  <td>
                    <div className="join">
                      <Link
                        to={`/owners/${owner.id}`}
                        className="btn btn-sm join-item"
                      >
                        View
                      </Link>
                      <Link
                        to={`/owners/${owner.id}/edit`}
                        className="btn btn-sm join-item"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Add Owner Modal */}
      {isModalOpen && (
        <dialog open className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add New Owner</h3>
            <Form method="post">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Name</span>
                </label>
                <input
                  type="text"
                  name="name"
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
                  placeholder="Phone number"
                  className="input input-bordered"
                />
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

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const apartment_id = formData.get("apartment_id") as string;
  const email = formData.get("email") as string | null;
  const phone = formData.get("phone") as string | null;

  try {
    await context.db.insert(owners).values({
      name,
      apartment_id,
      email,
      phone,
      is_active: 1,
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating owner:", error);
    return { success: false, error: "Failed to create owner" };
  }
}
