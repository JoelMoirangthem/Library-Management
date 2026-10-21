import { LegalPage } from '@/components/landing/LegalPage'
import { useTitle } from '@/hooks/useTitle'

export default function Terms() {
  useTitle('Terms of use')
  return (
    <LegalPage
      title="Terms of use"
      lastUpdated="17 Oct 2026"
      intro={
        <p className="leading-relaxed">
          These terms cover how you use NearMe Library. By signing in you agree to them. NearMe Library
          is a tool that lists study libraries and helps owners manage seats, students and
          fees. We are not a party to the arrangement between a student and a library.
        </p>
      }
    >
      <section>
        <h2>Accounts and roles</h2>
        <p>
          You sign in with Google and choose once whether you are a student or an owner. This
          choice is permanent and cannot be changed from the app. Keep your details accurate so
          libraries and students can reach you.
        </p>
      </section>

      <section>
        <h2>For owners</h2>
        <ul>
          <li>You may list one library. The details you enter must be true and your own.</li>
          <li>A new library is reviewed by an admin, usually within 24 hours, before it goes live.</li>
          <li>You are responsible for the student names, phone numbers and fee records you enter, and for having the right to store them.</li>
          <li>You set and collect your own monthly fee from students directly. NearMe Library does not handle that money.</li>
        </ul>
      </section>

      <section>
        <h2>The plan</h2>
        <ul>
          <li>Every approved library gets 14 days free, starting on first approval. Re-approval never resets the trial.</li>
          <li>After the trial, staying active costs ₹199 per month, paid by UPI and verified by an admin.</li>
          <li>A verified payment adds 30 days. If you renew early, the 30 days stack on top of the days you have left — you never lose time.</li>
          <li>When your plan ends, your library is hidden from search and your dashboard becomes read-only. Nothing is deleted; renew to make changes again.</li>
        </ul>
      </section>

      <section>
        <h2>For students</h2>
        <p>
          Searching libraries and requesting a seat is free. A seat is confirmed only when the
          owner approves your request. Your fee arrangement, timings and rules are between you
          and the library.
        </p>
      </section>

      <section>
        <h2>What we don't promise</h2>
        <p>
          NearMe Library lists libraries but does not guarantee a seat, the accuracy of a library's
          details, or any outcome of studying there. We may remove a listing that breaks these
          terms or that we cannot verify. The service is provided as-is during this pilot.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms as the product grows. We will change the "last updated"
          date above. Continuing to use NearMe Library after a change means you accept it.
        </p>
      </section>
    </LegalPage>
  )
}
