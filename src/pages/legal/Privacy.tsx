import { LegalPage } from '@/components/landing/LegalPage'
import { useTitle } from '@/hooks/useTitle'

export default function Privacy() {
  useTitle('Privacy policy')
  return (
    <LegalPage
      title="Privacy policy"
      lastUpdated="17 Oct 2026"
      intro={
        <p className="leading-relaxed">
          NearMe Library is a marketplace that connects students with study libraries in India.
          This page explains what we collect, who can see it, and how long we keep it. We ask
          for only what the service needs to work.
        </p>
      }
    >
      <section>
        <h2>What we collect</h2>
        <p>Depending on how you use NearMe Library, we store:</p>
        <ul>
          <li>Your name, email and phone number when you sign in.</li>
          <li>For owners: your library's details — name, address, pincode, landmark, timings, monthly fee, seat count, amenities and photos.</li>
          <li>For owners: the student names and phone numbers you enter to manage your members, along with their start dates, expiry dates and fee records.</li>
          <li>For students: the seat requests you send and the memberships you hold.</li>
          <li>Plan payments: the UPI reference (UTR) you submit and its verification status.</li>
        </ul>
        <p>
          Student names and phone numbers inside a library are entered by the library owner to
          run their own records. If you are a student added by a library, ask that library to
          update or remove your details.
        </p>
      </section>

      <section>
        <h2>Who sees what</h2>
        <ul>
          <li>Students searching the site see a library's public details and how many seats are free — never the owner's private student list or fee records.</li>
          <li>An owner sees only their own library, students and fees.</li>
          <li>When you send a seat request, the owner of that library sees your name and phone number so they can contact you.</li>
          <li>Admins see libraries and plan payments in order to approve libraries and verify payments. Admins do not browse a library's private student list for any other reason.</li>
        </ul>
      </section>

      <section>
        <h2>Payments</h2>
        <p>
          Owners get a 14-day free trial that starts when the library is first approved. After
          that, staying active costs ₹199 per month, paid by UPI. An admin verifies each
          payment by hand before the month is added. We store the UPI reference you submit and
          whether it was verified or failed; we do not store card numbers or bank login details.
        </p>
        <p>
          Students pay their monthly fee directly to the library, in person. NearMe Library does not
          process student fees and never holds that money.
        </p>
      </section>

      <section>
        <h2>How long we keep data</h2>
        <p>
          Money and membership records are kept and are never hard-deleted. When an owner
          removes a student, the record is marked removed and the seat is freed, but the
          history stays for the owner's accounts. Voided fees are kept with their reason. This
          protects owners if a payment is ever disputed.
        </p>
        <p>
          If your plan expires, nothing is deleted — your library is simply hidden from search
          and your dashboard becomes read-only until you renew.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can update your name and phone number from your profile. To ask about the data
          we hold or to request a correction, write to us using the email below. Because some
          records are kept for accounting, we may keep money and membership history even after
          a request.
        </p>
      </section>
    </LegalPage>
  )
}
