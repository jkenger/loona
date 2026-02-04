import { createFileRoute, Link } from '@tanstack/react-router'
import { CaretLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/login">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
            <CaretLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Terms of Service</h1>
          <p className="lead">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <p>
            Please read these Terms of Service ("Terms") carefully before using Loona ("the Service"), a loan management application operated by Loona ("we", "our", or "us").
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Loona, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Loona is a <strong>loan management tool</strong> designed to help users track and manage personal lending activities. The Service provides:
          </p>
          <ul>
            <li>Loan record-keeping and tracking</li>
            <li>Payment scheduling and monitoring</li>
            <li>Contact management for borrowers</li>
            <li>Commission tracking for collection agents</li>
            <li>Reporting and analytics</li>
          </ul>

          <h2>3. Important Disclaimer</h2>
          <div className="bg-muted p-4 rounded-lg not-prose mb-4">
            <p className="font-semibold text-foreground mb-2">Loona is NOT a Lending Company</p>
            <p className="text-sm text-muted-foreground">
              Loona is a software tool for record-keeping purposes only. We do not provide loans, extend credit, make lending decisions, or act as a financial intermediary. Users engaging in lending activities are solely responsible for compliance with all applicable laws and regulations.
            </p>
          </div>

          <h2>4. User Responsibilities</h2>
          <p>As a user of Loona, you agree to:</p>
          <ul>
            <li><strong>Provide accurate information:</strong> All data you enter must be truthful and accurate</li>
            <li><strong>Maintain account security:</strong> Keep your login credentials confidential</li>
            <li><strong>Comply with laws:</strong> Use the Service in compliance with all applicable laws and regulations</li>
            <li><strong>Respect privacy:</strong> Only store personal data of individuals who have consented to such storage</li>
            <li><strong>Not misuse the Service:</strong> Not use Loona for illegal activities, harassment, or any unlawful purpose</li>
          </ul>

          <h2>5. Legal Compliance</h2>
          <p>
            Users who engage in lending activities are responsible for ensuring compliance with applicable Philippine laws, including but not limited to:
          </p>
          <ul>
            <li><strong>Lending Company Regulation Act (RA 9474):</strong> If your lending activities require SEC registration</li>
            <li><strong>Truth in Lending Act (RA 3765):</strong> Disclosure requirements for loan terms</li>
            <li><strong>Data Privacy Act of 2012 (RA 10173):</strong> Protection of borrower personal information</li>
            <li><strong>BSP Circular 1133:</strong> Interest rate disclosure requirements</li>
          </ul>
          <p>
            Loona does not provide legal or financial advice. We recommend consulting with appropriate legal and financial professionals regarding your lending activities.
          </p>

          <h2>6. Account Terms</h2>
          <ul>
            <li>You must be at least 18 years old to use this Service</li>
            <li>You are responsible for all activities that occur under your account</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
          </ul>

          <h2>7. Data and Privacy</h2>
          <p>
            Your use of Loona is also governed by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which describes how we collect, use, and protect your information.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are owned by Loona and are protected by international copyright, trademark, and other intellectual property laws.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law:
          </p>
          <ul>
            <li>Loona is provided "as is" without warranties of any kind</li>
            <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
            <li>We are not responsible for any decisions made based on data stored in the Service</li>
            <li>We are not liable for data loss, though we take reasonable measures to prevent it</li>
          </ul>

          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Loona and its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.
          </p>

          <h2>11. Service Modifications</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may also modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the modified Terms.
          </p>

          <h2>12. Beta Service</h2>
          <p>
            Loona is currently in beta. This means:
          </p>
          <ul>
            <li>The Service may contain bugs or errors</li>
            <li>Features may change without notice</li>
            <li>We appreciate your feedback to help improve the Service</li>
            <li>Data backup is recommended as an additional precaution</li>
          </ul>

          <h2>13. Termination</h2>
          <p>
            You may terminate your account at any time by contacting us. We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
          </p>

          <h2>14. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines, without regard to its conflict of law provisions.
          </p>

          <h2>15. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <ul>
            <li>Email: support@loona.app</li>
          </ul>

          <hr />

          <p className="text-sm text-muted-foreground">
            By using Loona, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </article>
      </div>
    </div>
  )
}
