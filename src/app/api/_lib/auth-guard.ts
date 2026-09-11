// PlayBeat — Admin auth guard
// Used at the top of every admin API route handler:
//   const { admin, error } = await requireAdmin(req);
//   if (error) return error;
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";

export interface AdminContext {
  id: string;
  email: string;
  role: string;
}

export async function requireAdmin(req: NextRequest): Promise<{
  admin: AdminContext | null;
  error: NextResponse | null;
}> {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return {
      admin: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { admin, error: null };
}
