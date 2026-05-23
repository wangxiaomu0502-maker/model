import {
  findFirstEnabledCsPhone,
  findOrderCsContextById,
  shouldShowCsContactOnOrder
} from "./order-cs-contact.repository";

export const CS_CONTACT_HINT_TEXT =
  "客服稍后会联系您完成订单，您也可以主动联系客服";

export type OrderCsContactDto = {
  visible: boolean;
  hintText: string;
  phone: string | null;
  displayName: string | null;
};

export async function resolveOrderCsContactForApp(
  orderId: number
): Promise<OrderCsContactDto | null> {
  const row = await findOrderCsContextById(orderId);
  if (!row || !shouldShowCsContactOnOrder(Number(row.order_status), row.cs_status)) {
    return null;
  }

  const handlerPhone = row.handler_phone?.trim() || "";
  let phone: string | null = handlerPhone || null;
  let displayName = row.handler_display_name?.trim() || null;

  if (!phone) {
    const fallback = await findFirstEnabledCsPhone();
    if (fallback) {
      phone = fallback.phone;
      displayName = displayName || fallback.displayName;
    }
  }

  return {
    visible: true,
    hintText: CS_CONTACT_HINT_TEXT,
    phone,
    displayName
  };
}
