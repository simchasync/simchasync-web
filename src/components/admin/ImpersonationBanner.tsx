import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ImpersonationBannerProps {
  tenantName: string;
}

export default function ImpersonationBanner({ tenantName }: ImpersonationBannerProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b bg-amber-500/10 px-6 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-300">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>
          You are viewing <strong>{tenantName}</strong>'s data (read-only)
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-amber-400 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
        onClick={() => navigate("/admin/tenants")}
      >
        <X className="mr-1 h-3 w-3" /> Exit
      </Button>
    </div>
  );
}
