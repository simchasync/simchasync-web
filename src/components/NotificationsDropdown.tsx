import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationsDropdown() {
  return (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="h-4 w-4" />
    </Button>
  );
}
