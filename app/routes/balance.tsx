import { DateTime } from "luxon";
import { Form, redirect } from "react-router";

import { BalanceService } from "~/services/balanceService";
import { formatCurrency } from "~/utils";
import type { Route } from "./+types/balance";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const balanceService = new BalanceService(context.dbRepository);

  const currentBalance = await balanceService.getCurrentBalance();

  return {
    currentBalance,
  };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
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
  const currentDate = DateTime.now()
    .setZone("America/Santo_Domingo")
    .toFormat("yyyy-MM-dd'T'HH:mm");


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Current Balance</h1>

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
                required
              />
            </div>

            <div className="card-actions justify-end">
              <button type="submit" className="btn btn-primary">
                Save Balance
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
