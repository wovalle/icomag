import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import {
  createRequestHandler
} from "react-router";
import {
  RepositoryFactory,
  createRepositoryFactory,
} from "../app/repositories/RepositoryFactory";
import { AttachmentService } from "../app/services/attachmentService";
import * as schema from "../database/schema";

interface Env extends Cloudflare.Env {
  R2: R2Bucket;
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    db: DrizzleD1Database<typeof schema>;
    dbRepository: RepositoryFactory;
    attachmentService: AttachmentService;
  }
}

// List of admin emails
const ADMIN_EMAILS = ["hey@willy.im", "eliascaseres@gmail.com"];

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const db = drizzle(env.DB, { schema });
    const dbRepository = createRepositoryFactory(db);

    const attachmentService = new AttachmentService(db, {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      accountId: env.R2_ACCOUNT_ID,
      bucketName: "icona",
    });

    return requestHandler(request, {
      cloudflare: { env, ctx },
      db,
      dbRepository,
      attachmentService,
    });
  },
} satisfies ExportedHandler<Env>;
