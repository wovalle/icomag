import { useRef, useState } from "react";
import { Link } from "react-router";

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
}

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
}: TransactionTableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [selectedTagId, setSelectedTagId] = useState("");
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Start editing description
  const startEditingDescription = () => {
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
    await onDescriptionUpdate(transaction.id, editedDescription);
    setIsEditing(false);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
  };

  // Handle tag addition
  const handleAddTag = async () => {
    if (!selectedTagId) return;
    await onAddTag(transaction.id, selectedTagId);
    setSelectedTagId("");
  };

  return (
    <tr>
      <td>{formatDate(transaction.date)}</td>
      <td className="max-w-xs">
        {isEditing ? (
          <div className="flex">
            <input
              ref={descriptionInputRef}
              type="text"
              className="input input-bordered input-sm mr-1 w-full"
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
            <button className="btn btn-sm btn-ghost" onClick={saveDescription}>
              Save
            </button>
            <button className="btn btn-sm btn-ghost" onClick={cancelEditing}>
              Cancel
            </button>
          </div>
        ) : (
          <div
            className="cursor-pointer hover:bg-base-200 p-1 rounded"
            onClick={startEditingDescription}
            title="Click to edit"
          >
            {transaction.description ||
              transaction.bank_description ||
              "No description"}
          </div>
        )}
        {transaction.bank_description &&
          transaction.description !== transaction.bank_description && (
            <div className="text-xs text-gray-500 mt-1">
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
        <select
          className="select select-bordered select-sm w-full max-w-xs"
          value={transaction.owner_id || ""}
          onChange={(e) => onOwnerChange(transaction.id, e.target.value)}
        >
          <option value="">No Owner</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name} ({owner.apartment_id})
            </option>
          ))}
        </select>
      </td>
      <td>
        <div className="flex flex-wrap gap-1 mb-1">
          {transaction.tags &&
            transaction.tags.map((tag) => (
              <div
                key={tag.id}
                className="badge gap-1"
                style={{ backgroundColor: tag.color || "#888" }}
              >
                {tag.name}
                <button
                  className="btn btn-xs btn-circle btn-ghost"
                  onClick={() => onRemoveTag(transaction.id, tag.id)}
                >
                  ×
                </button>
              </div>
            ))}
        </div>
        <div className="flex">
          <select
            className="select select-bordered select-xs w-full max-w-[120px]"
            value={selectedTagId}
            onChange={(e) => setSelectedTagId(e.target.value)}
          >
            <option value="">Add tag...</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-xs ml-1"
            disabled={!selectedTagId}
            onClick={handleAddTag}
          >
            Add
          </button>
        </div>
      </td>
      <td>
        <div className="join">
          <Link
            to={`/transactions/${transaction.id}`}
            className="btn btn-sm btn-outline join-item"
          >
            Details
          </Link>
        </div>
      </td>
    </tr>
  );
}
