import { NextResponse } from "next/server";
import { addExtraRapidoToOrder } from "@/lib/extra-rapid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amountMxn } = body;

    const record = await addExtraRapidoToOrder(id, amountMxn);

    return NextResponse.json(
      { success: true, data: record },
      { status: 201 }
    );
  } catch (err: unknown) {
    const error = err as Error;

    if (error.message === "invalid_amount" || error.message === "amount_not_allowed") {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "internal_server_error", details: error.message },
      { status: 500 }
    );
  }
}
