// Generates the printable Quick-Start Guide PDF shown in the app.
// Run:  node scripts/gen-guide.mjs
import { jsPDF } from "jspdf";
import { writeFileSync } from "node:fs";

const ACCENT = [43, 78, 218];
const DEEP = [22, 41, 110];
const INK = [28, 36, 52];
const SOFT = [70, 80, 107];
const FAINT = [120, 128, 145];
const WASH = [238, 242, 254];

const W = 210;
const H = 297;
const M = 20;
const CW = W - M * 2;

const doc = new jsPDF({ unit: "mm", format: "a4" });
let page = 0;

function footer() {
  page += 1;
  doc.setDrawColor(225, 228, 235);
  doc.setLineWidth(0.3);
  doc.line(M, H - 15, W - M, H - 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...FAINT);
  doc.text("SIWES Logbook Assistant — Quick-Start Guide", M, H - 10);
  doc.text(String(page), W - M, H - 10, { align: "right" });
}

function newPage() {
  footer();
  doc.addPage();
}

let y = 0;
function ensure(space) {
  if (y > H - 22 - space) {
    newPage();
    y = M + 6;
  }
}

function heading(text) {
  ensure(20);
  doc.setFillColor(...ACCENT);
  doc.rect(M, y - 4.5, 3, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...DEEP);
  doc.text(text, M + 6, y);
  y += 9;
}

function para(text, opts = {}) {
  const size = opts.size ?? 10.5;
  const color = opts.color ?? SOFT;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, opts.w ?? CW);
  for (const ln of lines) {
    ensure(6);
    doc.text(ln, opts.x ?? M, y);
    y += size * 0.52;
  }
  y += opts.gap ?? 2.5;
}

function step(n, title, body) {
  ensure(18);
  const cx = M + 4;
  doc.setFillColor(...ACCENT);
  doc.circle(cx, y - 1.2, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(String(n), cx, y + 0.4, { align: "center" });
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text(title, M + 12, y);
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SOFT);
  const lines = doc.splitTextToSize(body, CW - 12);
  for (const ln of lines) {
    ensure(6);
    doc.text(ln, M + 12, y);
    y += 5.1;
  }
  y += 3.5;
}

function bullet(text) {
  ensure(7);
  doc.setFillColor(...ACCENT);
  doc.circle(M + 1.5, y - 1.3, 1, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...SOFT);
  const lines = doc.splitTextToSize(text, CW - 7);
  doc.text(lines[0], M + 6, y);
  y += 5.2;
  for (let i = 1; i < lines.length; i++) {
    ensure(6);
    doc.text(lines[i], M + 6, y);
    y += 5.2;
  }
  y += 1;
}

// ---------------- Cover ----------------
doc.setFillColor(...ACCENT);
doc.rect(0, 0, W, 120, "F");
doc.setFillColor(...DEEP);
doc.rect(0, 110, W, 10, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(30);
doc.setTextColor(255, 255, 255);
doc.text("SIWES Logbook", M, 52);
doc.text("Assistant", M, 66);

doc.setFont("helvetica", "normal");
doc.setFontSize(15);
doc.setTextColor(220, 228, 255);
doc.text("Quick-Start Guide", M, 82);

doc.setFontSize(11);
doc.setTextColor(...SOFT);
const intro = doc.splitTextToSize(
  "Turn your messy daily work notes into a clean, professional logbook — plus weekly summaries, your full final SIWES report, and defense slides. No technical setup, no keys — just your details and you're ready.",
  CW,
);
doc.text(intro, M, 140);

// Highlight card
doc.setFillColor(...WASH);
doc.roundedRect(M, 168, CW, 34, 3, 3, "F");
doc.setFont("helvetica", "bold");
doc.setFontSize(12);
doc.setTextColor(...DEEP);
doc.text("New here? Start in under 2 minutes.", M + 8, 182);
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(...SOFT);
doc.text(
  "Fill your details, tell the assistant your day, and save it to your logbook.",
  M + 8,
  191,
);

y = 222;
heading("What this app does");
para(
  "Every working day, just tell the assistant what you did at work in plain English — even rough, short or unordered. It rewrites your notes into a neat 35–70 word entry that fits the 'Description of Work Done' box in your SIWES logbook, and remembers everything for your weekly summaries and final report.",
);
para(
  "You never have to set up anything technical. There are no keys to get and nothing to configure — the assistant is ready the moment you sign in.",
  { color: INK, bold: false },
);

newPage();
y = M + 6;

// ---------------- Getting started ----------------
heading("Getting started in 3 steps");
step(
  1,
  "Fill your details",
  "Enter your name, school, course, firm, department and start date. This personalises your logbook, summaries and report. Only a few fields are required and you can edit them anytime.",
);
step(
  2,
  "Tell it your day",
  "Type everything you did at work — messy is completely fine — and press Send. You get a clean, professional entry. Tap 'Save to logbook' to record it.",
);
step(
  3,
  "Build your records",
  "Generate weekly summaries as you go, and when your placement is done, build your full final SIWES report — all from the saved entries.",
);

y += 2;
heading("Your logbook");
bullet(
  "Open the Logbook tab to see your Weekly Progress Chart — it mirrors the real SIWES logbook page.",
);
bullet("Hover any day and tap Add/Edit to write or fix an entry by hand.");
bullet("Jump between weeks with the arrows or the week dots.");
bullet(
  "Print your logbook, or download it as an editable Word (.docx) file to submit or copy into your official book.",
);

newPage();
y = M + 6;

// ---------------- Pro ----------------
heading("Pro features");
para(
  "Pro unlocks everything you need to finish your placement and pass your defense:",
  { gap: 4 },
);
bullet("Generate Monthly Summaries.");
bullet(
  "Build your full Final SIWES Report in the official NACOS format — title page, dedication, acknowledgements, all five chapters, references and appendix — then download it as Word.",
);
bullet(
  "Generate your Defense Slide Deck (9 slides, 6x6 rule, with speaker notes) and download it as a designed PowerPoint.",
);
bullet("Attach photos and skill tags to each logbook day.");
bullet("Voice typing, writing-style presets, a daily streak and reminders.");
bullet(
  "Smart diagrams (flowcharts, ER diagrams, architectures) for your report appendix.",
);

y += 3;
heading("Free trial & plans");
bullet(
  "Try everything free for 3 days — just enter your matric number to start. No card needed.",
);
bullet("Basic (₦1,500): your daily logbook and weekly summaries.");
bullet(
  "Pro (₦2,500): everything, right up to the final report and defense slides.",
);
bullet(
  "Payment is a one-time fee for your whole placement — secure, through Flutterwave.",
);
bullet(
  "Have an access code? Enter it on the sign-up form for instant access.",
);
bullet(
  "Already paid but still locked? On the unlock page, type the email you paid with and tap 'Restore my access'.",
);

y += 4;
doc.setFillColor(...WASH);
const boxH = 26;
ensure(boxH + 4);
doc.roundedRect(M, y - 4, CW, boxH, 3, 3, "F");
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(...DEEP);
doc.text("Tip: keep a backup", M + 8, y + 4);
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(...SOFT);
doc.text(
  doc.splitTextToSize(
    "Your logbook lives in your browser. On the Profile page, tap 'Download backup' now and then, so you can restore it if you clear your history or switch phones.",
    CW - 16,
  ),
  M + 8,
  y + 11,
);

footer();

writeFileSync(
  "/home/user/siwes-/public/SIWES-Logbook-Assistant-Guide.pdf",
  Buffer.from(doc.output("arraybuffer")),
);
console.log("wrote public/SIWES-Logbook-Assistant-Guide.pdf");
