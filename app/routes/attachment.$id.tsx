import { redirect } from "react-router";

export const loader = async ({
  params,
  context,
}: {
  params: { id: string };
  context: any;
}) => {
  const { id } = params;

  if (!id) {
    return redirect("/");
  }

  const attachmentId = parseInt(id);

  if (isNaN(attachmentId)) {
    return redirect("/");
  }

  // Get a presigned URL for the attachment
  const result = await context.attachmentService.getAttachmentUrl(attachmentId);

  if (!result.success || !result.url) {
    return redirect("/");
  }

  // Redirect to the attachment URL
  return redirect(result.url);
};
