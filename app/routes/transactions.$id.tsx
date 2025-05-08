import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Owner {
  id: number;
  name: string;
  apartment_id: string;
}

interface Transaction {
  id: number;
  date: number;
  description: string;
  bank_description: string;
  amount: number;
  type: string;
  owner_id: number | null;
  tags: Tag[];
  reference?: string | null;
  serial?: string | null;
}

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");

  // Dummy formatters - replace with your actual formatters
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  useEffect(() => {
    async function fetchTransactionData() {
      try {
        setLoading(true);

        // In a real app, you would fetch transaction data from your API
        // For now, simulate API calls with timeouts

        // Fetch transaction
        const response = await fetch(`/api/transactions/${id}`);
        if (!response.ok) {
          throw new Error("Transaction not found");
        }
        const data = await response.json();
        setTransaction(data);
        setEditedDescription(data.description);

        // Fetch owners
        const ownersResponse = await fetch("/api/owners");
        const ownersData = await ownersResponse.json();
        setOwners(ownersData);

        // Fetch tags
        const tagsResponse = await fetch("/api/tags");
        const tagsData = await tagsResponse.json();
        setAllTags(tagsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchTransactionData();
  }, [id]);

  const handleUpdateDescription = async () => {
    if (!transaction) return;

    try {
      // In a real app, send the updated description to your API
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: editedDescription }),
      });

      if (!response.ok) {
        throw new Error("Failed to update transaction");
      }

      // Update local state
      setTransaction({
        ...transaction,
        description: editedDescription,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleOwnerChange = async (ownerId: string) => {
    if (!transaction) return;

    try {
      // In a real app, send the updated owner to your API
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner_id: ownerId === "null" ? null : parseInt(ownerId),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update owner");
      }

      // Update local state
      setTransaction({
        ...transaction,
        owner_id: ownerId === "null" ? null : parseInt(ownerId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleAddTag = async () => {
    if (!transaction || !selectedTagId) return;

    try {
      // In a real app, send the tag to your API
      const response = await fetch(`/api/transactions/${id}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tag_id: parseInt(selectedTagId) }),
      });

      if (!response.ok) {
        throw new Error("Failed to add tag");
      }

      // Find the tag that was added
      const tagToAdd = allTags.find(
        (tag) => tag.id === parseInt(selectedTagId)
      );
      if (tagToAdd && !transaction.tags.some((tag) => tag.id === tagToAdd.id)) {
        // Update local state
        setTransaction({
          ...transaction,
          tags: [...transaction.tags, tagToAdd],
        });
        setSelectedTagId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!transaction) return;

    try {
      // In a real app, delete the tag from your API
      const response = await fetch(`/api/transactions/${id}/tags/${tagId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove tag");
      }

      // Update local state
      setTransaction({
        ...transaction,
        tags: transaction.tags.filter((tag) => tag.id !== tagId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="alert alert-error shadow-lg max-w-md">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/transactions")}
          className="btn btn-primary mt-4"
        >
          Back to Transactions
        </button>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="alert alert-warning shadow-lg max-w-md">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Transaction not found</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/transactions")}
          className="btn btn-primary mt-4"
        >
          Back to Transactions
        </button>
      </div>
    );
  }

  const owner = owners.find((o) => o.id === transaction.owner_id);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Link to="/transactions" className="btn btn-ghost mr-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">Transaction Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Transaction Information</h2>
            <div className="divider"></div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Transaction ID
                </span>
                <span>{transaction.id}</span>
              </div>

              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Date
                </span>
                <span>{formatDate(transaction.date)}</span>
              </div>

              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Amount
                </span>
                <span
                  className={`text-lg font-bold ${
                    transaction.type === "credit"
                      ? "text-success"
                      : "text-error"
                  }`}
                >
                  {formatCurrency(transaction.amount)}
                </span>
              </div>

              <div>
                <span className="font-semibold block text-sm opacity-70">
                  Type
                </span>
                <div className="badge badge-outline">
                  {transaction.type === "credit" ? "Credit" : "Debit"}
                </div>
              </div>

              {transaction.reference && (
                <div>
                  <span className="font-semibold block text-sm opacity-70">
                    Reference
                  </span>
                  <span>{transaction.reference}</span>
                </div>
              )}

              {transaction.serial && (
                <div>
                  <span className="font-semibold block text-sm opacity-70">
                    Serial
                  </span>
                  <span>{transaction.serial}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Description</h2>
            <div className="divider"></div>

            {isEditing ? (
              <div>
                <textarea
                  className="textarea textarea-bordered w-full"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={4}
                ></textarea>
                <div className="flex gap-2 mt-2">
                  <button
                    className="btn btn-primary"
                    onClick={handleUpdateDescription}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedDescription(transaction.description);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-4">{transaction.description}</p>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Description
                </button>
              </div>
            )}

            <div className="mt-4">
              <span className="font-semibold block text-sm opacity-70">
                Bank Description
              </span>
              <p className="text-sm opacity-80">
                {transaction.bank_description}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Owner</h2>
            <div className="divider"></div>

            <select
              className="select select-bordered w-full"
              value={transaction.owner_id?.toString() || "null"}
              onChange={(e) => handleOwnerChange(e.target.value)}
            >
              <option value="null">Not assigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id.toString()}>
                  {owner.name} ({owner.apartment_id})
                </option>
              ))}
            </select>

            {owner && (
              <div className="mt-4">
                <Link
                  to={`/owners/${owner.id}`}
                  className="btn btn-outline btn-sm btn-block"
                >
                  View Owner Details
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Tags</h2>
            <div className="divider"></div>

            <div className="flex flex-wrap gap-2 mb-4">
              {transaction.tags.length === 0 ? (
                <span className="text-sm opacity-70">No tags assigned</span>
              ) : (
                transaction.tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="badge gap-1"
                    style={{ backgroundColor: tag.color, color: "#fff" }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="badge badge-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="join">
              <select
                className="select select-bordered join-item w-full"
                value={selectedTagId}
                onChange={(e) => setSelectedTagId(e.target.value)}
              >
                <option value="" disabled>
                  Add a tag
                </option>
                {allTags
                  .filter(
                    (tag) => !transaction.tags.some((t) => t.id === tag.id)
                  )
                  .map((tag) => (
                    <option key={tag.id} value={tag.id.toString()}>
                      {tag.name}
                    </option>
                  ))}
              </select>
              <button
                className="btn join-item"
                onClick={handleAddTag}
                disabled={!selectedTagId}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
