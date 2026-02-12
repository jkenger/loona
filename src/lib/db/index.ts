import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { validateEnv } from "../env"
import * as schema from "./schema"

// Guard: only initialize on the server — this module can leak into
// the client bundle via server-function imports that Vite doesn't fully tree-shake.
let db: ReturnType<typeof drizzle<typeof schema>>

if (typeof window === "undefined") {
  validateEnv()
  const sql = neon(process.env.DATABASE_URL!)
  db = drizzle(sql, { schema })
}

export { db }
export * from "./schema"
