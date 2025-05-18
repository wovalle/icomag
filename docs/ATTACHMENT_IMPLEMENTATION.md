# Transaction Attachments Implementation

This document provides a complete overview of the transaction attachments feature implementation.

## Overview

The attachments feature allows users to:

1. Upload file attachments (images, PDFs) to transactions
2. View attachments with secure, time-limited access
3. Delete attachments when they're no longer needed
4. See a visual indicator of transactions with attachments

## Key Components

### Database Schema

A new `attachments` table has been added to store metadata:

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

### Storage

Files are stored in Cloudflare R2, a cloud storage service:

- Files are stored with transaction-specific paths: `transactions/{id}/{timestamp}_{filename}`
- Access to files is secured using presigned URLs
- URLs expire after 1 hour for security

### Service Layer

The `AttachmentService` handles all operations:

- `uploadAttachment`: Upload files to R2 using AWS client and store metadata
- `deleteAttachment`: Remove files from R2 using AWS client and database
- `getAttachmentUrl`: Generate secure, time-limited URLs for viewing files
- `getAttachmentsForTransaction`: Retrieve all attachments for a transaction

All R2 interactions (upload, delete, generate signed URLs) use the AWS client from the `aws4fetch` library to create proper S3-compatible signed requests.

### UI Integration

Attachments are integrated into the UI in several places:

1. **Transaction Table**: Shows attachment icons with links to view files
2. **Transaction Details**: Displays a full list of attachments with view/delete options
3. **Upload UI**: Available in both transaction table actions and the details page

## Security Considerations

- Only authenticated users can view attachments
- Only admin users can upload and delete attachments
- Files are accessible through presigned URLs that expire
- The application verifies that users only access attachments from transactions they should have access to

## Configuration

The R2 bucket and access credentials are configured in `wrangler.jsonc`:

```jsonc
"vars": {
  "R2_ACCOUNT_ID": "your_account_id_here",
  "R2_ACCESS_KEY_ID": "your_access_key_id_here",
  "R2_SECRET_ACCESS_KEY": "your_secret_access_key_here"
},
"r2_buckets": [
  {
    "bucket_name": "icona",
    "binding": "R2"
  }
]
```

## Remaining Tasks

Before deploying to production:

1. Replace placeholder R2 credentials in `wrangler.jsonc` with actual values
2. Run database migrations: `npx wrangler d1 migrate --database-name icomag`
3. Test the feature in staging/dev environments
4. Consider adding error toast notifications for better user feedback

## Implementation Notes

- The attachment system uses the `aws4fetch` library for generating presigned URLs
- Attachment icons visually indicate files with an indexed number when multiple attachments exist
- The delete operation requires confirmation before proceeding
- Upload validation ensures only accepted file types are processed (images and PDFs)
