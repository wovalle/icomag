import { and, eq } from "drizzle-orm";
import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/owners.$id";

import { bankAccounts, owners, transactions } from "../../database/schema";

export async function loader({ params, context }: Route.LoaderArgs) {
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

    // Get all bank accounts for this owner
    const accounts = await context.db.query.bankAccounts.findMany({
      where: eq(bankAccounts.owner_id, ownerId),
      orderBy: (bankAccounts, { desc }) => [desc(bankAccounts.created_at)],
    });

    // Get recent transactions for this owner
    const recentTransactions = await context.db.query.transactions.findMany({
      where: eq(transactions.owner_id, ownerId),
      orderBy: (transactions, { desc }) => [desc(transactions.date)],
      limit: 5,
    });

    return {
      owner,
      accounts,
      recentTransactions,
      error: null,
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
  const path = new URL(request.url).pathname;
  const ownerId = parseInt(params.id);

  console.log("Action path:", path, ownerId);

  // Handle adding a new bank account
  if (path.endsWith("/bank-accounts")) {
    const formData = await request.formData();
    const account_number = formData.get("account_number");
    const bank_name = formData.get("bank_name") || null;
    const description = formData.get("description") || null;

    try {
      await context.db.insert(bankAccounts).values({
        owner_id: ownerId,
        account_number,
        bank_name,
        description,
        is_active: 1,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      });

      return { success: true };
    } catch (error) {
      console.error("Error adding bank account:", error);
      return { success: false, error: "Failed to add bank account" };
    }
  }

  // Handle toggling bank account status
  if (path.match(/\/bank-accounts\/\d+\/toggle$/)) {
    const accountId = parseInt(path.split("/").pop().replace("toggle", ""));

    try {
      const account = await context.db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.id, accountId),
          eq(bankAccounts.owner_id, ownerId)
        ),
      });

      if (!account) {
        return { success: false, error: "Bank account not found" };
      }

      await context.db
        .update(bankAccounts)
        .set({
          is_active: account.is_active ? 0 : 1,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(bankAccounts.id, accountId));

      return { success: true };
    } catch (error) {
      console.error("Error toggling bank account status:", error);
      return { success: false, error: "Failed to update bank account status" };
    }
  }

  return { success: false, error: "Invalid action" };
}

export default function OwnerDetailsPage({ loaderData }: Route.ComponentProps) {
  const { owner, accounts, recentTransactions, error } = loaderData;
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date function
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

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

  if (error) {
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
          <h1 className="text-3xl font-bold">{owner.name}</h1>
          <p className="text-gray-500">Apartment: {owner.apartment_id}</p>
        </div>
        <div className="join mt-4 md:mt-0">
          <Link to={`/owners/${owner.id}/edit`} className="btn join-item">
            Edit Owner
          </Link>
          <Link to="/owners" className="btn join-item">
            Back to Owners
          </Link>
        </div>
      </div>

      {/* Owner Information */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <h2 className="card-title">Owner Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Status:</p>
              {owner.is_active ? (
                <div className="badge badge-success">Active</div>
              ) : (
                <div className="badge badge-error">Inactive</div>
              )}
            </div>
            {owner.email && (
              <div>
                <p className="font-semibold">Email:</p>
                <p>{owner.email}</p>
              </div>
            )}
            {owner.phone && (
              <div>
                <p className="font-semibold">Phone:</p>
                <p>{owner.phone}</p>
              </div>
            )}
            <div>
              <p className="font-semibold">Created:</p>
              <p>{formatDate(owner.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Accounts Section */}
      <div className="card shadow-md mb-6">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Bank Accounts</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary btn-sm"
            >
              Add Bank Account
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-4">
              <p>
                No bank accounts found. Add a bank account to automatically
                match transactions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Bank Name</th>
                    <th>Account Number</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.bank_name || "N/A"}</td>
                      <td>{account.account_number}</td>
                      <td>{account.description || "N/A"}</td>
                      <td>
                        {account.is_active ? (
                          <div className="badge badge-success">Active</div>
                        ) : (
                          <div className="badge badge-error">Inactive</div>
                        )}
                      </td>
                      <td>
                        <form
                          method="post"
                          action={`/owners/${owner.id}/bank-accounts/${account.id}/toggle`}
                        >
                          <button type="submit" className="btn btn-sm">
                            {account.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="card shadow-md">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">Recent Transactions</h2>
            <Link
              to={`/transactions?ownerId=${owner.id}`}
              className="btn btn-sm"
            >
              View All Transactions
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-4">
              <p>No transactions found for this owner.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.date)}</td>
                      <td>{transaction.description}</td>
                      <td
                        className={
                          transaction.type === "debit"
                            ? "text-success"
                            : "text-error"
                        }
                      >
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td>
                        {transaction.type === "debit" ? (
                          <div className="badge badge-success">Money In</div>
                        ) : (
                          <div className="badge badge-error">Money Out</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Bank Account Modal */}
      {isModalOpen && (
        <dialog open className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add Bank Account</h3>
            <form method="post" action={`/owners/${owner.id}/bank-accounts`}>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Account Number</span>
                </label>
                <input
                  type="text"
                  name="account_number"
                  placeholder="Enter account number"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Bank Name</span>
                </label>
                <input
                  type="text"
                  name="bank_name"
                  placeholder="Enter bank name"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <input
                  type="text"
                  name="description"
                  placeholder="e.g. Main Account, Savings Account"
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
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
