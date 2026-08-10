import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BrandLogo from "@/components/BrandLogo";

export default function PhoneNumber() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;
      if (!session?.user) {
        navigate("/auth/login", { replace: true });
        return;
      }

      const metadata = session.user.user_metadata as { phone?: string } | undefined;
      const existingPhone = metadata?.phone?.trim();

      if (existingPhone) {
        navigate("/app", { replace: true });
        return;
      }

      setPhone(existingPhone ?? "");
      setChecking(false);
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) {
      toast({ title: "Phone number required", description: "Please enter your phone number to continue.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { phone: phone.trim() },
      });
      if (error) throw error;
      // Sync the phone into profiles (for the admin panel) and let the backend
      // send the "new signup" notification now that we have a phone number.
      await supabase.functions.invoke("ensure-user-onboarding").catch(() => {});
      toast({ title: "Phone saved", description: "Your account setup is complete." });
      navigate("/app", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save phone number.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" />
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2 border-b border-border/60 p-6 text-center">
            <CardTitle className="text-2xl font-semibold">One more step</CardTitle>
            <p className="text-sm text-muted-foreground">
              To finish setting up your account, enter a phone number where we can reach you.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm text-muted-foreground">
                  Phone number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="e.g. +1 555 555 1234"
                  autoComplete="tel"
                  required
                />
              </div>
              <Button type="submit" className="w-full font-semibold" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save phone number
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
