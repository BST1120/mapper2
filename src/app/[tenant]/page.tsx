import { redirect } from "next/navigation";
import { getTodayYYYYMMDDInTimeZone } from "@/lib/date";

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const date = getTodayYYYYMMDDInTimeZone("Asia/Tokyo");
  redirect(`/${encodeURIComponent(tenant)}/mapper?date=${encodeURIComponent(date)}`);
}

