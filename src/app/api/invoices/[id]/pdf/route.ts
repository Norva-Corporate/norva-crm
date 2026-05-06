import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { InvoicePDF } from "@/lib/pdf/InvoicePDF";
import { getInvoiceWithDetails } from "@/lib/actions/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const element = createElement(InvoicePDF, {
    invoice: {
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
              first_name: invoice.contact.first_name,
              last_name: invoice.contact.last_name,
            }
          : null,
        company: invoice.company ? { name: invoice.company.name } : null,
        items: (invoice.items ?? []).map(
          (it: {
            description: string;
            quantity: number;
            unit_price: number;
            total: number;
          }) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
            total: Number(it.total),
          })
        ),
      },
    });

  const buffer = await renderToBuffer(
    element as unknown as ReactElement<DocumentProps>
  );

  const filename = `${invoice.type === "quote" ? "Devis" : "Facture"}-${
    invoice.number
  }.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
