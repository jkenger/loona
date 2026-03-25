import { createFileRoute } from '@tanstack/react-router'
import {
  sendEmail,
  lenderPaymentReceivedEmail,
  lenderDocumentSignedEmail,
  lenderPenaltyAppliedEmail,
  lenderDailySummaryEmail,
} from '@/lib/email'

export const Route = createFileRoute('/api/test-emails')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const to = url.searchParams.get('to')
        const type = url.searchParams.get('type') // payment, completed, document, penalty, summary, all

        if (!to) {
          return new Response(
            JSON.stringify({ error: 'Missing ?to=email@example.com' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
          return new Response(
            JSON.stringify({ error: 'Test endpoint disabled in production' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const sent: string[] = []

        // 1. Payment Received
        if (!type || type === 'all' || type === 'payment') {
          const email = lenderPaymentReceivedEmail({
            lenderName: 'Juan Lender',
            borrowerName: 'Maria Borrower',
            amount: '5,000.00',
            method: 'GCash',
            remainingBalance: '15,000.00',
            loanReference: 'A1B2C3D4',
            isCompleted: false,
            isAgent: true,
            agentName: 'Pedro Agent',
          })
          await sendEmail({ to, ...email })
          sent.push('payment')
        }

        // 2. Loan Fully Paid
        if (!type || type === 'all' || type === 'completed') {
          const email = lenderPaymentReceivedEmail({
            lenderName: 'Juan Lender',
            borrowerName: 'Maria Borrower',
            amount: '5,000.00',
            method: 'Bank Transfer',
            remainingBalance: '0.00',
            loanReference: 'A1B2C3D4',
            isCompleted: true,
            isAgent: false,
          })
          await sendEmail({ to, ...email })
          sent.push('completed')
        }

        // 3. Document Signed
        if (!type || type === 'all' || type === 'document') {
          const email = lenderDocumentSignedEmail({
            lenderName: 'Juan Lender',
            signerName: 'Maria Borrower',
            signerRole: 'Borrower',
            documentType: 'disclosure',
            loanReference: 'A1B2C3D4',
            dashboardUrl: `${url.origin}/loans/test-loan-id`,
          })
          await sendEmail({ to, ...email })
          sent.push('document')
        }

        // 4. Penalty Applied
        if (!type || type === 'all' || type === 'penalty') {
          const email = lenderPenaltyAppliedEmail({
            lenderName: 'Juan Lender',
            borrowerName: 'Maria Borrower',
            penaltyType: 'late_fee',
            amount: '250.00',
            loanReference: 'A1B2C3D4',
            daysOverdue: 5,
          })
          await sendEmail({ to, ...email })
          sent.push('penalty')
        }

        // 5. Daily Summary (includes missed payment escalation)
        if (!type || type === 'all' || type === 'summary') {
          const email = lenderDailySummaryEmail({
            lenderName: 'Juan Lender',
            date: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
            collectionsToday: '₱12,500.00',
            loansCompleted: 1,
            upcomingDueCount: 8,
            overdueCount: 3,
            totalOutstanding: '₱245,000.00',
            missedPaymentBorrowers: [
              { name: 'Maria Borrower', consecutiveMissed: 3, loanReference: 'A1B2C3D4' },
              { name: 'Pedro Santos', consecutiveMissed: 2, loanReference: 'E5F6G7H8' },
            ],
            dashboardUrl: `${url.origin}/dashboard`,
          })
          await sendEmail({ to, ...email })
          sent.push('summary')
        }

        return new Response(
          JSON.stringify({ success: true, sent, to }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
