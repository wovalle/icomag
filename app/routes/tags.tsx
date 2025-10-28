import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Form, Link, useFetcher, useSearchParams } from "react-router";
import { useIsAdmin } from "~/hooks";
import * as schema from "../../database/schema";
import type { Tag } from "../types";
import type { Route } from "./+types/tags";

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const session = await context.getSession();
    const tagsRepository = context.dbRepository.getTransactionTagsRepository();
    const lpgRefillsRepository = context.dbRepository.getLpgRefillsRepository();

    // Get all tags
    const tags = await tagsRepository.findMany<Tag>({
      orderBy: [
        { column: schema.transactionTags.created_at, direction: "desc" },
      ],
    });

    // Get all LPG refills
    const lpgRefills = await lpgRefillsRepository.findMany({});

    // Create a map of tag_id to lpg_refill for quick lookup
    const tagToLpgMap = new Map();
    lpgRefills.forEach((refill) => {
      if (refill.tag_id) {
        tagToLpgMap.set(refill.tag_id, refill);
      }
    });

    // Add associated LPG refill info to each tag
    const tagsWithLpg = tags.map((tag) => ({
      ...tag,
      associatedLpgRefill: tagToLpgMap.get(tag.id) || null,
    }));

    return {
      tags: tagsWithLpg,
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
    const month_year = formData.get("month_year")?.toString() || null;

    try {
      await tagsRepository.create({
        name,
        kind,
        month_year: month_year ? parseInt(month_year) : null,
      });
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

export default function TagsPage({ loaderData }: Route.ComponentProps) {
  const { tags, error } = loaderData;
  const isAdmin = useIsAdmin();
  const [actionError, setActionError] = useState<string | null>(null);
  const fetcher = useFetcher<typeof action>();
  const [selectedKind, setSelectedKind] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse kind filter from URL params
  const getKindFilterFromUrl = () => {
    return searchParams.get("kindFilter") || "all";
  };

  const [kindFilter, setKindFilter] = useState<string>(getKindFilterFromUrl);

  // Parse sorting from URL params
  const getSortingFromUrl = () => {
    const sortBy = searchParams.get("sortBy");
    const sortDesc = searchParams.get("sortDesc") === "true";

    if (sortBy) {
      return [{ id: sortBy, desc: sortDesc }];
    }

    // Default sorting
    return [{ id: "created_at", desc: true }];
  };

  const [sorting, setSorting] = useState(getSortingFromUrl);

  // Update URL when sorting changes
  const updateSortingInUrl = (newSorting: any[]) => {
    const newParams = new URLSearchParams(searchParams);

    if (newSorting.length > 0) {
      const sort = newSorting[0];
      newParams.set("sortBy", sort.id);
      newParams.set("sortDesc", sort.desc.toString());
    } else {
      newParams.delete("sortBy");
      newParams.delete("sortDesc");
    }

    setSearchParams(newParams, { replace: true });
  };

  // Update URL when kind filter changes
  const updateKindFilterInUrl = (newKindFilter: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (newKindFilter !== "all") {
      newParams.set("kindFilter", newKindFilter);
    } else {
      newParams.delete("kindFilter");
    }

    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    if (fetcher.data?.error) {
      setActionError(fetcher.data.error);
    } else if (fetcher.data?.success) {
      setActionError(null);
      setSelectedKind("");
    }
  }, [fetcher.data]);

  // Sync state when URL params change
  useEffect(() => {
    const newSorting = getSortingFromUrl();
    setSorting(newSorting);

    const newKindFilter = getKindFilterFromUrl();
    setKindFilter(newKindFilter);
  }, [searchParams]);

  // Format month_year to readable format (YYYYMM -> Month YYYY)
  const formatMonthYear = (monthYear: number | null | undefined): string => {
    if (!monthYear) return "—";
    const year = Math.floor(monthYear / 100);
    const month = monthYear % 100;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Format timestamp to readable date
  const formatCreatedDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Table columns definition
  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: (info: any) => (
          <Link
            to={`/tags/${info.row.original.id}`}
            className="link link-primary font-medium"
          >
            {info.getValue()}
          </Link>
        ),
      },
      {
        accessorKey: "kind",
        header: "Kind",
        cell: (info: any) => {
          const kind = info.getValue();
          if (!kind) return <span className="text-base-content/50">—</span>;
          return (
            <span className="badge badge-info badge-sm">
              {kind === "monthly-payment" ? "Monthly Payment" : kind}
            </span>
          );
        },
      },
      {
        accessorKey: "color",
        header: "Color",
        cell: (info: any) => {
          const color = info.getValue();
          if (!color) return "—";
          return (
            <div
              className="w-6 h-6 rounded-full border-2 border-base-300"
              style={{ backgroundColor: color }}
            />
          );
        },
      },
      {
        accessorKey: "month_year",
        header: "Month/Year",
        cell: (info: any) => {
          return formatMonthYear(info.getValue());
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: (info: any) => {
          return formatCreatedDate(info.getValue());
        },
      },
      {
        id: "lpg",
        header: "LPG",
        cell: (info: any) => {
          const associatedLpg = info.row.original.associatedLpgRefill;
          if (!associatedLpg)
            return <span className="text-base-content/50">—</span>;
          return (
            <Link to={`/lpg/${associatedLpg.id}`} className="link link-primary">
              View
            </Link>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: (info: any) => {
          const tag = info.row.original;
          return isAdmin ? (
            <button
              onClick={() => handleDeleteTag(tag.id)}
              className="btn btn-error btn-xs"
              title="Delete tag"
            >
              Delete
            </button>
          ) : (
            <button
              className="btn btn-error btn-xs btn-disabled"
              title="Admin access required"
            >
              Delete
            </button>
          );
        },
      },
    ],
    [isAdmin]
  );

  const handleCreateTag = async (
    name: string,
    kind: string,
    month_year: string
  ) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to create tags");
      return;
    }

    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("name", name);
    formData.append("kind", kind);
    if (month_year) {
      formData.append("month_year", month_year);
    }

    fetcher.submit(formData, { method: "post" });
  };

  const handleDeleteTag = async (id: number) => {
    if (!isAdmin) {
      setActionError("Admin privileges required to delete tags");
      return;
    }

    if (!confirm("Are you sure you want to delete this tag?")) {
      return;
    }

    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("id", id.toString());

    fetcher.submit(formData, { method: "post" });
  };

  // Filter by kind
  const filteredTags = useMemo(() => {
    if (kindFilter === "all") return tags;
    return tags.filter((tag) => tag.kind === kindFilter);
  }, [tags, kindFilter]);

  const table = useReactTable({
    data: filteredTags,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      updateSortingInUrl(newSorting);
    },
    manualSorting: false,
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const kind = formData.get("kind") as string;
    const month_year_raw = formData.get("month_year") as string | null;

    // Convert YYYY-MM format to YYYYMM
    const month_year = month_year_raw ? month_year_raw.replace("-", "") : "";

    handleCreateTag(name, kind, month_year);
    e.currentTarget.reset();
    setSelectedKind("");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tags</h1>
      </div>

      {isAdmin && (
        <Form
          method="post"
          className="card bg-base-100 shadow-md p-4"
          onSubmit={handleCreateSubmit}
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              name="name"
              placeholder="Tag name"
              className="input input-bordered input-sm"
              required
            />
            <select
              name="kind"
              className="select select-bordered select-sm"
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value)}
            >
              <option value="">No Kind</option>
              <option value="monthly-payment">Monthly Payment</option>
            </select>
            {selectedKind === "monthly-payment" && (
              <input
                type="month"
                name="month_year"
                className="input input-bordered input-sm"
                required
              />
            )}
            <button type="submit" className="btn btn-primary btn-sm">
              Add Tag
            </button>
          </div>
        </Form>
      )}

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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <select
            className="select select-bordered select-sm"
            value={kindFilter}
            onChange={(e) => {
              const newValue = e.target.value;
              setKindFilter(newValue);
              updateKindFilterInUrl(newValue);
            }}
          >
            <option value="all">All Kinds</option>
            <option value="monthly-payment">Monthly Payment</option>
          </select>
        </div>
        {kindFilter !== "all" && (
          <span className="badge badge-outline">
            {filteredTags.length} tag{filteredTags.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th key={header.id}>
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {canSort && (
                          <button
                            onClick={header.column.getToggleSortingHandler()}
                            className="btn btn-ghost btn-xs"
                          >
                            {isSorted === "asc" ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : isSorted === "desc" ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronsUpDown className="w-4 h-4 opacity-30" />
                            )}
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-8 text-base-content/50"
                >
                  No tags found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
