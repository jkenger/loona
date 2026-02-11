import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL as string)

async function main() {
  console.log('Backfilling interest_earned for existing loans...')

  const result = await sql`
    UPDATE loans
    SET interest_earned = (
      amount_paid::numeric * (total_to_repay::numeric - principal::numeric) / total_to_repay::numeric
    )::numeric(12,2)
    WHERE total_to_repay::numeric > 0
      AND total_to_repay::numeric > principal::numeric
      AND amount_paid::numeric > 0
  `

  console.log('Done!', result)
}

main().catch(console.error)
