import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    host: process.env.SQL_HOST || "localhost",
    user: process.env.SQL_USER || "postgres",
    password: process.env.SQL_PASSWORD || "",
    database: process.env.SQL_DB_NAME || "yuddit_db",
    ssl: false,
  },
});
