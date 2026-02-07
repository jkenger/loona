import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { validateEnv } from "../env"
import * as schema from "./schema"

validateEnv()

const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { schema })

export * from "./schema"
