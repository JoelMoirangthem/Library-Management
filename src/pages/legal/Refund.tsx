import { LegalPage } from '@/components/landing/LegalPage'
import { useTitle } from '@/hooks/useTitle'

export default function Refund() {
  useTitle('Refund policy')
  return (
    <LegalPage
      title="Refund policy"
      lastUpdated="17 Oct 2026"
      intro={
        <p className="leading-relaxed">
          This page explains refunds for the owner plan. In short: the ₹199 monthly plan is
          generally non-refundable once verified, but we always refund a duplicate or
          wrong-amount payment. Student fees are never handled by StudySeat.
        </p>
      }
    >
      <section>
        <h2>The owner plan</h2>
        <p>
          Owners pay ₹199 per month by UPI to keep their library active. You can try everything
          free for 14 days before you pay anything, so you know what you are buying. Once a
          payment is verified and the month is added, it is generally non-refundable.
        </p>
      </section>

      <section>
        <h2>Duplicate or wrong-amount payments</h2>
        <p>
          If you pay twice by mistake, or send an amount other than ₹199, write to us with your
          UPI reference (UTR). We will refund the duplicate or the difference to the UPI account
          you paid from, within 7 working days of your request.
        </p>
      </section>

      <section>
        <h2>Early renewals</h2>
        <p>
          If you renew while you still have days left, the new 30 days stack on top of the time
          you have — you do not lose anything, so there is nothing to refund. Because of this,
          we do not refund a renewal simply because it was made early.
        </p>
      </section>

      <section>
        <h2>Student fees</h2>
        <p>
          Students pay their monthly fee directly to the library, not to StudySeat. We never
          hold that money, so we cannot refund it. Any question about a student fee is between
          the student and the library.
        </p>
      </section>

      <section>
        <h2>How to request a refund</h2>
        <p>
          Email us from the address on your account with your library name, the UPI reference,
          and what went wrong. We will confirm and process eligible refunds within 7 working
          days to the original UPI account.
        </p>
      </section>
    </LegalPage>
  )
}
