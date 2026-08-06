import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MenuClient } from "@/components/menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table: qrToken } = await searchParams;
  if (!qrToken) notFound();

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_table_by_qr", {
    p_qr_token: qrToken
  });

  if (error || !data) {
    notFound();
  }

  return <MenuClient tableCode={data.code} />;
}
