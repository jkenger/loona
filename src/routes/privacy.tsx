import { createFileRoute } from '@tanstack/react-router'
import { CaretLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1" onClick={() => window.history.back()}>
          <CaretLeft className="h-4 w-4" />
          Back
        </Button>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Privacy Policy</h1>
          <p className="lead">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <p>
            Loona ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our loan management application.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Personal Information</h3>
          <p>We collect information you provide directly to us, including:</p>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, and password when you create an account</li>
            <li><strong>Contact Information:</strong> Names, phone numbers, email addresses, and addresses of borrowers you add to the system</li>
            <li><strong>Financial Information:</strong> Loan details, payment records, interest rates, and transaction history</li>
          </ul>

          <h3>Automatically Collected Information</h3>
          <p>When you use Loona, we automatically collect:</p>
          <ul>
            <li>IP address and device information</li>
            <li>Browser type and version</li>
            <li>Usage data and activity logs</li>
            <li>Session information</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and manage loan records</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Monitor and analyze trends, usage, and activities</li>
            <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
          </ul>

          <h2>3. Data Storage and Security</h2>
          <p>
            Your data is stored securely using industry-standard encryption. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </p>
          <p>
            We use secure database hosting with encrypted connections. Passwords are hashed using industry-standard algorithms and are never stored in plain text.
          </p>

          <h2>4. Data Sharing and Disclosure</h2>
          <p>We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:</p>
          <ul>
            <li><strong>With your consent:</strong> When you explicitly authorize us to share your information</li>
            <li><strong>Service providers:</strong> With trusted third-party services that help us operate our platform (hosting, analytics)</li>
            <li><strong>Legal requirements:</strong> When required by law, court order, or government regulation</li>
            <li><strong>Protection of rights:</strong> To protect our rights, privacy, safety, or property</li>
          </ul>

          <h2>5. Your Rights Under the Data Privacy Act (RA 10173)</h2>
          <p>Under Philippine law, you have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request access to your personal data</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
            <li><strong>Erasure:</strong> Request deletion of your personal data</li>
            <li><strong>Object:</strong> Object to the processing of your personal data</li>
            <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
            <li><strong>Withdraw Consent:</strong> Withdraw your consent at any time</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us using the information provided below.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is active or as needed to provide you services. We will retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.
          </p>

          <h2>7. Cookies and Tracking</h2>
          <p>
            We use essential cookies to maintain your session and remember your preferences. These cookies are necessary for the application to function properly.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            Loona is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <ul>
            <li>Email: privacy@loona.ph</li>
          </ul>

          <hr />

          <p className="text-sm text-muted-foreground">
            This application is provided as a tool for personal loan management. Users are responsible for ensuring their use of this tool complies with all applicable laws and regulations, including the Data Privacy Act of 2012 (RA 10173).
          </p>
        </article>
      </div>
    </div>
  )
}
