import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  workspaceName?: string;
  onSent?: () => void;
}

export default function SendInvoiceDialog({ open, onOpenChange, invoice, workspaceName, onSent }: SendInvoiceDialogProps) {
  const clientEmail = invoice?.clients?.email || "";
  const clientName = invoice?.clients?.name || "";
  const [email, setEmail] = useState(clientEmail);
  const [sending, setSending] = useState(false);

  const paymentUrl = invoice?.stripe_payment_url || "";

  const buildPreviewText = () => {
    const lines = [
      `📄 *Invoice from ${workspaceName || "us"}*`,
      "",
      `Hi ${clientName || "there"},`,
      "",
      `💰 *Amount: $${Number(invoice?.amount || 0).toFixed(2)}*`,
    ];
    if (invoice?.events) {
      lines.push(`🎵 Event: ${invoice.events.event_type} — ${format(new Date(invoice.events.event_date), "MMM d, yyyy")}`);
    }
    if (paymentUrl) {
      lines.push("", `💳 *Pay online:*`, paymentUrl);
    }
    lines.push("", "Thank you! 🙏");
    return lines.join("\n");
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoice_id: invoice.id, to_email: email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Invoice sent!", description: `Email sent to ${email}` });
      onSent?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleWhatsApp = () => {
    const phone = invoice?.clients?.phone?.replace(/\D/g, "") || "";
    const text = encodeURIComponent(buildPreviewText());
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
    toast({ title: "WhatsApp opened" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Invoice</DialogTitle>
          <DialogDescription>
            Send this invoice to {clientName || "the client"} via email or WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" />
          </div>

          <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Preview:</p>
            <pre className="whitespace-pre-wrap text-xs">{buildPreviewText()}</pre>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button onClick={handleSendEmail} disabled={!email || sending} className="flex-1">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            {sending ? "Sending…" : "Send via Email"}
          </Button>
          <Button onClick={handleWhatsApp} variant="outline" className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <MessageCircle className="mr-2 h-4 w-4" /> Send via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
