import { DateTime } from "luxon";
import { useState } from "react";
import { redirect, useLoaderData } from "react-router";
import { useIsAdmin } from "~/hooks";
import type { AuditLogFilters } from "~/repositories/AuditLogRepository";
import type { Route } from "./+types/audit-logs";

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await context.getSession();

  // Check if user is admin
  if (!session?.isAdmin) {
    throw redirect("/");
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const event_type = url.searchParams.get("event_type") || undefined;
  const entity_type = url.searchParams.get("entity_type") || undefined;
  const user_email = url.searchParams.get("user_email") || undefined;
  const is_system_event = url.searchParams.get("is_system_event");
  const date_from = url.searchParams.get("date_from");
  const date_to = url.searchParams.get("date_to");
  const search = url.searchParams.get("search") || undefined;

  const filters: AuditLogFilters = {
    event_type: event_type as any,
    entity_type: entity_type as any,
    user_email,
    is_system_event:
      is_system_event === "true"
        ? true
        : is_system_event === "false"
        ? false
        : undefined,
    date_from: date_from ? new Date(date_from) : undefined,
    date_to: date_to ? new Date(date_to) : undefined,
    search,
  };

  try {
    const auditLogs = await context.auditService.getAuditLogs(filters, {
      page,
      limit,
    });

    return {
      auditLogs,
      filters,
      pagination: { page, limit },
    };
  } catch (error) {
    console.error("Error loading audit logs:", error);
    return {
      auditLogs: [],
      filters,
      pagination: { page, limit },
      error: "Failed to load audit logs",
    };
  }
}

export default function AuditLogs() {
  const { auditLogs, filters, pagination, error } =
    useLoaderData<typeof loader>();
  const isAdmin = useIsAdmin();
  const [showFilters, setShowFilters] = useState(false);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Access denied. Admin privileges required.</span>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return DateTime.fromSeconds(timestamp).toFormat("MMM dd, yyyy HH:mm:ss");
  };

  const formatDetails = (details: string | null) => {
    if (!details) return null;
    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return details;
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case "CREATE":
        return "bg-green-100 text-green-700 border-green-200";
      case "UPDATE":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "DELETE":
        return "bg-red-100 text-red-700 border-red-200";
      case "SIGN_IN":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "SIGN_OUT":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "BULK_IMPORT":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "BULK_DELETE":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType) {
      case "OWNER":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "TRANSACTION":
        return "bg-teal-100 text-teal-700 border-teal-200";
      case "TAG":
        return "bg-pink-100 text-pink-700 border-pink-200";
      case "ATTACHMENT":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "BATCH":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "SYSTEM":
        return "bg-cyan-100 text-cyan-700 border-cyan-200";
      default:
        return "bg-stone-100 text-stone-600 border-stone-200";
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-gray-500">
            Track all system events and entity changes
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn btn-outline"
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {showFilters && (
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">Filters</h2>
            <form
              method="get"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Event Type</span>
                </label>
                <select
                  name="event_type"
                  className="select select-bordered"
                  defaultValue={filters.event_type || ""}
                >
                  <option value="">All Events</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Entity Type</span>
                </label>
                <select
                  name="entity_type"
                  className="select select-bordered"
                  defaultValue={filters.entity_type || ""}
                >
                  <option value="">All Entities</option>
                  <option value="OWNER">Owner</option>
                  <option value="TRANSACTION">Transaction</option>
                  <option value="TAG">Tag</option>
                  <option value="ATTACHMENT">Attachment</option>
                  <option value="BATCH">Batch</option>
                  <option value="SYSTEM">System</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">User Email</span>
                </label>
                <input
                  type="email"
                  name="user_email"
                  className="input input-bordered"
                  placeholder="Filter by user email"
                  defaultValue={filters.user_email || ""}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Event Category</span>
                </label>
                <select
                  name="is_system_event"
                  className="select select-bordered"
                  defaultValue={
                    filters.is_system_event === undefined
                      ? ""
                      : filters.is_system_event.toString()
                  }
                >
                  <option value="">All Categories</option>
                  <option value="false">Entity Changes</option>
                  <option value="true">System Events</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Date From</span>
                </label>
                <input
                  type="date"
                  name="date_from"
                  className="input input-bordered"
                  defaultValue={
                    filters.date_from
                      ? filters.date_from.toISOString().split("T")[0]
                      : ""
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Date To</span>
                </label>
                <input
                  type="date"
                  name="date_to"
                  className="input input-bordered"
                  defaultValue={
                    filters.date_to
                      ? filters.date_to.toISOString().split("T")[0]
                      : ""
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Search Details</span>
                </label>
                <input
                  type="text"
                  name="search"
                  className="input input-bordered"
                  placeholder="Search in details"
                  defaultValue={filters.search || ""}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Results per page</span>
                </label>
                <select
                  name="limit"
                  className="select select-bordered"
                  defaultValue={pagination.limit.toString()}
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <div className="form-control flex justify-end">
                <div className="flex gap-2 mt-6">
                  <button type="submit" className="btn btn-primary">
                    Apply Filters
                  </button>
                  <a href="/audit-logs" className="btn btn-outline">
                    Clear
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="text-sm">{log.id}</td>
                      <td className="text-sm">{formatDate(log.created_at)}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center content-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEventTypeColor(
                              log.event_type
                            )}`}
                          >
                            {log.event_type}
                          </span>
                          {log.is_system_event ? (
                            <span className="badge badge-xs badge-info">
                              System
                            </span>
                          ) : (
                            <span className="badge badge-xs badge-ghost">
                              Entity
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center content-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEntityTypeColor(
                              log.entity_type
                            )}`}
                          >
                            {log.entity_type}
                          </span>
                          {log.entity_id && (
                            <span className="text-xs text-gray-500">
                              ID: {log.entity_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {log.user?.name || "System"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {log.user_email}
                          </span>
                        </div>
                      </td>
                      <td>
                        {log.details && (
                          <details className="collapse collapse-arrow">
                            <summary className="collapse-title text-xs p-2">
                              View Details
                            </summary>
                            <div className="collapse-content">
                              <pre className="text-xs bg-base-200 p-2 rounded overflow-auto max-h-32">
                                {formatDetails(log.details)}
                              </pre>
                            </div>
                          </details>
                        )}
                      </td>
                      <td className="text-xs text-gray-500">
                        {log.ip_address || "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {auditLogs.length > 0 && (
            <div className="flex justify-center mt-4">
              <div className="join">
                {pagination.page > 1 && (
                  <a
                    href={`?page=${pagination.page - 1}&limit=${
                      pagination.limit
                    }${Object.entries(filters)
                      .filter(
                        ([_, value]) => value !== undefined && value !== ""
                      )
                      .map(
                        ([key, value]) =>
                          `&${key}=${encodeURIComponent(value as string)}`
                      )
                      .join("")}`}
                    className="join-item btn"
                  >
                    Previous
                  </a>
                )}
                <span className="join-item btn btn-disabled">
                  Page {pagination.page}
                </span>
                {auditLogs.length === pagination.limit && (
                  <a
                    href={`?page=${pagination.page + 1}&limit=${
                      pagination.limit
                    }${Object.entries(filters)
                      .filter(
                        ([_, value]) => value !== undefined && value !== ""
                      )
                      .map(
                        ([key, value]) =>
                          `&${key}=${encodeURIComponent(value as string)}`
                      )
                      .join("")}`}
                    className="join-item btn"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
