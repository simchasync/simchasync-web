import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const UPDATED = "June 20, 2026";
const CONTACT = "simchasync@gmail.com";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>

        <h1 className="font-display text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Who we are</h2>
            <p className="text-muted-foreground">
              SimchaSync ("we", "us") provides booking and event-management
              software for simcha and event professionals. This policy explains
              what information we collect, how we use it, and the choices you
              have.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Information we collect</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Account details you provide (name, email, phone, workspace info).</li>
              <li>Event, client, invoice, and booking data you enter into the app.</li>
              <li>
                Usage and device information needed to operate and secure the
                service.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">How we use information</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>To provide, maintain, and improve the service.</li>
              <li>To process payments and send transactional notifications.</li>
              <li>To provide customer support and keep the service secure.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Google Calendar integration</h2>
            <p className="text-muted-foreground">
              If you choose to connect your Google account, SimchaSync requests
              access to the Google Calendar events scope
              (<code>https://www.googleapis.com/auth/calendar.events</code>) for
              the sole purpose of creating, updating, and deleting your
              workspace's events in your Google Calendar. We do not read your
              personal Google Calendar events.
            </p>
            <p className="text-muted-foreground">
              SimchaSync's use and transfer of information received from Google
              APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We use Google user data
              only to provide and improve the calendar-sync feature; we do not
              sell it, use it for advertising, or allow humans to read it except
              where you give consent, where required for security, or to comply
              with applicable law.
            </p>
            <p className="text-muted-foreground">
              You can disconnect at any time from Settings, or revoke access at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google Account permissions
              </a>
              . Disconnecting deletes the stored Google authorization tokens.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Data sharing</h2>
            <p className="text-muted-foreground">
              We do not sell your data. We share information only with service
              providers that help us run the service (for example, hosting,
              database, payment processing, and email delivery), bound by
              confidentiality obligations, or where required by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Data retention &amp; security</h2>
            <p className="text-muted-foreground">
              We retain your data for as long as your account is active or as
              needed to provide the service, and apply reasonable technical and
              organizational measures to protect it. Authorization tokens are
              stored securely and are never exposed to the browser.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Your choices</h2>
            <p className="text-muted-foreground">
              You may access, correct, or delete your data, and disconnect
              integrations, from within the app. To request account deletion or
              ask a privacy question, contact us at{" "}
              <a href={`mailto:${CONTACT}`} className="text-primary underline">
                {CONTACT}
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Changes to this policy</h2>
            <p className="text-muted-foreground">
              We may update this policy from time to time. Material changes will
              be reflected by updating the "Last updated" date above.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              Questions? Email{" "}
              <a href={`mailto:${CONTACT}`} className="text-primary underline">
                {CONTACT}
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          See also our{" "}
          <Link to="/terms" className="text-primary underline">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
