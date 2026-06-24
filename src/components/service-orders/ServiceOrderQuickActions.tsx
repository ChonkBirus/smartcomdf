import { Button } from "@/components/ui/button";
import { MapPin, Phone, MessageCircle } from "lucide-react";

type Props = {
  address?: {
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    complement?: string | null;
  } | null;
  phone?: string | null;
  whatsapp?: string | null;
  customerName?: string | null;
  serviceOrderNumber?: string | null;
  companyName?: string | null;
};

function digits(v?: string | null) {
  return (v ?? "").replace(/\D+/g, "");
}

export function ServiceOrderQuickActions({
  address, phone, whatsapp, customerName, serviceOrderNumber, companyName,
}: Props) {
  const addrLine = address
    ? [
        [address.street, address.number].filter(Boolean).join(", "),
        address.neighborhood,
        [address.city, address.state].filter(Boolean).join("/"),
        address.zip_code,
      ].filter(Boolean).join(" - ")
    : "";

  const mapHref = addrLine
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrLine)}`
    : null;
  const telHref = phone ? `tel:${digits(phone)}` : null;
  const waNumber = digits(whatsapp);
  const waMsg =
    `Olá, ${customerName ?? "cliente"}. Sou o técnico responsável pela Ordem de Serviço ` +
    `#${serviceOrderNumber ?? ""} da ${companyName ?? "empresa"}.`;
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`
    : null;

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button
        asChild={!!mapHref}
        disabled={!mapHref}
        variant="outline"
        className="h-14 flex-col gap-1"
      >
        {mapHref ? (
          <a href={mapHref} target="_blank" rel="noreferrer">
            <MapPin className="h-5 w-5" />
            <span className="text-xs">Mapa</span>
          </a>
        ) : (
          <span><MapPin className="h-5 w-5" /><span className="text-xs">Mapa</span></span>
        )}
      </Button>
      <Button
        asChild={!!telHref}
        disabled={!telHref}
        variant="outline"
        className="h-14 flex-col gap-1"
      >
        {telHref ? (
          <a href={telHref}>
            <Phone className="h-5 w-5" />
            <span className="text-xs">Ligar</span>
          </a>
        ) : (
          <span><Phone className="h-5 w-5" /><span className="text-xs">Ligar</span></span>
        )}
      </Button>
      <Button
        asChild={!!waHref}
        disabled={!waHref}
        variant="outline"
        className="h-14 flex-col gap-1 text-emerald-700 dark:text-emerald-300"
      >
        {waHref ? (
          <a href={waHref} target="_blank" rel="noreferrer">
            <MessageCircle className="h-5 w-5" />
            <span className="text-xs">WhatsApp</span>
          </a>
        ) : (
          <span><MessageCircle className="h-5 w-5" /><span className="text-xs">WhatsApp</span></span>
        )}
      </Button>
    </div>
  );
}
