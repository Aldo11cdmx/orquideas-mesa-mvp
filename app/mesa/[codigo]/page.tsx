import { notFound } from "next/navigation";
import { activeTables } from "@/lib/menu";
import { MenuClient } from "@/components/menu-client";

export default async function TablePage({
  params
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const tableCode = codigo.toUpperCase();
  if (!activeTables.includes(tableCode)) notFound();
  return <MenuClient tableCode={tableCode} />;
}
