import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
  Link,
  Hr,
  Preview,
} from "@react-email/components"

interface PaymentReceiptProps {
  borrowerName: string
  lenderName: string
  amount: string
  method: string
  paidAt: string
  remainingBalance: string
  loanReference: string
  loanPortalUrl?: string
}

export function PaymentReceiptTemplate({
  borrowerName,
  lenderName,
  amount,
  method,
  paidAt,
  remainingBalance,
  loanReference,
  loanPortalUrl,
}: PaymentReceiptProps) {
  const isFullyPaid = parseFloat(remainingBalance) <= 0

  return (
    <Html>
      <Head />
      <Preview>Payment of ₱{amount} received{isFullyPaid ? " — Loan fully paid!" : ` — ₱${remainingBalance} remaining`}</Preview>
      <Body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", lineHeight: "1.6", color: "#1a1a1a", margin: "0", padding: "0", backgroundColor: "#ffffff" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>

        {/* Brand */}
        <Section style={{ textAlign: "center", marginBottom: "32px" }}>
          <Text style={{ color: "#1a8cff", margin: "0", fontSize: "28px", fontWeight: "700" }}>Loona</Text>
        </Section>

        {/* Title */}
        <Text style={{ color: "#1a1a1a", fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Payment Received</Text>
        <Text style={{ margin: "0 0 4px" }}>Hi {borrowerName},</Text>
        <Text style={{ margin: "0 0 24px" }}>
          A payment of <strong>₱{amount}</strong> has been received. Here are the details:
        </Text>

        {/* Details table */}
        <Section style={{ backgroundColor: "#f9fafb", borderRadius: "12px", padding: "24px", margin: "0 0 24px" }}>
          <Row>
            <Column style={{ padding: "8px 0", color: "#555", fontSize: "14px" }}>Amount Paid</Column>
            <Column style={{ padding: "8px 0", fontWeight: "700", fontSize: "18px", color: "#16a34a", textAlign: "right" as const }}>₱{amount}</Column>
          </Row>
          <Hr style={{ borderColor: "#e5e7eb", margin: "0" }} />
          <Row>
            <Column style={{ padding: "8px 0", color: "#555", fontSize: "14px" }}>Payment Method</Column>
            <Column style={{ padding: "8px 0", fontWeight: "500", textAlign: "right" as const }}>{method}</Column>
          </Row>
          <Hr style={{ borderColor: "#e5e7eb", margin: "0" }} />
          <Row>
            <Column style={{ padding: "8px 0", color: "#555", fontSize: "14px" }}>Date</Column>
            <Column style={{ padding: "8px 0", fontWeight: "500", textAlign: "right" as const }}>{paidAt}</Column>
          </Row>
          <Hr style={{ borderColor: "#e5e7eb", margin: "0" }} />
          <Row>
            <Column style={{ padding: "8px 0", color: "#555", fontSize: "14px" }}>Loan Reference</Column>
            <Column style={{ padding: "8px 0", fontWeight: "500", textAlign: "right" as const }}>{loanReference}</Column>
          </Row>
          <Hr style={{ borderColor: "#e5e7eb", margin: "0" }} />
          <Row>
            <Column style={{ padding: "8px 0", color: "#555", fontSize: "14px" }}>Remaining Balance</Column>
            <Column style={{ padding: "8px 0", fontWeight: "700", textAlign: "right" as const, color: isFullyPaid ? "#16a34a" : "#1a1a1a" }}>
              {isFullyPaid ? "FULLY PAID" : `₱${remainingBalance}`}
            </Column>
          </Row>
        </Section>

        {/* Loan portal CTA */}
        {loanPortalUrl && (
          <Section style={{ textAlign: "center", margin: "0 0 24px" }}>
            <Link
              href={loanPortalUrl}
              style={{ display: "inline-block", backgroundColor: "#1a8cff", color: "#ffffff", padding: "12px 32px", borderRadius: "8px", textDecoration: "none", fontWeight: "600", fontSize: "14px" }}
            >
              View Your Loan
            </Link>
            <Text style={{ color: "#999", fontSize: "12px", marginTop: "8px" }}>Check your balance, schedule, and payment history.</Text>
          </Section>
        )}

        {/* Fully paid banner */}
        {isFullyPaid && (
          <Section style={{ backgroundColor: "#f0fdf4", border: "2px solid #16a34a", borderRadius: "12px", padding: "16px", textAlign: "center", margin: "0 0 24px" }}>
            <Text style={{ margin: "0", color: "#15803d", fontWeight: "600" }}>Congratulations! Your loan has been fully paid. 🎉</Text>
          </Section>
        )}

        {/* Issued by */}
        <Text style={{ color: "#555", fontSize: "14px" }}>This receipt was issued by <strong>{lenderName}</strong> via Loona.</Text>

        <Hr style={{ border: "none", borderTop: "1px solid #eee", margin: "32px 0" }} />
        <Text style={{ color: "#999", fontSize: "12px", textAlign: "center" }}>Loona — Loan Management</Text>
        </Container>
      </Body>
    </Html>
  )
}
