import { LegalShell } from "../legal/legal";

export const metadata = { title: "Terms of Use · SIWES Logbook Assistant" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use" updated="21 July 2026">
      <p>
        By using the SIWES Logbook Assistant (&ldquo;the app&rdquo;), you agree
        to these terms. If you do not agree, please do not use the app.
      </p>

      <h2>1. What the app does</h2>
      <p>
        The app helps students on the Student Industrial Work Experience Scheme
        (SIWES) turn daily notes into professional logbook entries, weekly and
        monthly summaries, and a final report. It is a study aid — you are
        responsible for reviewing every entry before submitting it to your
        institution or supervisor.
      </p>

      <h2>2. Your account and access</h2>
      <p>
        Access is granted through a free trial, a one-time paid plan (Basic or
        Pro), or invited free access. Access is tied to the browser you use.
        Payment is processed by Flutterwave; paying unlocks the plan you
        selected for the duration described at purchase.
      </p>

      <h2>3. Your own AI key</h2>
      <p>
        The app runs on your own free Google Gemini API key, which you provide.
        You are responsible for keeping your key secure and for complying with
        Google&rsquo;s terms for that key. The app never charges you for AI
        usage — that is governed by your Google account.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        Use the app only for your own legitimate SIWES record-keeping. Do not
        use it to create false, misleading, or fraudulent records, and do not
        attempt to break, overload, or gain unauthorised access to the service.
      </p>

      <h2>5. Payments and refunds</h2>
      <p>
        Plan prices are shown before payment. Because access is granted
        immediately, payments are generally non-refundable except where required
        by law. If a payment fails to unlock access, contact us and we will fix
        it or refund you.
      </p>

      <h2>6. Availability</h2>
      <p>
        The app depends on third-party services (Google Gemini, Flutterwave,
        hosting). It may occasionally be unavailable or interrupted. We do not
        guarantee uninterrupted access and are not liable for AI outages or
        errors in generated text.
      </p>

      <h2>7. Your content</h2>
      <p>
        Your logbook entries, notes, and profile are stored in your own
        browser, not on our servers. You own your content. You are responsible
        for backing it up (for example, by printing or saving as PDF).
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        The app is provided &ldquo;as is&rdquo; without warranties of any kind.
        To the maximum extent permitted by law, we are not liable for any loss
        arising from your use of the app, including lost entries, inaccurate
        AI output, or missed submissions.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. Continued use after an update means you
        accept the revised terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:olivesbooks1@gmail.com">olivesbooks1@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
