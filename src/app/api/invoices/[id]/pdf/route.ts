import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInvoiceWithDetails } from "@/lib/actions/invoices";
import {
  generateInvoicePdf,
  invoicePdfFilename,
  type InvoiceForPdf,
} from "@/lib/pdf/generate-invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await getInvoiceWithDetails(id);
    if (!invoice) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 }
      );
    }

    const invoiceForPdf: InvoiceForPdf = {
      number: invoice.number,
      type: invoice.type,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      subtotal: Number(invoice.subtotal),
      tax_rate: Number(invoice.tax_rate),
      tax_amount: Number(invoice.tax_amount),
      total: Number(invoice.total),
      notes: invoice.notes,
      contact: invoice.contact
        ? {
            first_name: invoice.contact.first_name ?? "",
            last_name: invoice.contact.last_name ?? "",
          }
        : null,
      company: invoice.company ? { name: invoice.company.name ?? "" } : null,
      items: (invoice.items ?? []).map(
        (it: {
          description: string | null;
          quantity: number;
          unit_price: number;
          total: number;
        }) => ({
          description: it.description ?? "",
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total: Number(it.total),
        })
      ),
    };

    const buffer = await generateInvoicePdf(invoiceForPdf);
    const filename = invoicePdfFilename(invoiceForPdf);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[invoices/pdf] generation failed:", err);
    return NextResponse.json(
      {
        error: "Échec de génération PDF",
        detail: message,
        stack: process.env.NODE_ENV === "production" ? undefined : stack,
      },
      { status: 500 }
    );
  }
}
