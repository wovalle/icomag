import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("./routes/_index.tsx"),
  route("/tags", "./routes/tags.tsx"),
  route("/tags/:id", "./routes/tags.$id.tsx"),
  route("/tags/:id/patterns", "./routes/tags.$id.patterns.tsx"),
  route("/batches", "./routes/batches.tsx"),
  route("/batches/import", "./routes/batches.import.tsx"),
  route("/batches/:id", "./routes/batches.$id.tsx"),
  route("/owners", "./routes/owners.tsx"),
  route("/owners/:id", "./routes/owners.$id.tsx"),
  route("/owners/:id/patterns", "./routes/owners.$id.patterns.tsx"),
  route("/transactions", "./routes/transactions.tsx"),
  route("/transactions/:id", "./routes/transactions.$id.tsx"),
  route(
    "/transactions/:id/attachment/:attachmentId",
    "./routes/transactions.$id.attachment.$attachmentId.tsx"
  ),
  route("/attachment/:id", "./routes/attachment.$id.tsx"),
  route("/lpg", "./routes/lpg.tsx"),
  route("/lpg/new", "./routes/lpg.new.tsx"),
  route("/lpg/:id", "./routes/lpg.$id.tsx"),
  route("/balance", "./routes/balance.tsx"),
  route("/audit-logs", "./routes/audit-logs.tsx"),
  route("/auth/signin", "./routes/auth.signin.tsx"),
  route("/api/auth/*", "./routes/api.auth.$.ts"),
] satisfies RouteConfig;
