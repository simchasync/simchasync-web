import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice_id");
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!invoiceId) { setChecking(false); return; }
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await (supabase as any).from("invoices").select("status").eq("id", invoiceId).single();
      if ((data as any)?.status === "paid") { setVerified(true); setChecking(false); clearInterval(interval); }
      else if (attempts >= 10) { setChecking(false); clearInterval(interval); }
    }, 3000);
    return () => clearInterval(interval);
  }, [invoiceId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-12 space-y-4">
          {checking ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Verifying payment...</h2>
              <p className="text-muted-foreground text-sm text-center">Please wait while we confirm your payment with Stripe.</p>
            </>
          ) : (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500" />
              <h2 className="text-2xl font-bold">Payment Successful!</h2>
              <p className="text-muted-foreground text-center">
                {verified ? "Your payment has been confirmed and the invoice has been marked as paid." : "Your payment is being processed. The invoice will be updated shortly."}
              </p>
              <Button asChild className="mt-4"><Link to="/app/invoices">Back to Invoices</Link></Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}