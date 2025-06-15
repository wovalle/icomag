import { DateTime } from "luxon";
import { Form, redirect } from "react-router";

import { useIsAdmin } from "~/hooks";
import { BalanceService } from "~/services/balanceService";
import { formatCurrency } from "~/utils";
import type { Route } from "./+types/balance";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const balanceService = new BalanceService(context.dbRepository);
  const session = await context.getSession();

  const currentBalance = await balanceService.getCurrentBalance();

  return {
    currentBalance,
    isAdmin: session?.isAdmin ?? false,
  };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return { error: "Admin privileges required to update balance" };
  }

  const formData = await request.formData();
  const balance = formData.get("balance");
  const dateStr = formData.get("date");

  if (!balance || !dateStr) {
    return { error: "Balance and date are required" };
  }

  const balanceService = new BalanceService(context.dbRepository);

  await balanceService.setCurrentBalance(
    parseFloat(balance.toString()),
    new Date(dateStr.toString())
  );

  return redirect("/");
};

export default function BalancePage({ loaderData }: Route.ComponentProps) {
  const { currentBalance } = loaderData;
  const isAdmin = useIsAdmin();
  const currentDate = DateTime.now()
    .setZone("America/Santo_Domingo")
    .toFormat("yyyy-MM-dd'T'HH:mm");

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Current Balance</h1>

      {!isAdmin && (
        <div className="alert alert-warning mb-6">
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
          <span>Admin access required to update balance</span>
        </div>
      )}

      {currentBalance && (
        <div className="alert alert-info mb-6 text-white">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <div className="font-bold">
                Current Balance: {formatCurrency(currentBalance.balance)}
              </div>
              <div className="text-sm">
                Last updated:{" "}
                {new Date(currentBalance.date).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Update Balance</h2>
          <p className="mb-4">
            Enter the current balance of your account as of a specific date.
          </p>

          <Form method="post">
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Current Balance</span>
              </label>
              <input
                type="number"
                name="balance"
                step="0.01"
                defaultValue={currentBalance?.balance}
                placeholder="Enter current balance"
                className="input input-bordered"
                disabled={!isAdmin}
                required
              />
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text">Balance Date</span>
              </label>
              <input
                type="datetime-local"
                name="date"
                defaultValue={currentDate}
                className="input input-bordered"
                disabled={!isAdmin}
                required
              />
            </div>

            <div className="card-actions justify-end">
              <button
                type="submit"
                className={`btn btn-primary ${!isAdmin ? "btn-disabled" : ""}`}
                disabled={!isAdmin}
                title={!isAdmin ? "Admin access required" : ""}
              >
                Save Balance
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
