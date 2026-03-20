import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavigateButtonProps {
  address: string;
  size?: "sm" | "icon";
}

export default function NavigateButton({ address, size = "sm" }: NavigateButtonProps) {
  if (!address) return null;

  const encoded = encodeURIComponent(address);

  const options = [
    { label: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${encoded}` },
    { label: "Waze", url: `https://waze.com/ul?q=${encoded}&navigate=yes` },
    { label: "Apple Maps", url: `https://maps.apple.com/?q=${encoded}` },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-1.5">
          <Navigation className="h-4 w-4" />
          {size !== "icon" && "Navigate"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.label} asChild>
            <a href={opt.url} target="_blank" rel="noopener noreferrer">
              {opt.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
