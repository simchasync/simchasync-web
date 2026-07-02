import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const UPDATED = "June 20, 2026";
const CONTACT = "simchasync@gmail.com";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <a href="https://simchasync.com">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </a>
        </Button>

        <h1 className="font-display text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">1. Acceptance of terms</h2>
            <p className="text-muted-foreground">
              By creating an account or using SimchaSync ("the service"), you
              agree to these Terms of Service. If you do not agree, do not use
              the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">2. The service</h2>
            <p className="text-muted-foreground">
              SimchaSync provides booking and event-management tools for event
              professionals, including optional integrations such as Google
              Calendar and payment processing. We may add, change, or remove
              features over time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">3. Your account</h2>
            <p className="text-muted-foreground">
              You are responsible for the information you enter, for maintaining
              the confidentiality of your login, and for all activity under your
              account. You must provide accurate information and use the service
              only for lawful purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">4. Integrations</h2>
            <p className="text-muted-foreground">
              When you connect a third-party service (for example, Google
              Calendar or a payment provider), you authorize SimchaSync to
              exchange the data needed to provide that feature. Your use of those
              third-party services is also governed by their own terms. You can
              disconnect an integration at any time from Settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">5. Payments</h2>
            <p className="text-muted-foreground">
              Paid plans and payment processing are handled by our payment
              provider. Fees, billing cycles, and cancellation terms are
              presented at the point of purchase.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">6. Acceptable use</h2>
            <p className="text-muted-foreground">
              You agree not to misuse the service, including attempting to access
              it in an unauthorized way, disrupting it, or using it to store or
              transmit unlawful content.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">7. Disclaimer &amp; liability</h2>
            <p className="text-muted-foreground">
              The service is provided "as is" without warranties of any kind. To
              the maximum extent permitted by law, SimchaSync is not liable for
              indirect, incidental, or consequential damages arising from your
              use of the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">8. Termination</h2>
            <p className="text-muted-foreground">
              You may stop using the service at any time. We may suspend or
              terminate access if these terms are violated or to protect the
              service or its users.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">9. Changes</h2>
            <p className="text-muted-foreground">
              We may update these terms from time to time. Continued use after
              changes take effect constitutes acceptance of the updated terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">10. Contact</h2>
            <p className="text-muted-foreground">
              Questions about these terms? Email{" "}
              <a href={`mailto:${CONTACT}`} className="text-primary underline">
                {CONTACT}
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          See also our{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
