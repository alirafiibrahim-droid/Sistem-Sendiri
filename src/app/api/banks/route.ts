import { createSupabaseServer } from "@/lib/supabase/server";
import {
  apiOk,
  apiCreated,
  apiUnauthorized,
  apiBadRequest,
  apiInternalError,
  getUid,
} from "@/lib/api-response";
import { bankFormSchema } from "@/lib/validations/settings";
import { requireAccess } from "@/lib/access";
import { getUserRole } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("banks")
      .select("*")
      .order("name", { ascending: true });

    if (error) return apiInternalError(error.message);
    return apiOk(data);
  } catch {
    return apiInternalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = getUid(request);
    if (!uid) return apiUnauthorized();

    const role = getUserRole(request);
    const forbidden = requireAccess(role, "settings-cash-bank", "create");
    if (forbidden) return forbidden;

    const body = await request.json();
    const parsed = bankFormSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return apiBadRequest(msg);
    }

    const { name, account_number, account_holder, description } = parsed.data;
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase
      .from("banks")
      .insert({
        name,
        account_number,
        account_holder,
        description: description || "",
      })
      .select()
      .single();

    if (error) return apiInternalError(error.message);

    await writeAuditLog({
      action: "CREATE",
      targetTable: "banks",
      targetId: data.id,
      userId: uid,
      newValue: {
        name: data.name,
        account_number: data.account_number,
        account_holder: data.account_holder,
      },
    });

    return apiCreated(data);
  } catch {
    return apiInternalError();
  }
}
