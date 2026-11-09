import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().replace(/[^a-zA-Z0-9@+\- ]/g, "").slice(0, 80) ?? "";
  if (query.length < 2) return Response.json({ customers: [] });

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = claims?.claims?.sub;
  if (claimsError || typeof ownerId !== "string") return Response.json({ error: "Sign in to select a customer." }, { status: 401 });

  const { data: business, error: businessError } = await supabase.from("businesses").select("id").eq("owner_id", ownerId).maybeSingle();
  if (businessError || !business) return Response.json({ error: "Business workspace could not be loaded." }, { status: 403 });

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, company_name, email")
    .eq("business_id", business.id)
    .or(`name.ilike.%${query}%,email.ilike.%${query}%,company_name.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(20);
  if (error) {
    console.error("Customer picker search failed", error);
    return Response.json({ error: "Customer search is temporarily unavailable." }, { status: 503 });
  }
  return Response.json({ customers });
}
