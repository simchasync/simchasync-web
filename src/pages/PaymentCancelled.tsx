import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCancelled() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-12 space-y-4">
          <XCircle className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold">Payment Cancelled</h2>
          <p className="text-muted-foreground text-center">The payment was not completed. No charges were made.</p>
          <Button asChild className="mt-4"><Link to="/app/invoices">Back to Invoices</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}