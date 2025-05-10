import { Form } from "react-router";
import type { Owner, Tag } from "../types";

interface AddTransactionModalProps {
  isOpen: boolean;
  owners: Owner[];
  tags: Tag[];
  onClose: () => void;
}

export default function AddTransactionModal({
  isOpen,
  owners,
  tags,
  onClose,
}: AddTransactionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <dialog open className="modal">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg">Add New Transaction</h3>
        <Form method="post">
          <input type="hidden" name="intent" value="create" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Type</span>
              </label>
              <select name="type" className="select select-bordered" required>
                <option value="">Select Type</option>
                <option value="debit">Debit (Money In)</option>
                <option value="credit">Credit (Money Out)</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="amount"
                placeholder="0.00"
                className="input input-bordered"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <input
                type="text"
                name="description"
                placeholder="Transaction description"
                className="input input-bordered"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Date</span>
              </label>
              <input
                type="date"
                name="date"
                className="input input-bordered"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Owner</span>
              </label>
              <select name="owner_id" className="select select-bordered">
                <option value="">Select Owner (optional)</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name} ({owner.apartment_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Reference Number</span>
              </label>
              <input
                type="text"
                name="reference"
                placeholder="Bank reference number"
                className="input input-bordered"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Category</span>
              </label>
              <input
                type="text"
                name="category"
                placeholder="Category"
                className="input input-bordered"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Tags</span>
              </label>
              <select
                name="tag_ids"
                className="select select-bordered"
                multiple
                size="3"
              >
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <p className="text-xs mt-1">
                Hold Ctrl (Cmd on Mac) to select multiple tags
              </p>
            </div>
          </div>

          <div className="modal-action">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </Form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
