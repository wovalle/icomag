import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import type { Owner, Tag, Transaction } from "../types";

interface TransactionTableRowProps {
  transaction: Transaction;
  owners: Owner[];
  tags: Tag[];
  formatCurrency: (amount: number) => string;
  formatDate: (timestamp: number) => string;
  onDescriptionUpdate: (
    transactionId: number,
    description: string
  ) => Promise<void>;
  onOwnerChange: (transactionId: number, ownerId: string) => Promise<void>;
  onAddTag: (transactionId: number, tagId: string) => Promise<void>;
  onRemoveTag: (transactionId: number, tagId: number) => Promise<void>;
  isAdmin?: boolean;
  registerMode?: boolean;
  opacity?: number;
}

export default function TransactionTableRow({
  transaction,
  owners,
  tags,
  formatCurrency,
  formatDate,
  onDescriptionUpdate,
  onOwnerChange,
  onAddTag,
  onRemoveTag,
  isAdmin = false,
  registerMode = false,
  opacity = 1,
}: TransactionTableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const autoAssignFetcher = useFetcher();

  // Start editing description
  const startEditingDescription = () => {
    if (!isAdmin) return;

    setIsEditing(true);
    setEditedDescription(
      transaction.description || transaction.bank_description || ""
    );

    // Focus the input after it renders
    setTimeout(() => {
      if (descriptionInputRef.current) {
        descriptionInputRef.current.focus();
      }
    }, 50);
  };

  // Save description
  const saveDescription = async () => {
    if (!isAdmin) return;
    await onDescriptionUpdate(transaction.id, editedDescription);
    setIsEditing(false);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
  };

  // Handle tag selection (now with auto-save)
  const handleTagChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isAdmin) return;
    const tagId = e.target.value;
    if (tagId) {
      await onAddTag(transaction.id, tagId);
      e.target.value = ""; // Reset select after adding
    }
  };

  // Handle auto-assign owner
  const handleAutoAssignOwner = () => {
    if (!isAdmin) return;

    // Close the menu after clicking
    if (menuRef.current) {
      menuRef.current.open = false;
    }

    // Create form data for auto-assign request
    const formData = new FormData();
    formData.append("intent", "autoAssignOwner");
    formData.append("transaction_id", transaction.id.toString());

    // Use the fetcher to submit this form
    autoAssignFetcher.submit(formData, {
      method: "POST",
      action: "/transactions",
    });
  };

  // Update owner when auto-assign completes successfully
  useEffect(() => {
    if (
      isAdmin &&
      autoAssignFetcher.data &&
      autoAssignFetcher.data.success &&
      autoAssignFetcher.data.owner_id !== null
    ) {
      // If successful and an owner was found, update the local state
      onOwnerChange(transaction.id, autoAssignFetcher.data.owner_id.toString());
    }
  }, [autoAssignFetcher.data, transaction.id, onOwnerChange, isAdmin]);

  // Apply opacity styling based on register mode and the transaction properties
  const rowStyle = registerMode 
    ? { opacity: opacity, transition: "opacity 0.2s" }
    : {};

  return (
    <tr style={rowStyle}>
      <td>{formatDate(transaction.date)}</td>
      <td className="max-w-xs">
        {isEditing ? (
          <div className="flex">
            <input
              ref={descriptionInputRef}
              type="text"
              className="input input-sm w-full"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveDescription();
                } else if (e.key === "Escape") {
                  cancelEditing();
                }
              }}
            />
            <div className="join">
              <button
                className="btn btn-sm join-item"
                onClick={saveDescription}
              >
                Save
              </button>
              <button
                className="btn btn-sm btn-ghost join-item"
                onClick={cancelEditing}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={
              isAdmin ? "cursor-pointer hover:bg-base-200 rounded p-2" : "p-2"
            }
            onClick={isAdmin ? startEditingDescription : undefined}
            title={isAdmin ? "Click to edit" : undefined}
          >
            {transaction.description ||
              transaction.bank_description ||
              "No description"}
          </div>
        )}
        {transaction.bank_description &&
          transaction.description !== transaction.bank_description && (
            <div className="text-xs text-base-content/60 mt-1">
              Original: {transaction.bank_description}
            </div>
          )}
      </td>
      <td
        className={
          transaction.type === "credit" ? "text-success" : "text-error"
        }
      >
        {formatCurrency(transaction.amount)}
      </td>
      <td>
        {transaction.type === "credit" ? (
          <div className="badge badge-success">Money In</div>
        ) : (
          <div className="badge badge-error">Money Out</div>
        )}
      </td>
      <td>
        {isAdmin ? (
          <select
            className="select select-sm select-bordered w-full max-w-xs"
            value={transaction.owner_id || ""}
            onChange={(e) => onOwnerChange(transaction.id, e.target.value)}
            disabled={!isAdmin}
          >
            <option value="">No Owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} ({owner.apartment_id})
              </option>
            ))}
          </select>
        ) : (
          <span>
            {transaction.owner_id
              ? owners.find((o) => o.id === transaction.owner_id)?.name +
                ` (${
                  owners.find((o) => o.id === transaction.owner_id)
                    ?.apartment_id
                })`
              : "No Owner"}
          </span>
        )}
      </td>
      <td>
        <div className="flex flex-wrap gap-1 mb-1">
          {transaction.tags &&
            transaction.tags.map((tag) => (
              <div
                key={tag.id}
                className="badge text-white gap-1"
                style={{ backgroundColor: tag.color || "#888" }}
              >
                {tag.name}
                {isAdmin && (
                  <button
                    className="btn btn-xs btn-circle btn-ghost"
                    onClick={() => onRemoveTag(transaction.id, tag.id)}
                    disabled={!isAdmin}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
        </div>
        {isAdmin && (
          <div className="flex">
            <select
              className="select select-xs select-bordered w-full"
              defaultValue=""
              onChange={handleTagChange}
              disabled={!isAdmin}
            >
              <option value="">Add tag...</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </td>
      {isAdmin && (
        <td>
          <details ref={menuRef} className="dropdown dropdown-end">
            <summary className="btn btn-sm btn-circle">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                />
              </svg>
            </summary>
            <ul className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-10">
              <li>
                <Link to={`/transactions/${transaction.id}`}>View Details</Link>
              </li>
              <li>
                <button
                  onClick={handleAutoAssignOwner}
                  className={
                    autoAssignFetcher.state !== "idle" ? "loading" : ""
                  }
                  disabled={autoAssignFetcher.state !== "idle" || !isAdmin}
                >
                  Auto-assign Owner
                </button>
              </li>
            </ul>
          </details>
        </td>
      )}
    </tr>
  );
}
