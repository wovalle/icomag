import { eq } from "drizzle-orm";
import { AlertCircle, Calendar, Flame, Wallet } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useIsAdmin } from "~/hooks";
import { BalanceService } from "~/services/balanceService";
import { formatCurrency } from "~/utils";
import * as schema from "../../database/schema";
import type { Route } from "./+types/_index";

// Type definitions (matching database schema)
interface Owner {
  id: number;
  apartment_id: string;
  name: string;
  email?: string | null;
  is_active: number;
}

interface TransactionTag {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  parent_id: number | null;
  month_year: number | null;
  created_at: number;
  updated_at: number;
  kind: string | null;
}

interface LpgRefill {
  id: number;
  bill_amount: number;
  gallons_refilled: number;
  refill_date: number;
  efficiency_percentage: number | null;
  created_at: number;
  updated_at: number;
  tag_id: number | null;
}

interface MonthlyPayment {
  owner: Owner;
  amountPaid: number;
  status: string;
  tagId: number;
}

interface LpgPayment {
  owner?: Owner;
  entry?: { owner?: Owner };
  amountOwed?: number;
  amountPaid?: number;
  remainingBalance?: number;
  status: string;
  refillId: number;
}

// Helper function to get current month in YYYYMM format
function getCurrentMonthYear(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

// Helper function to get previous month in YYYYMM format
function getPreviousMonthYear(): number {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

// Format month_year to readable format
function formatMonthYear(monthYear: number): string {
  const year = Math.floor(monthYear / 100);
  const month = monthYear % 100;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Format refill date to human readable format (June 6th 2025)
function formatRefillDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();

  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const getOrdinalSuffix = (day: number): string => {
    if (day >= 11 && day <= 13) {
      return "th";
    }
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return `${month} ${day}${getOrdinalSuffix(day)} ${year}`;
}

export const loader = async ({ context }: Route.LoaderArgs) => {
  const balanceService = new BalanceService(context.dbRepository);
  const balanceInfo = await balanceService.getEstimatedBalance();

  const session = await context.getSession();

  // Get all tags to find monthly payment tags
  const tagsRepo = context.dbRepository.getTransactionTagsRepository();
  const ownersRepo = context.dbRepository.getOwnersRepository();
  const transactionRepo = context.dbRepository.getTransactionsRepository();
  const lpgRepoInstance = context.dbRepository.getLpgRefillsRepository();

  const monthlyTags = await tagsRepo.findMany({
    where: eq(schema.transactionTags.kind, "monthly-payment"),
  });

  const currentMonthYear = getCurrentMonthYear();
  const previousMonthYear = getPreviousMonthYear();

  // Find current and last month tags
  const currentMonthTag = monthlyTags.find(
    (tag) => tag.month_year === currentMonthYear
  );
  const lastMonthTag = monthlyTags.find(
    (tag) => tag.month_year === previousMonthYear
  );

  // Get LPG refills
  const allLpgRefills = await lpgRepoInstance.findMany({});

  // Get most recent LPG refill
  const lastLpgRefill = allLpgRefills.sort(
    (a, b) => b.refill_date - a.refill_date
  )[0];

  // Pre-fetch monthly payment data per tag (with tag ID attached)
  const allMonthlyPaymentData: MonthlyPayment[] = [];
  const pendingMonthlyPayments: MonthlyPayment[] = [];

  for (const tag of monthlyTags) {
    const tagPayments = await transactionRepo.getMonthlyPaymentData(
      tag.id,
      ownersRepo
    );

    const paymentsWithTagId = tagPayments.map((p: any) => ({
      ...p,
      tagId: tag.id,
    }));

    allMonthlyPaymentData.push(...paymentsWithTagId);

    // Collect pending payments
    const pending = paymentsWithTagId.filter(
      (p: MonthlyPayment) => p.amountPaid === 0
    );
    pendingMonthlyPayments.push(...pending);
  }

  // Pre-fetch LPG pending payment data for all refills (with refill ID attached)
  const allLpgPendingData: LpgPayment[] = [];
  for (const refill of allLpgRefills) {
    if (refill.tag_id) {
      const refillPendingData =
        await lpgRepoInstance.getPendingPaymentsForRefill(
          refill.id,
          transactionRepo
        );
      allLpgPendingData.push(
        ...refillPendingData.map((payment: any) => ({
          ...payment,
          refillId: refill.id,
        }))
      );
    }
  }

  // Calculate counts of owners who haven't paid
  let currentMonthOwed = 0;
  let lastMonthOwed = 0;
  let lastLpgOwed = 0;

  if (currentMonthTag) {
    const transactions = await context.dbRepository
      .getTransactionsRepository()
      .findWithFilters({
        tagId: currentMonthTag.id.toString(),
        limit: 1000,
        page: 1,
      });

    const activeOwners = await context.dbRepository
      .getOwnersRepository()
      .findMany({
        where: eq(schema.owners.is_active, 1),
      });

    for (const owner of activeOwners) {
      const ownerPayments = transactions.transactions
        .filter((t) => t.owner_id === owner.id && t.type === "credit")
        .reduce((sum, t) => sum + t.amount, 0);

      // Count owners who haven't paid (payment amount is 0)
      if (ownerPayments === 0) {
        currentMonthOwed += 1; // Count of owners who haven't paid
      }
    }
  }

  if (lastMonthTag) {
    const transactions = await context.dbRepository
      .getTransactionsRepository()
      .findWithFilters({
        tagId: lastMonthTag.id.toString(),
        limit: 1000,
        page: 1,
      });

    const activeOwners = await context.dbRepository
      .getOwnersRepository()
      .findMany({
        where: eq(schema.owners.is_active, 1),
      });

    for (const owner of activeOwners) {
      const ownerPayments = transactions.transactions
        .filter((t) => t.owner_id === owner.id && t.type === "credit")
        .reduce((sum, t) => sum + t.amount, 0);

      if (ownerPayments === 0) {
        lastMonthOwed += 1; // Count of owners who haven't paid
      }
    }
  }

  // Calculate LPG owners who haven't paid
  if (lastLpgRefill && lastLpgRefill.tag_id) {
    const transactions = await context.dbRepository
      .getTransactionsRepository()
      .findWithFilters({
        tagId: lastLpgRefill.tag_id.toString(),
        limit: 1000,
        page: 1,
      });

    const refillDetails = await lpgRepoInstance.findByIdWithDetails(
      lastLpgRefill.id
    );

    if (refillDetails?.entries) {
      for (const entry of refillDetails.entries) {
        const ownerPayments = transactions.transactions
          .filter((t) => t.owner_id === entry.owner_id && t.type === "credit")
          .reduce((sum, t) => sum + t.amount, 0);

        const remainingBalance = (entry.total_amount || 0) - ownerPayments;
        // Count owners with remaining balance > 0
        if (remainingBalance > 0) {
          lastLpgOwed += 1;
        }
      }
    }
  }

  // Get current month and adjacent months for dropdown
  const now = new Date();
  const currentMonth = now.getFullYear() * 100 + (now.getMonth() + 1);

  // Calculate previous and next month
  const previousMonth =
    now.getMonth() === 0
      ? (now.getFullYear() - 1) * 100 + 12
      : now.getFullYear() * 100 + now.getMonth();

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth =
    nextMonthDate.getFullYear() * 100 + (nextMonthDate.getMonth() + 1);

  // Filter and sort tags for the 3-month window
  const recentMonthlyTags = monthlyTags
    .filter((tag) => {
      const monthYear = tag.month_year || 0;
      return (
        monthYear === previousMonth ||
        monthYear === currentMonth ||
        monthYear === nextMonth
      );
    })
    .sort((a, b) => (a.month_year || 0) - (b.month_year || 0)); // Ascending order

  return {
    balanceInfo,
    currentMonthTag,
    lastMonthTag,
    lastLpgRefill,
    currentMonthOwed,
    lastMonthOwed,
    lastLpgOwed,
    allMonthlyTags: recentMonthlyTags,
    allLpgRefills: allLpgRefills.sort((a, b) => b.refill_date - a.refill_date),
    pendingMonthlyPayments, // Pre-fetched pending payments
    allMonthlyPaymentData, // All monthly payment data for filtering
    allLpgPendingData, // All LPG pending payment data
    isAdmin: session?.isAdmin ?? false,
  };
};

export default function IndexPage({ loaderData }: Route.ComponentProps) {
  const {
    balanceInfo,
    currentMonthTag,
    lastMonthTag,
    lastLpgRefill,
    currentMonthOwed,
    lastMonthOwed,
    lastLpgOwed,
    allMonthlyTags,
    allLpgRefills,
    pendingMonthlyPayments,
    allMonthlyPaymentData,
    allLpgPendingData,
  } = loaderData;

  const isAdmin = useIsAdmin();

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Estimated Balance */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-6 h-6 text-primary" />
              <h3 className="font-semibold text-sm">
                Current Estimated Balance
              </h3>
            </div>
            <div className="text-3xl font-bold text-primary mb-2">
              {formatCurrency(balanceInfo.estimatedBalance || 0)}
            </div>
            <p className="text-sm text-base-content/60">
              As of{" "}
              {balanceInfo.balanceDate
                ? new Date(balanceInfo.balanceDate).toLocaleDateString()
                : "N/A"}
            </p>
            {isAdmin && (
              <div className="card-actions justify-end mt-2">
                <Link to="/balance" className="btn btn-primary btn-sm">
                  Update Balance
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Current Month Owed */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-6 h-6 text-error" />
              <h3 className="font-semibold text-sm">
                Current Month Owners Not Paid
              </h3>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                currentMonthOwed > 0 ? "text-error" : "text-success"
              }`}
            >
              {currentMonthOwed}
            </div>
            <p className="text-sm text-base-content/60">
              {currentMonthTag
                ? formatMonthYear(currentMonthTag.month_year || 0)
                : "No tag found"}
            </p>
            {currentMonthTag && (
              <div className="card-actions justify-end mt-2">
                <Link
                  to={`/tags/${currentMonthTag.id}`}
                  className="btn btn-error btn-sm"
                >
                  View Details
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Last Month Owed */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-6 h-6 text-warning" />
              <h3 className="font-semibold text-sm">
                Last Month Owners Not Paid
              </h3>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                lastMonthOwed > 0 ? "text-warning" : "text-success"
              }`}
            >
              {lastMonthOwed}
            </div>
            <p className="text-sm text-base-content/60">
              {lastMonthTag
                ? formatMonthYear(lastMonthTag.month_year || 0)
                : "No tag found"}
            </p>
            {lastMonthTag && (
              <div className="card-actions justify-end mt-2">
                <Link
                  to={`/tags/${lastMonthTag.id}`}
                  className="btn btn-warning btn-sm"
                >
                  View Details
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Last LPG Owed */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-6 h-6 text-info" />
              <h3 className="font-semibold text-sm">
                Last LPG Owners Not Paid
              </h3>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                lastLpgOwed > 0 ? "text-info" : "text-success"
              }`}
            >
              {lastLpgOwed}
            </div>
            <p className="text-sm text-base-content/60">
              {lastLpgRefill
                ? `Refill on ${new Date(
                    lastLpgRefill.refill_date * 1000
                  ).toLocaleDateString()}`
                : "No refill found"}
            </p>
            {lastLpgRefill && (
              <div className="card-actions justify-end mt-2">
                <Link
                  to={`/lpg/${lastLpgRefill.id}`}
                  className="btn btn-info btn-sm"
                >
                  View Details
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Payments Table */}
      <MonthlyPaymentsTable
        monthlyTags={allMonthlyTags}
        allPaymentData={allMonthlyPaymentData}
        pendingPayments={pendingMonthlyPayments}
      />

      {/* LPG Payments Table */}
      <LpgPaymentsTable
        lpgRefills={allLpgRefills}
        allPendingData={allLpgPendingData}
      />
    </div>
  );
}

// Component for Monthly Payments Table
function MonthlyPaymentsTable({
  monthlyTags,
  allPaymentData,
  pendingPayments,
}: {
  monthlyTags: TransactionTag[];
  allPaymentData: MonthlyPayment[];
  pendingPayments: MonthlyPayment[];
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTagId = searchParams.get("month") || "all";

  // Filter data based on selected tag
  const displayData =
    selectedTagId === "all"
      ? pendingPayments
      : pendingPayments.filter((p) => p.tagId === parseInt(selectedTagId));

  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">Monthly Payments Tracking</h2>
          <select
            className="select select-bordered select-sm"
            value={selectedTagId}
            onChange={(e) => {
              if (e.target.value === "all") {
                searchParams.delete("month");
              } else {
                searchParams.set("month", e.target.value);
              }
              setSearchParams(searchParams);
            }}
          >
            <option value="all">All Months</option>
            {monthlyTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {formatMonthYear(tag.month_year || 0)}
              </option>
            ))}
          </select>
        </div>

        {displayData.length === 0 ? (
          <div className="alert alert-success">
            <span className="text-success">✓</span>
            <span>No pending payments found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Apartment</th>
                  <th>Owner</th>
                  <th>Amount Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((payment, index) => (
                  <tr key={`${payment.owner.id}-${index}`}>
                    <td className="font-bold">{payment.owner.apartment_id}</td>
                    <td>
                      <Link
                        to={`/owners/${payment.owner.id}`}
                        className="link link-primary font-medium"
                      >
                        {payment.owner.name}
                      </Link>
                      {payment.owner.email && (
                        <div className="text-sm text-gray-500">
                          {payment.owner.email}
                        </div>
                      )}
                    </td>
                    <td className="font-bold text-error">
                      {formatCurrency(payment.amountPaid)}
                    </td>
                    <td>
                      <span className="badge badge-error">
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Component for LPG Payments Table
function LpgPaymentsTable({
  lpgRefills,
  allPendingData,
}: {
  lpgRefills: LpgRefill[];
  allPendingData: LpgPayment[];
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRefillId = searchParams.get("refill") || "all";

  // Filter data based on selected refill
  const paymentData =
    selectedRefillId === "all"
      ? allPendingData
      : allPendingData.filter(
          (payment) => payment.refillId === parseInt(selectedRefillId)
        );

  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">LPG Refill Payments Tracking</h2>
          <select
            className="select select-bordered select-sm"
            value={selectedRefillId}
            onChange={(e) => {
              if (e.target.value === "all") {
                searchParams.delete("refill");
              } else {
                searchParams.set("refill", e.target.value);
              }
              setSearchParams(searchParams);
            }}
          >
            <option value="all">All Refills</option>
            {lpgRefills.slice(0, 3).map((refill) => (
              <option key={refill.id} value={refill.id}>
                {formatRefillDate(refill.refill_date)}
              </option>
            ))}
          </select>
        </div>

        {paymentData.length === 0 ? (
          <div className="alert alert-success">
            <span className="text-success">✓</span>
            <span>No pending payments found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Apartment</th>
                  <th>Owner</th>
                  <th>Amount Owed</th>
                  <th>Amount Paid</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentData.map((payment, idx) => (
                  <tr key={`lpg-${payment.owner?.id || idx}-${idx}`}>
                    <td className="font-bold">
                      {payment.owner?.apartment_id ||
                        payment.entry?.owner?.apartment_id}
                    </td>
                    <td>
                      {payment.owner && (
                        <>
                          <Link
                            to={`/owners/${payment.owner.id}`}
                            className="link link-primary font-medium"
                          >
                            {payment.owner.name}
                          </Link>
                          {payment.owner.email && (
                            <div className="text-sm text-gray-500">
                              {payment.owner.email}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="font-bold text-error">
                      {formatCurrency(payment.amountOwed || 0)}
                    </td>
                    <td className="text-success">
                      {formatCurrency(payment.amountPaid || 0)}
                    </td>
                    <td
                      className={
                        (payment.remainingBalance || 0) <= 0
                          ? "text-success font-bold"
                          : "text-error font-bold"
                      }
                    >
                      {formatCurrency(payment.remainingBalance || 0)}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          payment.status === "paid"
                            ? "badge-success"
                            : "badge-error"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
