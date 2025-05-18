import { redirect } from "react-router";

import { TransactionService } from "../services/transactionService";

import type { Route } from "./+types/transactions.$id.attachment.$attachmentId";

export const loader = async ({
  params,
  context,
  request,
}: Route.LoaderArgs) => {
  await context.assertLoggedInUser({ context, request });

  const { id, attachmentId } = params;

  if (!id || !attachmentId) {
    return redirect("/transactions");
  }

  const transactionId = parseInt(id);
  const attachmentIdNum = parseInt(attachmentId);

  // Verify the transaction exists and the attachment belongs to it
  const transactionService = new TransactionService(context.db);
  const transaction = await transactionService.getTransactionById(
    transactionId
  );

  if (!transaction.success || !transaction.transaction) {
    return redirect("/transactions");
  }

  // Check if the attachment belongs to this transaction
  const attachmentBelongsToTransaction =
    transaction.transaction.attachments?.some(
      (attachment) => attachment.id === attachmentIdNum
    );

  if (!attachmentBelongsToTransaction) {
    return redirect(`/transactions/${id}`);
  }

  // Get a presigned URL for the attachment
  const result = await context.attachmentService.getAttachmentUrl(
    attachmentIdNum
  );

  if (!result.success || !result.url) {
    return redirect(`/transactions/${id}`);
  }

  // Redirect to the attachment URL
  return redirect(result.url);
};
