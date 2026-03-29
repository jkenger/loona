import { createFileRoute } from '@tanstack/react-router'
import {
  sendEmail,
  lenderPaymentReceivedEmail,
  lenderDocumentSignedEmail,
  lenderPenaltyAppliedEmail,
  lenderDailySummaryEmail,
  agentCommissionEarnedEmail,
  agentBorrowerOverdueEmail,
  agentWeeklySummaryEmail,
} from '@/lib/email'

export const Route = createFileRoute('/api/test-emails')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const to = url.searchParams.get('to')
        const type = url.searchParams.get('type') // payment, completed, document, penalty, summary, agent-commission, agent-overdue, agent-weekly, all

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

        // 6. Agent: Commission Earned
        if (!type || type === 'all' || type === 'agent-commission') {
          const email = agentCommissionEarnedEmail({
            agentName: 'Pedro Agent',
            borrowerName: 'Maria Borrower',
            lenderName: 'Juan Lender',
            paymentAmount: '5,000.00',
            commissionAmount: '250.00',
            commissionRate: '5.00',
            loanReference: 'A1B2C3D4',
            totalCommissionEarned: '12,750.00',
          })
          await sendEmail({ to, ...email })
          sent.push('agent-commission')
        }

        // 7. Agent: Borrower Overdue Alert
        if (!type || type === 'all' || type === 'agent-overdue') {
          const email = agentBorrowerOverdueEmail({
            agentName: 'Pedro Agent',
            borrowerName: 'Maria Borrower',
            borrowerPhone: '09171234567',
            lenderName: 'Juan Lender',
            dueDate: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
            amountDue: '5,000.00',
            loanReference: 'A1B2C3D4',
            daysOverdue: 3,
          })
          await sendEmail({ to, ...email })
          sent.push('agent-overdue')
        }

        // 8. Agent: Weekly Summary
        if (!type || type === 'all' || type === 'agent-weekly') {
          const email = agentWeeklySummaryEmail({
            agentName: 'Pedro Agent',
            lenderName: 'Juan Lender',
            weekLabel: 'Mar 20 – Mar 26, 2026',
            totalCollected: '32,500.00',
            paymentCount: 14,
            commissionEarned: '1,625.00',
            overdueCount: 2,
            assignedLoansCount: 18,
            topBorrowers: [
              { name: 'Maria Borrower', amount: '10,000.00' },
              { name: 'Pedro Santos', amount: '7,500.00' },
              { name: 'Ana Reyes', amount: '5,000.00' },
            ],
          })
          await sendEmail({ to, ...email })
          sent.push('agent-weekly')
        }

        return new Response(
          JSON.stringify({ success: true, sent, to }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
