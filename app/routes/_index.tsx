import { Link } from "react-router";

import { BalanceService } from "~/services/balanceService";
import { formatCurrency } from "~/utils";

import type { Route } from "./+types/_index";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const balanceService = new BalanceService(context.dbRepository);
  const balanceInfo = await balanceService.getEstimatedBalance();
  return { balanceInfo };
};

export default function IndexPage({ loaderData }: Route.ComponentProps) {
  const { balanceInfo } = loaderData;
  const balance = balanceInfo.currentBalance
    ? formatCurrency(balanceInfo.currentBalance)
    : "N/A";

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">CRM</h1>

      {/* Balance Information Card */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Account Balance</h2>

          {balanceInfo.estimatedBalance !== null ? (
            <>
              <div className="stats shadow mt-2">
                <div className="stat">
                  <div className="stat-title">Estimated Balance</div>
                  <div className="stat-value text-secondary">
                    {formatCurrency(balanceInfo.estimatedBalance)}
                  </div>
                  <div className="stat-desc">
                    {balanceInfo.transactionsSince} transactions since last
                    update
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-title">
                    Current Balance (as of{" "}
                    {balanceInfo.balanceDate
                      ? new Date(balanceInfo.balanceDate).toLocaleDateString()
                      : "N/A"}
                    )
                  </div>
                  <div className="stat-value text-primary">{balance}</div>
                </div>
                {balanceInfo.lastBatch && (
                  <div className="stat">
                    <div className="stat-title">Last Processed Batch</div>
                    <div className="stat-value">
                      {balanceInfo.lastBatch.filename.length > 20
                        ? `${balanceInfo.lastBatch.filename.substring(
                            0,
                            20
                          )}...`
                        : balanceInfo.lastBatch.filename}
                    </div>
                    <div className="stat-desc">
                      Processed on{" "}
                      {new Date(
                        balanceInfo.lastBatch.processedAt
                      ).toLocaleDateString()}{" "}
                      at{" "}
                      {new Date(
                        balanceInfo.lastBatch.processedAt
                      ).toLocaleTimeString()}
                    </div>
                    <div className="stat-desc">
                      {balanceInfo.lastBatch.totalTransactions} transactions
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="alert">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-info shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>
                No balance information available. Please set your current
                balance.
              </span>
            </div>
          )}

          <div className="card-actions justify-end mt-4">
            <Link to="/balance" className="btn btn-primary">
              {balanceInfo.currentBalance !== null
                ? "Update Balance"
                : "Set Balance"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
