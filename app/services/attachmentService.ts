// /app/services/attachmentService.ts
import { AwsClient } from "aws4fetch";
import { eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";
import { attachments } from "../../database/schema";
import type { Attachment } from "../types";

export type DB = DrizzleD1Database<typeof schema>;

/**
 * Attachment Service
 *
 * Handles file operations with R2 bucket and metadata in the database
 */
export class AttachmentService {
  private db: DB;
  private awsClient: AwsClient;
  private accountId: string;
  private bucketName: string;
  private nodeEnv: string;

  constructor(
    db: DB,
    r2Config: {
      accessKeyId: string;
      secretAccessKey: string;
      accountId: string;
      bucketName: string;
    },
    nodeEnv: string
  ) {
    this.db = db;

    if (
      !r2Config.accessKeyId ||
      !r2Config.secretAccessKey ||
      !r2Config.accountId ||
      !r2Config.bucketName
    ) {
      throw new Error("Missing required R2 configuration");
    }

    this.accountId = r2Config.accountId;
    this.bucketName = r2Config.bucketName;

    this.awsClient = new AwsClient({
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
      service: "s3",
    });

    this.nodeEnv = nodeEnv;
  }

  /**
   * Get all attachments for a transaction
   */
  async getAttachmentsForTransaction(
    transactionId: number
  ): Promise<{ success: boolean; attachments?: Attachment[]; error?: string }> {
    try {
      const result = await this.db.query.attachments.findMany({
        where: eq(attachments.transaction_id, transactionId),
      });

      return {
        success: true,
        attachments: result,
      };
    } catch (error) {
      console.error("Error fetching attachments:", error);
      return { success: false, error: "Failed to fetch attachments" };
    }
  }

  /**
   * Upload a file to R2 and store metadata in the database
   */
  async uploadAttachment(
    entityId: number,
    file: File,
    entityType: "transaction" | "refill" | "refill_entry" = "transaction"
  ): Promise<{ success: boolean; attachment?: Attachment; error?: string }> {
    try {
      // Generate a unique key for the file in R2
      const timestamp = Date.now();
      const r2Key = `attachments_${this.nodeEnv}/${entityType}s/${timestamp}_${file.name}`;

      // Create the URL for the PUT request
      const url = new URL(
        `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com`
      );
      url.pathname = `/${r2Key}`;

      // Create a signed request
      const arrayBuffer = await file.arrayBuffer();
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

      // Execute the request to upload the file
      const response = await fetch(signedRequest);

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      // Prepare attachment data based on entity type
      const attachmentData: any = {
        filename: file.name,
        r2_key: r2Key,
        size: file.size,
        mime_type: file.type,
      };

      switch (entityType) {
        case "transaction":
          attachmentData.transaction_id = entityId;
          break;
        case "refill":
          attachmentData.refill_id = entityId;
          break;
        case "refill_entry":
          attachmentData.refill_entry_id = entityId;
          break;
      }

      // Store file metadata in the database
      const [attachment] = await this.db
        .insert(attachments)
        .values(attachmentData)
        .returning();

      return {
        success: true,
        attachment,
      };
    } catch (error) {
      console.error("Error uploading attachment:", error);
      return { success: false, error: "Failed to upload attachment" };
    }
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(
    attachmentId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the attachment from the database
      const attachment = await this.db.query.attachments.findFirst({
        where: eq(attachments.id, attachmentId),
      });

      if (!attachment) {
        return { success: false, error: "Attachment not found" };
      }

      // Delete the metadata from the database
      await this.db.delete(attachments).where(eq(attachments.id, attachmentId));

      return { success: true };
    } catch (error) {
      console.error("Error deleting attachment:", error);
      return { success: false, error: "Failed to delete attachment" };
    }
  }

  /**
   * Get a signed URL for an attachment
   */
  async getAttachmentUrl(
    attachmentId: number
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Get the attachment from the database
      const attachment = await this.db.query.attachments.findFirst({
        where: eq(attachments.id, attachmentId),
      });

      if (!attachment) {
        return { success: false, error: "Attachment not found" };
      }

      // Check if the file exists using AWS client
      const checkUrl = new URL(
        `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com`
      );
      checkUrl.pathname = `/${attachment.r2_key}`;

      try {
        const headRequest = await this.awsClient.sign(
          new Request(checkUrl, {
            method: "HEAD",
          })
        );

        const headResponse = await fetch(headRequest);
        if (!headResponse.ok) {
          return { success: false, error: "File not found in storage" };
        }
      } catch (headError) {
        console.error("Error checking if file exists:", headError);
        return { success: false, error: "Failed to check if file exists" };
      }

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
    } catch (error) {
      console.error("Error getting attachment URL:", error);
      return { success: false, error: "Failed to get attachment URL" };
    }
  }

  /**
   * Get all attachments for a refill
   */
  async getAttachmentsForRefill(
    refillId: number
  ): Promise<{ success: boolean; attachments?: Attachment[]; error?: string }> {
    try {
      const result = await this.db.query.attachments.findMany({
        where: eq(attachments.refill_id, refillId),
      });

      return {
        success: true,
        attachments: result,
      };
    } catch (error) {
      console.error("Error fetching refill attachments:", error);
      return { success: false, error: "Failed to fetch refill attachments" };
    }
  }

  /**
   * Get all attachments for a refill entry
   */
  async getAttachmentsForRefillEntry(
    refillEntryId: number
  ): Promise<{ success: boolean; attachments?: Attachment[]; error?: string }> {
    try {
      const result = await this.db.query.attachments.findMany({
        where: eq(attachments.refill_entry_id, refillEntryId),
      });

      return {
        success: true,
        attachments: result,
      };
    } catch (error) {
      console.error("Error fetching refill entry attachments:", error);
      return {
        success: false,
        error: "Failed to fetch refill entry attachments",
      };
    }
  }
}
