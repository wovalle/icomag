/**
 * Transaction Service
 *
 * Contains all the business logic for interacting with transactions
 */

/**
 * Updates the description of a transaction
 */
export async function updateTransactionDescription(
  transactionId: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("intent", "updateDescription");
    formData.append("id", transactionId.toString());
    formData.append("description", description);

    const response = await fetch("/transactions", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Server responded with status: ${response.status}`,
      };
    }

    const result = await response.json();
    return { success: !!result.success, error: result.error };
  } catch (error) {
    console.error("Error updating transaction description:", error);
    return {
      success: false,
      error: "Failed to update transaction description",
    };
  }
}

/**
 * Assigns an owner to a transaction
 */
export async function assignOwnerToTransaction(
  transactionId: number,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("intent", "assignOwner");
    formData.append("id", transactionId.toString());
    formData.append("owner_id", ownerId);

    const response = await fetch("/transactions", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Server responded with status: ${response.status}`,
      };
    }

    const result = await response.json();
    return { success: !!result.success, error: result.error };
  } catch (error) {
    console.error("Error assigning owner to transaction:", error);
    return { success: false, error: "Failed to assign owner to transaction" };
  }
}

/**
 * Adds a tag to a transaction
 */
export async function addTagToTransaction(
  transactionId: number,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("intent", "addTag");
    formData.append("transaction_id", transactionId.toString());
    formData.append("tag_id", tagId);

    const response = await fetch("/transactions", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Server responded with status: ${response.status}`,
      };
    }

    const result = await response.json();
    return { success: !!result.success, error: result.error };
  } catch (error) {
    console.error("Error adding tag to transaction:", error);
    return { success: false, error: "Failed to add tag to transaction" };
  }
}

/**
 * Removes a tag from a transaction
 */
export async function removeTagFromTransaction(
  transactionId: number,
  tagId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("intent", "removeTag");
    formData.append("transaction_id", transactionId.toString());
    formData.append("tag_id", tagId.toString());

    const response = await fetch("/transactions", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Server responded with status: ${response.status}`,
      };
    }

    const result = await response.json();
    return { success: !!result.success, error: result.error };
  } catch (error) {
    console.error("Error removing tag from transaction:", error);
    return { success: false, error: "Failed to remove tag from transaction" };
  }
}

/**
 * Creates a new transaction
 */
export async function createTransaction(transactionData: {
  type: string;
  amount: number;
  description: string;
  date: string;
  owner_id?: string | null;
  reference?: string | null;
  category?: string | null;
  tag_ids?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("type", transactionData.type);
    formData.append("amount", transactionData.amount.toString());
    formData.append("description", transactionData.description);
    formData.append("date", transactionData.date);

    if (transactionData.owner_id) {
      formData.append("owner_id", transactionData.owner_id);
    }

    if (transactionData.reference) {
      formData.append("reference", transactionData.reference);
    }

    if (transactionData.category) {
      formData.append("category", transactionData.category);
    }

    if (transactionData.tag_ids && transactionData.tag_ids.length > 0) {
      transactionData.tag_ids.forEach((tagId) => {
        formData.append("tag_ids", tagId);
      });
    }

    const response = await fetch("/transactions", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Server responded with status: ${response.status}`,
      };
    }

    const result = await response.json();
    return { success: !!result.success, error: result.error };
  } catch (error) {
    console.error("Error creating transaction:", error);
    return { success: false, error: "Failed to create transaction" };
  }
}

/**
 * Helper functions for formatting
 */
export const formatters = {
  /**
   * Formats a currency amount
   */
  formatCurrency: (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  },

  /**
   * Formats a timestamp to a date string
   */
  formatDate: (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  },
};
