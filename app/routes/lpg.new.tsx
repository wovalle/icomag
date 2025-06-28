import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import { useIsAdmin } from "~/hooks";
import { owners, transactionTags } from "../../database/schema";
import type { Route } from "./+types/lpg.new";

interface ProcessedEntryData {
  ownerId: number;
  currentReading: number;
  previousReading: number;
  consumption: number;
}

interface RefillEntry {
  ownerId: number;
  currentReading: number;
  photos?: File[];
}

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const session = await context.getSession();

    // Check if user is admin
    if (!session?.isAdmin) {
      throw redirect("/lpg");
    }

    // Get repositories
    const ownersRepo = context.dbRepository.getOwnersRepository();
    const tagsRepo = context.dbRepository.getTransactionTagsRepository();
    const lpgRefillsRepo = context.dbRepository.getLpgRefillsRepository();

    // Get all active owners
    const ownersList = await ownersRepo.findMany({
      where: eq(owners.is_active, 1),
      orderBy: [{ column: owners.apartment_id, direction: "asc" }],
    });

    // Get all tags
    const tagsList = await tagsRepo.findMany({
      orderBy: [{ column: transactionTags.name, direction: "asc" }],
    });

    // Get latest refill to get previous readings
    const latestRefill = await lpgRefillsRepo.findLatest();

    return {
      owners: ownersList,
      tags: tagsList,
      error: null,
      isAdmin: session?.isAdmin ?? false,
      latestRefill: latestRefill ?? null,
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Error loading new refill form:", error);
    return {
      owners: [],
      tags: [],
      error: "Failed to load form data",
      isAdmin: false,
      latestRefill: null,
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    return {
      success: false,
      error: "Admin privileges required to create refills",
    };
  }

  try {
    const formData = await request.formData();

    const billAmount = parseFloat(formData.get("billAmount") as string);
    const gallonsRefilled = parseFloat(
      formData.get("gallonsRefilled") as string
    );
    const refillDate = formData.get("refillDate") as string;
    const efficiencyPercentage =
      parseFloat(formData.get("efficiencyPercentage") as string) ?? 0;
    const tagId = formData.get("tagId")
      ? parseInt(formData.get("tagId") as string)
      : null;

    // Validate required fields
    if (isNaN(billAmount) ?? isNaN(gallonsRefilled) ?? !refillDate) {
      return {
        success: false,
        error: "Bill amount, gallons refilled, and date are required",
      };
    }

    // Parse entries data
    const entriesData: ProcessedEntryData[] = JSON.parse(
      (formData.get("entries") as string) ?? "[]"
    );

    if (entriesData.length === 0) {
      return {
        success: false,
        error: "At least one apartment entry is required",
      };
    }

    // Validate entries
    for (const entry of entriesData) {
      if (isNaN(entry.currentReading) ?? entry.currentReading < 0) {
        return {
          success: false,
          error: "All current readings must be valid numbers",
        };
      }
    }

    // Calculate totals
    const totalConsumption = entriesData.reduce(
      (sum: number, entry: ProcessedEntryData) => sum + entry.consumption,
      0
    );

    if (totalConsumption <= 0) {
      return {
        success: false,
        error: "Total consumption must be greater than zero",
      };
    }

    // Calculate percentages and amounts
    const processedEntries = entriesData.map((entry: ProcessedEntryData) => {
      const percentage = (entry.consumption / totalConsumption) * 100;
      const subtotal = (percentage / 100) * billAmount;
      const totalAmount = subtotal * (1 + efficiencyPercentage / 100);

      return {
        owner_id: entry.ownerId,
        previous_reading: entry.previousReading,
        current_reading: entry.currentReading,
        consumption: entry.consumption,
        percentage,
        subtotal,
        total_amount: totalAmount,
      };
    });

    // Create refill with entries
    const lpgRefillsRepo = context.dbRepository.getLpgRefillsRepository();

    const result = await lpgRefillsRepo.createRefillWithEntries(
      {
        bill_amount: billAmount,
        gallons_refilled: gallonsRefilled,
        refill_date: Math.floor(new Date(refillDate).getTime() / 1000),
        efficiency_percentage: efficiencyPercentage,
        tag_id: tagId,
      },
      processedEntries
    );

    // Handle file uploads if any
    const billFile = formData.get("billFile") as File;
    if (billFile && billFile.size > 0) {
      // Upload bill attachment
      await context.attachmentService.uploadAttachment(
        result.refill.id,
        billFile,
        "refill"
      );
    }

    // Redirect to the LPG list page on success
    throw redirect("/lpg");
  } catch (error) {
    // If it's a redirect, let it through
    if (error instanceof Response) {
      throw error;
    }
    console.error("Error creating refill:", error);
    return {
      success: false,
      error: "Failed to create refill",
    };
  }
}

export default function NewLpgRefill({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const isAdmin = useIsAdmin();
  const { owners, tags, error, latestRefill } = loaderData;

  const [entries, setEntries] = useState<RefillEntry[]>([]);
  const [billAmount, setBillAmount] = useState<number>(0);
  const [efficiencyPercentage, setEfficiencyPercentage] =
    useState<number>(0.03);
  const [selectedTagId, setSelectedTagId] = useState<string>("");

  // Initialize entries with all owners and their previous readings
  useEffect(() => {
    if (owners.length > 0) {
      const initialEntries = owners.map((owner) => ({
        ownerId: owner.id,
        currentReading: getPreviousReading(owner.id), // Start with previous reading
        photos: undefined,
      }));
      setEntries(initialEntries);
    }
  }, [owners, latestRefill]);

  // If not admin, redirect would happen in loader
  if (!isAdmin) {
    return null;
  }

  // Calculate totals
  const totalConsumption = entries.reduce(
    (sum, entry) =>
      sum + (entry.currentReading - getPreviousReading(entry.ownerId)),
    0
  );

  function getPreviousReading(ownerId: number): number {
    if (!latestRefill) return 0;
    const lastEntry = latestRefill.entries?.find((e) => e.owner_id === ownerId);
    return lastEntry?.current_reading ?? 0;
  }

  function updateEntry(
    index: number,
    field: keyof RefillEntry,
    value: number | File[]
  ) {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  }

  function calculateEntryDetails(entry: RefillEntry) {
    const previousReading = getPreviousReading(entry.ownerId);
    const consumption = entry.currentReading - previousReading;
    const percentage =
      totalConsumption > 0 ? (consumption / totalConsumption) * 100 : 0;
    const subtotal = billAmount > 0 ? (percentage / 100) * billAmount : 0;
    const totalAmount = subtotal * (1 + efficiencyPercentage / 100);

    return {
      previousReading,
      consumption,
      percentage,
      subtotal,
      totalAmount,
    };
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Prepare entries data with calculations
    const processedEntries = entries.map((entry) => {
      const details = calculateEntryDetails(entry);
      return {
        ownerId: entry.ownerId,
        currentReading: entry.currentReading,
        previousReading: details.previousReading,
        consumption: details.consumption,
      };
    });

    // Create form data
    const formData = new FormData(event.target as HTMLFormElement);
    formData.set("entries", JSON.stringify(processedEntries));

    // Submit with fetcher
    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">New LPG Refill</h1>
          <p className="text-gray-500">Create a new LPG tank refill record</p>
        </div>
        <Link to="/lpg" className="btn">
          Cancel
        </Link>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {fetcher.data?.error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{fetcher.data.error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} encType="multipart/form-data">
        {/* Refill Information */}
        <div className="card shadow-md mb-6">
          <div className="card-body">
            <h2 className="card-title">Refill Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Bill Amount ($)</span>
                </label>
                <input
                  type="number"
                  name="billAmount"
                  value={billAmount}
                  onChange={(e) =>
                    setBillAmount(parseFloat(e.target.value) ?? 0)
                  }
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Gallons Refilled</span>
                </label>
                <input
                  type="number"
                  name="gallonsRefilled"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Refill Date</span>
                </label>
                <input
                  type="date"
                  name="refillDate"
                  className="input input-bordered"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Efficiency Percentage (%)</span>
                </label>
                <input
                  type="number"
                  name="efficiencyPercentage"
                  value={efficiencyPercentage}
                  onChange={(e) =>
                    setEfficiencyPercentage(parseFloat(e.target.value) ?? 0)
                  }
                  className="input input-bordered"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Tag (Optional)</span>
                </label>
                <select
                  name="tagId"
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(e.target.value)}
                  className="select select-bordered"
                >
                  <option value="">No tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Bill File (Optional)</span>
                </label>
                <input
                  type="file"
                  name="billFile"
                  accept="image/*,application/pdf"
                  className="file-input file-input-bordered"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Apartment Entries */}
        <div className="card shadow-md mb-6">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title">Apartment Readings</h2>
              <div className="badge badge-info">
                {owners.length} apartments loaded
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-4">
                <div className="loading loading-spinner loading-md"></div>
                <p className="mt-2">Loading apartment data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Apartment</th>
                      <th>Owner</th>
                      <th>Previous Reading</th>
                      <th>Current Reading</th>
                      <th>Consumption</th>
                      <th>Percentage</th>
                      <th>Subtotal</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => {
                      const details = calculateEntryDetails(entry);
                      const owner = owners.find((o) => o.id === entry.ownerId);

                      return (
                        <tr key={entry.ownerId}>
                          <td>
                            <div className="font-bold">
                              {owner?.apartment_id}
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-col">
                              <div className="font-medium">{owner?.name}</div>
                              {owner?.email && (
                                <div className="text-sm text-gray-500">
                                  {owner.email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="font-mono">
                              {details.previousReading.toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min={details.previousReading}
                              value={entry.currentReading}
                              onChange={(e) =>
                                updateEntry(
                                  index,
                                  "currentReading",
                                  parseFloat(e.target.value) ?? 0
                                )
                              }
                              className="input input-bordered input-sm w-24 font-mono"
                              required
                            />
                          </td>
                          <td>
                            <span
                              className={`font-mono font-medium ${
                                details.consumption >= 0
                                  ? "text-success"
                                  : "text-error"
                              }`}
                            >
                              {details.consumption.toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-mono">
                                {details.percentage.toFixed(2)}%
                              </span>
                              <progress
                                className="progress progress-primary w-16"
                                value={details.percentage}
                                max="100"
                              ></progress>
                            </div>
                          </td>
                          <td>
                            <span className="font-mono">
                              {formatCurrency(details.subtotal)}
                            </span>
                          </td>
                          <td>
                            <span className="font-bold font-mono">
                              {formatCurrency(details.totalAmount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {entries.length > 0 && (
              <div className="stats shadow mt-4">
                <div className="stat">
                  <div className="stat-title">Total Consumption</div>
                  <div className="stat-value">
                    {totalConsumption.toFixed(2)}
                  </div>
                  <div className="stat-desc">gallons consumed</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Average per Apartment</div>
                  <div className="stat-value text-2xl">
                    {entries.length > 0
                      ? (totalConsumption / entries.length).toFixed(2)
                      : "0.00"}
                  </div>
                  <div className="stat-desc">gallons per apartment</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Total Amount</div>
                  <div className="stat-value">
                    {formatCurrency(
                      entries.reduce(
                        (sum, entry) =>
                          sum + calculateEntryDetails(entry).totalAmount,
                        0
                      )
                    )}
                  </div>
                  <div className="stat-desc">including efficiency</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link to="/lpg" className="btn">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={entries.length === 0 || fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting" ? "Saving..." : "Save Refill"}
          </button>
        </div>
      </form>
    </div>
  );
}
