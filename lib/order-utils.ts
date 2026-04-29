import { gs365StatusBadgeClass } from "@/lib/ui/gs365-glow";

export function getOrderStatusTone(status: string) {
  return gs365StatusBadgeClass(status);
}
