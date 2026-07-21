import type { jsPDF } from "jspdf";

export interface ReceiptData {
  receiptNo: string;
  /** ISO string or Date */
  date: string | Date;
  name: string;
  email: string;
  plan: string; // "Basic" | "Pro"
  amount: number; // NGN
  transactionId: string | number;
  reference: string;
}

const ACCENT: [number, number, number] = [43, 78, 218];
const INK: [number, number, number] = [28, 36, 52];
const FAINT: [number, number, number] = [120, 128, 145];

const ngn = (n: number) => "NGN " + n.toLocaleString("en-NG");

function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Draw the receipt onto an existing jsPDF document (a4, mm units). Kept free of
 *  a static jsPDF import so it works in the browser (lazy-loaded) and in Node. */
export function renderReceipt(doc: jsPDF, data: ReceiptData): jsPDF {
  const W = 210;
  const M = 18;

  // Header band
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SIWES Logbook Assistant", M, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Payment Receipt", M, 24);

  doc.setFontSize(9);
  doc.text(`Receipt #${data.receiptNo}`, W - M, 14, { align: "right" });
  doc.text(fmtDate(data.date), W - M, 20, { align: "right" });

  // Paid badge
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(W - M - 30, 24, 30, 7, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PAID", W - M - 15, 28.8, { align: "center" });

  // Billed to
  let y = 50;
  doc.setTextColor(...FAINT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("BILLED TO", M, y);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  y += 6;
  doc.text(data.name || "—", M, y);
  y += 5.5;
  doc.setTextColor(...FAINT);
  doc.setFontSize(10);
  doc.text(data.email || "—", M, y);

  // Line items header
  y += 14;
  doc.setDrawColor(225, 228, 235);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 7;
  doc.setTextColor(...FAINT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESCRIPTION", M, y);
  doc.text("AMOUNT", W - M, y, { align: "right" });
  y += 3;
  doc.line(M, y, W - M, y);

  // Item
  y += 8;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${data.plan} plan — one-time full access`, M, y);
  doc.text(ngn(data.amount), W - M, y, { align: "right" });
  y += 4;
  doc.setTextColor(...FAINT);
  doc.setFontSize(9);
  doc.text("Full placement access — no subscription", M, y);

  // Total
  y += 10;
  doc.setDrawColor(225, 228, 235);
  doc.line(M, y, W - M, y);
  y += 8;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total paid", M, y);
  doc.setTextColor(...ACCENT);
  doc.text(ngn(data.amount), W - M, y, { align: "right" });

  // Meta
  y += 16;
  doc.setTextColor(...FAINT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Transaction ID: ${data.transactionId}`, M, y);
  y += 5;
  doc.text(`Reference: ${data.reference}`, M, y);
  y += 5;
  doc.text("Payment method: Flutterwave (card / bank transfer / USSD)", M, y);

  // Footer
  doc.setDrawColor(225, 228, 235);
  doc.line(M, 262, W - M, 262);
  doc.setFontSize(8.5);
  doc.setTextColor(...FAINT);
  doc.text(
    "Thank you for your payment. This receipt confirms one-time access to the SIWES Logbook Assistant",
    M,
    270,
  );
  doc.text(
    "for your industrial training. Access is tied to your browser. Keep this receipt for your records.",
    M,
    275,
  );

  return doc;
}

/** Build and download the receipt PDF in the browser (jsPDF loaded on demand). */
export async function downloadReceipt(data: ReceiptData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  renderReceipt(doc, data);
  doc.save(`siwes-receipt-${data.receiptNo}.pdf`);
}
