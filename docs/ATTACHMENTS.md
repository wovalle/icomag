# Transaction Attachments with Cloudflare R2 and Presigned URLs

This application uses Cloudflare R2 for storing attachments (files, receipts, invoices) related to transactions.
The implementation uses presigned URLs to provide secure, time-limited access to files.

## Requirements

- Cloudflare R2 bucket
- R2 API Tokens with proper permissions
- `aws4fetch` npm package for generating presigned URLs

## Setup Instructions

### 1. Create an R2 Bucket

If you haven't already created an R2 bucket:

1. Go to the Cloudflare dashboard
2. Navigate to R2
3. Create a new bucket named "icona" (or use your existing bucket)

### 2. Generate R2 API Tokens

To enable presigned URLs, you need to create an API token with the appropriate permissions:

1. Go to the Cloudflare dashboard
2. Navigate to R2 > Manage R2 API Tokens
3. Create a new API token with read and write permissions for your bucket
4. Copy the Access Key ID and Secret Access Key

### 3. Update Environment Variables

Edit the `wrangler.jsonc` file and update the R2 credentials:

```jsonc
"vars": {
  "VITE_CLERK_PUBLISHABLE_KEY": "...",
  "R2_ACCOUNT_ID": "your_account_id_here", // Your Cloudflare account ID
  "R2_ACCESS_KEY_ID": "your_access_key_id_here", // The Access Key ID from step 2
  "R2_SECRET_ACCESS_KEY": "your_secret_access_key_here" // The Secret Access Key from step 2
}
```

## How Presigned URLs Work

Presigned URLs allow temporary, secure access to specific files in your R2 bucket without exposing your API credentials. This implementation follows the Cloudflare documentation at https://developers.cloudflare.com/r2/api/s3/presigned-urls/

The process works as follows:

1. The application uses the `aws4fetch` library to generate a presigned URL
2. The URL includes a signature based on your access credentials
3. The URL has a limited validity period (1 hour in our implementation)
4. Users can directly access the file using the presigned URL without needing API credentials

### Workflow

When a user requests to view an attachment:

1. They click on the attachment icon in the transaction table
2. The application routes the request through `/transactions/:id/attachment/:attachmentId`
3. The server verifies the transaction and attachment exist
4. The `AttachmentService` generates a presigned URL for the file
5. The user is redirected to this URL, which allows them to view or download the file directly

## Implementation Details

### Database Schema

The attachments table is defined as:

```sql
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### Key Files

1. **AttachmentService**: `/app/services/attachmentService.ts`

   - Handles file uploads to R2
   - Generates presigned URLs
   - Manages attachment metadata in the database

2. **Attachment Route**: `/app/routes/transactions.$id.attachment.$attachmentId.tsx`

   - Handles routing users to the presigned URL
   - Validates that the user has access to the requested attachment

3. **Transaction UI**: `/app/components/TransactionTableRow.tsx`
   - Provides UI for uploading and viewing attachments
   - Displays attachment icons for transactions with attachments

### Presigned URL Generation

The core of the presigned URL generation happens in the `getAttachmentUrl` method of the `AttachmentService`:

```typescript
// Create a presigned URL (valid for 1 hour)
const url = new URL(
  `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com`
);

// Set the path to the object key
url.pathname = `/${attachment.r2_key}`;

// Set expiry to 1 hour (3600 seconds)
url.searchParams.set("X-Amz-Expires", "3600");

// Sign the request
const signed = await this.awsClient.sign(
  new Request(url, {
    method: "GET",
  }),
  {
    aws: { signQuery: true },
  }
);

return {
  success: true,
  url: signed.url,
};
```

For uploading and deleting files, we also use the AWS client to create signed requests:

```typescript
// For uploads (PUT request)
const signedRequest = await this.awsClient.sign(
  new Request(url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "Content-Length": file.size.toString(),
    },
    body: arrayBuffer,
  })
);

// For deletions (DELETE request)
const signedRequest = await this.awsClient.sign(
  new Request(url, {
    method: "DELETE",
  })
);
```

## Security Considerations

- Presigned URLs are valid for a limited time only (1 hour)
- The application verifies that users only access attachments from transactions they should have access to
- R2 API credentials are never exposed to the client
- The file storage path includes the transaction ID, providing logical segmentation
- Keep your R2 API credentials secure and never commit them to version control

## Local Development

For local development, you can configure the application to use the direct R2 URL if presigned URL generation isn't set up yet. The service includes a fallback mechanism.

## Troubleshooting

If attachments don't work:

1. Check that the R2 credentials are properly configured in your environment
2. Verify that the R2 bucket exists and is correctly bound to your worker
3. Check that the aws4fetch library is installed
4. Look for errors in the server logs when generating presigned URLs
