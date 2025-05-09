import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("./routes/_index.tsx"),
  route("/batches", "./routes/batches.tsx"),
  route("/batches/import", "./routes/batches.import.tsx"),
  route("/batches/:id", "./routes/batches.$id.tsx"),
  route("/owners", "./routes/owners.tsx"),
  route("/owners/:id", "./routes/owners.$id.tsx"),
  route("/owners/:id/edit", "./routes/owners.$id.edit.tsx"),
  route("/owners/:id/patterns", "./routes/owners.$id.patterns.tsx"),
  route("/transactions", "./routes/transactions.tsx"),
  route("/transactions/:id", "./routes/transactions.$id.tsx"),
] satisfies RouteConfig;
