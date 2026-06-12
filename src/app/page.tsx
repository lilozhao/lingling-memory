import { requireAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getMemoriesByUser } from "@/lib/db/queries/memories";
import HomeScreen from "@/components/screens/HomeScreen";

export default async function HomePage() {
  const hdrs = await headers();
  const mockReq = { headers: { get: (k: string) => hdrs.get(k) } } as unknown as NextRequest;
  const authResult = requireAuth(mockReq);

  let total = 0;
  if (authResult.ok) {
    const list = await getMemoriesByUser(authResult.user.id);
    total = list.length;
  }

  return <HomeScreen stats={{ total }} />;
}
