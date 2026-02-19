import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { ids, category } = await request.json();
    if (!ids?.length || !category) {
      return NextResponse.json({ error: "ids and category required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("documents")
      .update({ category })
      .in("id", ids);

    if (error) throw error;

    return NextResponse.json({ updated: ids.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
