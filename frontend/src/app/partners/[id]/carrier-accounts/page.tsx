import { redirect } from "next/navigation";

/**
 * Carrier Accounts merged into the unified Channels page
 * (Routing Channels tab at /partners/[id]/channels).
 */
export default function CarrierAccountsRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/partners/${params.id}/channels`);
}
