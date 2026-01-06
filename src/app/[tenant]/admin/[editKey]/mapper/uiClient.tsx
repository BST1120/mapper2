"use client";

import { useParams } from "next/navigation";

import { MapperGrid } from "../../../mapper/ui";
import { useAreas } from "@/lib/firebase/hooks";

export function AdminMapperClient({ fallback }: { fallback: React.ReactNode }) {
  const params = useParams<{ tenant: string; editKey: string }>();
  const tenantId = params.tenant;
  const { areasById, error } = useAreas(tenantId);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!areasById) return <>{fallback}</>;
  return <MapperGrid areasById={areasById} />;
}

