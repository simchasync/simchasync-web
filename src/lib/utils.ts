import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** Combines a venue name and address into a single string for map navigation,
 * so directions point to the venue itself rather than just its city/area. */
export function buildNavigationAddress(venue?: string | null, location?: string | null): string {
  const v = venue?.trim();
  const l = location?.trim();
  if (v && l) return `${v}, ${l}`;
  return l || v || "";
}
