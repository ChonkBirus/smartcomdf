import { Badge } from "@/components/ui/badge";
import { Package, Wrench } from "lucide-react";
import type { ItemType } from "@/lib/products.functions";

export function ItemBadge({ type }: { type: ItemType }) {
  if (type === "SERVICE") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      >
        <Wrench className="mr-1 h-3 w-3" />
        Serviço
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
    >
      <Package className="mr-1 h-3 w-3" />
      Produto
    </Badge>
  );
}
