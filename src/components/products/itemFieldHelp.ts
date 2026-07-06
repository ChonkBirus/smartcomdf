// Centralized help texts and field labels for the Item form (Product vs Service).
// Keep all copy for the "?" tooltips here so Product and Service stay in sync.

import type { ItemType } from "@/lib/products.functions";

export type ItemFieldKey =
  | "name"
  | "description"
  | "sku"
  | "barcode"
  | "category"
  | "brand"
  | "manufacturer"
  | "cost_price"
  | "sale_price"
  | "unit"
  | "minimum_stock";

type FieldCopy = {
  /** Label shown on the field. Use "*" suffix for required. */
  label: string;
  /** Help text displayed inside the "?" tooltip. */
  help: string;
};

type FieldMap = Partial<Record<ItemFieldKey, FieldCopy>>;

const PRODUCT: FieldMap = {
  name: {
    label: "Nome*",
    help: "Nome que aparece nos orçamentos e no catálogo. Ex.: Câmera Intelbras VHD 1220 D.",
  },
  description: {
    label: "Descrição",
    help: "Detalhes técnicos e diferenciais. Aparece no orçamento e ajuda o cliente a entender o item.",
  },
  sku: {
    label: "SKU",
    help: "Código interno do item para você identificar rapidamente. Ex.: CAM-001.",
  },
  barcode: {
    label: "Código de barras",
    help: "Código EAN/GTIN de fábrica. Use um leitor ou digite manualmente.",
  },
  category: {
    label: "Categoria*",
    help: "Agrupamento do item (ex.: Câmeras, Cabos). Facilita busca e relatórios.",
  },
  brand: {
    label: "Marca",
    help: "Marca comercial do item. Ex.: Intelbras, Hikvision.",
  },
  manufacturer: {
    label: "Fabricante",
    help: "Quem produz o item. Pode ser diferente da marca (ex.: fabricante OEM).",
  },
  cost_price: {
    label: "Preço de custo (R$)",
    help: "Quanto você paga pelo item (custo de compra). Base para calcular o markup.",
  },
  sale_price: {
    label: "Preço de venda (R$)",
    help: "Preço final para o cliente. Use o botão de sugestão para calcular com base no custo e markup.",
  },
  unit: {
    label: "Unidade de medida",
    help: "Como o item é vendido: unidade (UN), caixa (CX), metro (MT) etc.",
  },
  minimum_stock: {
    label: "Estoque mínimo",
    help: "Quantidade abaixo da qual o sistema avisa que precisa comprar mais.",
  },
};

const SERVICE: FieldMap = {
  name: {
    label: "Nome*",
    help: "Nome do serviço como aparece nos orçamentos. Ex.: Instalação de câmera, Visita técnica.",
  },
  description: {
    label: "Descrição",
    help: "O que está incluso no serviço, tempo estimado, condições. Aparece no orçamento.",
  },
  sku: {
    label: "SKU (opcional)",
    help: "Código interno para identificar o serviço rapidamente. Opcional. Ex.: SRV-INST.",
  },
  category: {
    label: "Categoria*",
    help: "Agrupamento do serviço (ex.: Instalação, Manutenção). Facilita busca e relatórios.",
  },
  brand: {
    label: "Marca (opcional)",
    help: "Opcional. Use quando o serviço estiver associado a uma marca (ex.: instalação autorizada Intelbras).",
  },
  cost_price: {
    label: "Preço de custo (R$)",
    help: "Quanto o serviço custa para a empresa executar (mão de obra, deslocamento). Base para calcular o markup.",
  },
  sale_price: {
    label: "Preço de venda (R$)",
    help: "Valor cobrado do cliente pelo serviço. Use o botão de sugestão para calcular a partir do custo e do markup.",
  },
  unit: {
    label: "Unidade de medida",
    help: "Como o serviço é cobrado. Ex.: UN por chamado, MT por metro instalado, KIT por pacote fechado.",
  },
};

const MAP: Record<ItemType, FieldMap> = {
  PRODUCT,
  SERVICE,
};

/**
 * Returns the centralized `{ label, help }` for a given item type + field.
 * Falls back to the Product copy when the Service map does not override it.
 */
export function getItemFieldCopy(type: ItemType, key: ItemFieldKey): FieldCopy {
  return MAP[type]?.[key] ?? PRODUCT[key] ?? { label: key, help: "" };
}
