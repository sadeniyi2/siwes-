import { LegalShell } from "../legal/legal";

export const metadata = { title: "Privacy Policy · SIWES Logbook Assistant" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="21 July 2026">
      <p>
        This policy explains what the SIWES Logbook Assistant does with your
        information. In short: <strong>your data stays on your own device</strong>,
        and we do not run a database of your logbook.
      </p>

      <h2>1. What we store, and where</h2>
      <p>
        Your profile (name, institution, firm, etc.), your logbook entries, your
        chat history, your Gemini API key, and your access token are stored{" "}
        <strong>only in your browser&rsquo;s local storage</strong>. They are not
        uploaded to or kept on our servers, and we cannot see them. Clearing your
        browser data removes them.
      </p>

      <h2>2. What is sent, and to whom</h2>
      <ul>
        <li>
          <strong>Google Gemini:</strong> when you ask the assistant to write an
          entry, your notes and saved entries are sent to Google&rsquo;s Gemini
          API using your own key, so it can generate the response. This is
          governed by Google&rsquo;s privacy policy.
        </li>
        <li>
          <strong>Flutterwave:</strong> if you pay, your name, email, and payment
          details go directly to Flutterwave to process the transaction. We do
          not receive or store your card details.
        </li>
      </ul>

      <h2>3. What we do not do</h2>
      <p>
        We do not sell your data, show you ads, or track you across other sites.
        We do not store your logbook content, your notes, or your API key on our
        servers.
      </p>

      <h2>4. Payment verification</h2>
      <p>
        When you pay, our server confirms the transaction with Flutterwave and
        issues a signed access token that is stored in your browser. We keep only
        what is needed to confirm a valid payment; we do not store card numbers.
      </p>

      <h2>5. Your email</h2>
      <p>
        If you enter an email at checkout, it is used only to send your payment
        receipt (by Flutterwave) and to help with support if you contact us.
      </p>

      <h2>6. Children</h2>
      <p>
        The app is intended for university and higher-institution students on
        SIWES placements. It is not directed at children under 13.
      </p>

      <h2>7. Your control</h2>
      <p>
        Because everything is stored locally, you are in control: you can edit or
        delete entries in the app, remove your saved key from the key panel, or
        clear your browser storage to erase everything.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update this policy. The &ldquo;last updated&rdquo; date above shows
        the latest version.
      </p>

      <h2>9. Contact</h2>
      <p>
        Privacy questions? Email{" "}
        <a href="mailto:olivesbooks1@gmail.com">olivesbooks1@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
