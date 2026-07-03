/* ============================================================================
   LOCAL REASONING ENGINE (offline fallback when no AI key is configured)
   Not hardcoded per-question: it extracts entities + intents from ANY sentence
   and COMPOSES an answer (compare / estimate cost / admission chance / suggest).
   ============================================================================ */

export type Dept = {
  code: string;
  name: string;
  seats: number;
  hod: string;
  rankLow: number;
  rankHigh: number;
  avg: number; // LPA
  high: number; // LPA
  facilities: string;
  tags: string[];
};

export const DEPTS: Dept[] = [
  { code: "CSE", name: "Computer Science and Engineering", seats: 120, hod: "Prof. T. Srinivas", rankLow: 4500, rankHigh: 12000, avg: 7.5, high: 24, facilities: "HPC cluster, AI & Big Data lab, ACM & IEEE chapters", tags: ["coding", "software", "programming", "computer", "it", "web", "app", "developer"] },
  { code: "AIML", name: "CSE (Artificial Intelligence & Machine Learning)", seats: 60, hod: "Dr. K. Anuradha", rankLow: 6000, rankHigh: 15000, avg: 8.0, high: 22.5, facilities: "NVIDIA A100 GPU servers, deep learning studio", tags: ["ai", "ml", "artificial intelligence", "machine learning", "deep learning", "neural", "data"] },
  { code: "DS", name: "CSE (Data Science)", seats: 60, hod: "Dr. M. Venkat", rankLow: 7000, rankHigh: 16500, avg: 7.2, high: 18, facilities: "Data analytics lab, cloud lab, Tableau/PowerBI", tags: ["data science", "analytics", "statistics", "big data", "cloud"] },
  { code: "ECE", name: "Electronics and Communication Engineering", seats: 120, hod: "Prof. P. Ramesh", rankLow: 12000, rankHigh: 25000, avg: 6.0, high: 16, facilities: "VLSI tools, embedded systems lab, IoT center", tags: ["electronics", "communication", "vlsi", "embedded", "iot", "circuits", "signal"] },
  { code: "EEE", name: "Electrical and Electronics Engineering", seats: 60, hod: "Dr. B. Suresh", rankLow: 22000, rankHigh: 40000, avg: 5.2, high: 12, facilities: "Power electronics lab, smart grid, solar PV setup", tags: ["electrical", "power", "grid", "energy", "motor", "solar"] },
  { code: "MECH", name: "Mechanical Engineering", seats: 60, hod: "Prof. V. Narsimha", rankLow: 30000, rankHigh: 55000, avg: 4.8, high: 10.5, facilities: "CNC & robotics lab, thermal setups, SAE Baja club", tags: ["mechanical", "automobile", "robotics", "thermal", "machine", "manufacturing", "design"] },
  { code: "CIVIL", name: "Civil Engineering", seats: 60, hod: "Dr. S. Radhakrishna", rankLow: 35000, rankHigh: 60000, avg: 4.5, high: 9, facilities: "Structural lab, GIS & remote sensing, surveying", tags: ["civil", "construction", "structural", "survey", "building", "concrete", "infrastructure"] },
];

const FEES = { btech: 75000, mtech: 65000, hostel: 72000, exam: 1800 };

export type BotAnswer = { text: string; bullets?: string[] };

function inr(n: number) {
  return "Rs. " + Math.round(n).toLocaleString("en-IN");
}

function norm(s: string) {
  return " " + s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim() + " ";
}

/* ---------- entity extraction ---------- */
function findDepts(q: string): Dept[] {
  const n = norm(q);
  const found: Dept[] = [];
  for (const d of DEPTS) {
    const hit =
      new RegExp(`\\b${d.code.toLowerCase()}\\b`).test(n) ||
      d.tags.some((t) => n.includes(" " + t + " ") || n.includes(" " + t));
    if (hit) found.push(d);
  }
  return found;
}

function findRank(q: string): number | undefined {
  const m = q.replace(/,/g, "").match(/\b(\d{3,6})\b/g);
  if (!m) return undefined;
  // prefer a number near the word rank
  const rankCtx = q.replace(/,/g, "").match(/rank[^\d]{0,10}(\d{3,6})|(\d{3,6})[^\d]{0,10}rank/i);
  if (rankCtx) return Number(rankCtx[1] || rankCtx[2]);
  const nums = m.map(Number).filter((x) => x >= 500);
  return nums.length ? nums[0] : undefined;
}

function findPercent(q: string): number | undefined {
  const m = q.match(/\b(\d{1,3})\s*(?:%|percent|marks|percentage)\b/i);
  if (!m) return undefined;
  const v = Number(m[1]);
  return v >= 0 && v <= 100 ? v : undefined;
}

function scholarshipPct(p?: number) {
  if (p === undefined) return 0;
  if (p >= 95) return 50;
  if (p >= 90) return 35;
  if (p >= 85) return 25;
  if (p >= 75) return 10;
  return 0;
}

/* ---------- intent scoring ---------- */
type Intent =
  | "greeting" | "compare" | "cost" | "scholarship" | "chance" | "suggest"
  | "placement" | "admission" | "hostel" | "library" | "labs" | "faculty"
  | "contact" | "courses" | "fees" | "timings" | "about" | "sports";

function scoreIntents(q: string): Intent[] {
  const n = norm(q);
  const has = (...ks: string[]) => ks.some((k) => n.includes(" " + k));
  const s: [Intent, number][] = [];
  const add = (i: Intent, v: number) => v && s.push([i, v]);

  if (/^\s*(hi|hii|hey|hello|hola|namaste|good morning|good evening|good afternoon|yo|sup)\s*$/.test(n)) add("greeting", 100);
  add("compare", has("compare", "vs", "versus", "difference", "better", "or ", "which is") ? 9 : 0);
  add("chance", has("chance", "can i get", "will i get", "eligible with", "possible", "admission with") ? 8 : 0);
  add("suggest", has("suggest", "recommend", "which branch", "best branch", "should i", "interested in", "good for", "want to become", "career in") ? 8 : 0);
  add("cost", has("total cost", "total fee", "how much", "cost", "estimate", "budget", "per year", "expense", "expensive", "affordable") ? 7 : 0);
  add("scholarship", has("scholarship", "reimbursement", "epass", "e-pass", "waiver", "free education", "concession") ? 8 : 0);
  add("placement", has("placement", "package", "salary", "lpa", "company", "companies", "recruit", "job", "hire", "internship", "career") ? 6 : 0);
  add("admission", has("admission", "apply", "application", "eligibility", "eamcet", "eapcet", "jee", "gate", "pgecet", "counseling", "counselling", "kucw", "join", "enroll", "document", "seat") ? 6 : 0);
  add("hostel", has("hostel", "mess", "room", "accommodation", "stay", "boarding", "warden", "food", "sharing", "dorm") ? 6 : 0);
  add("library", has("library", "book", "journal", "ieee", "nptel", "delnet", "reading") ? 6 : 0);
  add("labs", has("lab", "laboratory", "practical", "equipment", "gpu", "wifi", "workshop", "computer center") ? 5 : 0);
  add("faculty", has("faculty", "teacher", "professor", "staff", "hod", "mentor", "ratio") ? 5 : 0);
  add("contact", has("contact", "phone", "call", "email", "address", "location", "where", "reach", "map", "principal") ? 5 : 0);
  add("fees", has("fee", "fees", "tuition", "pay", "payment") ? 5 : 0);
  add("courses", has("course", "branch", "branches", "department", "program", "stream", "specialization", "btech", "mtech", "degree", "offer") ? 5 : 0);
  add("timings", has("timing", "hours", "open", "close", "schedule", "holiday", "calendar", "semester") ? 4 : 0);
  add("sports", has("sport", "gym", "game", "ground", "fest", "club", "cultural") ? 4 : 0);
  add("about", has("about", "college", "kucet", "university", "affiliation", "naac", "aicte", "ranking", "history", "vision") ? 3 : 0);

  s.sort((a, b) => b[1] - a[1]);
  return s.map((x) => x[0]);
}

/* ---------- composers ---------- */
function costAnswer(q: string): BotAnswer {
  const depts = findDepts(q);
  const isPG = /\bm\.?tech|pg|post\s*grad/i.test(q);
  const tuition = isPG ? FEES.mtech : FEES.btech;
  const wantHostel = /hostel|mess|stay|room|accommodation|residential|with hostel/i.test(q);
  const hostel = wantHostel ? FEES.hostel : 0;
  const pct = findPercent(q);
  const sch = scholarshipPct(pct);
  const schVal = (tuition * sch) / 100;
  const yearTotal = tuition + hostel + FEES.exam * 2;
  const bullets = [
    `**${isPG ? "M.Tech" : "B.Tech"} tuition:** ${inr(tuition)} per year (TAFRC regulated).`,
    wantHostel ? `**Hostel + mess:** ${inr(hostel)} per year (3 meals/day included).` : `Hostel not included — add "with hostel" to include ${inr(FEES.hostel)}/year.`,
    `**Exam fees:** ${inr(FEES.exam)} per semester (2 per year).`,
    `**Estimated total for Year 1:** ${inr(yearTotal)}.`,
  ];
  if (pct !== undefined) {
    bullets.push(
      sch > 0
        ? `With **${pct}%** marks, indicative merit scholarship ≈ **${sch}%** of tuition (${inr(schVal)}). Net ≈ **${inr(yearTotal - schVal)}**.`
        : `With ${pct}% marks there's no automatic merit waiver, but TS e-Pass reimbursement may cover tuition based on category/income.`
    );
  } else {
    bullets.push(`Tip: tell me your percentage (e.g. "I got 91%") and I'll estimate scholarship too.`);
  }
  const head = depts.length
    ? `Here's a cost estimate for **${depts[0].name}** at KUCET:`
    : `Here's an estimated cost breakdown at KUCET:`;
  return { text: head, bullets };
}

function compareAnswer(q: string): BotAnswer {
  let depts = findDepts(q);
  if (depts.length < 2) depts = [DEPTS[0], DEPTS[1]];
  const [a, b] = depts;
  return {
    text: `**${a.code} vs ${b.code}** — a quick comparison at KUCET:`,
    bullets: [
      `**Seats:** ${a.code} has ${a.seats}, ${b.code} has ${b.seats}.`,
      `**Closing rank (EAPCET, approx):** ${a.code} ${a.rankLow.toLocaleString("en-IN")}–${a.rankHigh.toLocaleString("en-IN")} | ${b.code} ${b.rankLow.toLocaleString("en-IN")}–${b.rankHigh.toLocaleString("en-IN")}.`,
      `**Placements:** ${a.code} avg ${a.avg} LPA / high ${a.high} LPA | ${b.code} avg ${b.avg} LPA / high ${b.high} LPA.`,
      `**${a.code} facilities:** ${a.facilities}.`,
      `**${b.code} facilities:** ${b.facilities}.`,
      a.avg >= b.avg
        ? `**Verdict:** ${a.code} currently has a stronger average package; pick ${b.code} if its subject area excites you more.`
        : `**Verdict:** ${b.code} currently has a stronger average package; pick ${a.code} if its subject area excites you more.`,
    ],
  };
}

function chanceAnswer(q: string): BotAnswer {
  const rank = findRank(q);
  const depts = findDepts(q);
  if (rank === undefined) {
    return { text: `Tell me your EAPCET/JEE rank (e.g. "Can I get CSE with rank 9000?") and I'll check your chances against each branch's closing rank.` };
  }
  const list = depts.length ? depts : DEPTS;
  const bullets = list.map((d) => {
    let verdict: string;
    if (rank <= d.rankLow) verdict = "✅ Very high chance";
    else if (rank <= d.rankHigh) verdict = "🟡 Good / borderline chance";
    else verdict = "⚠️ Unlikely in convenor quota (try Category-B / management merit)";
    return `**${d.code}** (closes ~${d.rankHigh.toLocaleString("en-IN")}): ${verdict}.`;
  });
  return {
    text: `With an approximate rank of **${rank.toLocaleString("en-IN")}**, here's how you stand for KUCET branches (indicative, based on recent trends):`,
    bullets,
  };
}

function suggestAnswer(q: string): BotAnswer {
  const depts = findDepts(q);
  if (depts.length) {
    const d = depts[0];
    return {
      text: `Based on your interest, **${d.name} (${d.code})** looks like a great fit at KUCET.`,
      bullets: [
        `**Why:** ${d.facilities}.`,
        `**Outcomes:** average ${d.avg} LPA, highest ${d.high} LPA.`,
        `**Get in:** aim for an EAPCET rank around ${d.rankLow.toLocaleString("en-IN")}–${d.rankHigh.toLocaleString("en-IN")}.`,
        `Want me to compare it with another branch or estimate the fees?`,
      ],
    };
  }
  return {
    text: `Tell me what you enjoy and I'll suggest a branch. For example: "I like coding" → CSE/AIML, "I like electronics" → ECE, "I like machines" → MECH, "I like construction" → CIVIL.`,
    bullets: DEPTS.map((d) => `**${d.code}** — ${d.name} (avg ${d.avg} LPA).`),
  };
}

function deptDetail(_q: string, depts: Dept[], intents: Intent[]): BotAnswer {
  const d = depts[0];
  if (intents.includes("placement"))
    return { text: `**${d.name} (${d.code})** placements at KUCET:`, bullets: [`**Average package:** ${d.avg} LPA.`, `**Highest package:** ${d.high} LPA.`, `**Facilities:** ${d.facilities}.`, `Top recruiters: TCS, Infosys, Wipro, Cognizant, Amazon, Accenture.`] };
  if (intents.includes("faculty"))
    return { text: `The HOD of **${d.name} (${d.code})** is **${d.hod}**.`, bullets: [`Facilities: ${d.facilities}.`, `Student–faculty ratio: 1:15 with assigned mentors.`] };
  if (intents.includes("admission") || intents.includes("chance"))
    return { text: `Admission info for **${d.name} (${d.code})**:`, bullets: [`**Seats:** ${d.seats}.`, `**Closing rank (EAPCET, approx):** ${d.rankLow.toLocaleString("en-IN")}–${d.rankHigh.toLocaleString("en-IN")}.`, `Apply via counseling code **KUCW** (70% convenor + 30% Category-B merit).`] };
  return {
    text: `Here's an overview of **${d.name} (${d.code})** at KUCET:`,
    bullets: [`**HOD:** ${d.hod}.`, `**Seats:** ${d.seats}.`, `**Closing rank:** ${d.rankLow.toLocaleString("en-IN")}–${d.rankHigh.toLocaleString("en-IN")}.`, `**Placements:** avg ${d.avg} LPA, high ${d.high} LPA.`, `**Facilities:** ${d.facilities}.`],
  };
}

/* ---------- static-ish topic blocks (still selected dynamically) ---------- */
const TOPIC: Record<string, BotAnswer> = {
  greeting: { text: `Hi! 👋 I'm the KU College of Engineering & Technology assistant. Ask me anything — admissions, cutoff ranks, fees, hostels, placements, or "can I get CSE with rank 9000?"` },
  admission: { text: `Admissions to KUCET (2026):`, bullets: ["Entrance: **TG EAPCET / JEE Main** (B.Tech), **GATE / TS PGECET** (M.Tech).", "Counseling code: **KUCW** — 70% convenor quota + 30% Category-B merit.", "B.Tech eligibility: 10+2 with PCM, **min 45%** (40% reserved).", "Documents: 10th/12th memos, TC, rank card, ID proof, photos, caste/income certs.", "Window: **Mar 1 – Jun 30, 2026**; counseling ~Jul 20."] },
  fees: { text: `Fee structure (TAFRC regulated):`, bullets: [`**B.Tech:** ${inr(FEES.btech)}/year.`, `**M.Tech:** ${inr(FEES.mtech)}/year.`, `**Hostel + mess:** ${inr(FEES.hostel)}/year.`, `**Exam:** ${inr(FEES.exam)}/semester.`, "Eligible categories get **TS e-Pass** fee reimbursement.", "Pay via SBI Collect, UPI, net banking, or DD."] },
  scholarship: { text: `Scholarships & financial aid at KUCET:`, bullets: ["**TS e-Pass** — 100%/partial tuition reimbursement for SC/ST/BC/EWS/Minority based on rank & income.", "Merit scholarships for top rankers (indicative up to 50% for 95%+).", "Education-loan tie-ups with SBI, HDFC, Axis.", "Share your % or rank and I'll estimate your aid."] },
  hostel: { text: `Hostels & accommodation:`, bullets: ["3 boys' + 2 girls' hostels on campus; **2- and 3-sharing** rooms.", `**Cost:** ${inr(FEES.hostel)}/year including mess (3 meals/day).`, "Wi-Fi, RO water, gym, common rooms, resident medical officer, 24/7 emergency vehicle.", "Girls' hostels: biometric entry, female wardens, 24/7 security.", "Curfew 8:30 PM; strictly anti-ragging."] },
  library: { text: `Central Library & Technical Resource Centre:`, bullets: ["**68,000+ books**, 450+ e-books.", "Journals: **IEEE Xplore, ScienceDirect, SpringerLink, J-Gate**.", "Timings: Mon–Fri **8 AM–8 PM**; weekends 9 AM–4 PM.", "NPTEL archive, DELNET borrowing, self-checkout; 3 books / 15 days."] },
  labs: { text: `Laboratories at KUCET:`, bullets: ["**45+ labs** built to AICTE standards.", "AI & Deep Learning lab (NVIDIA GPUs), **1 Gbps** fiber backbone.", "VLSI & embedded studio, robotics & automation workshop, comms lab.", "Open weekdays + half-day Saturday; extended access with faculty permission."] },
  placement: { text: `Training & Placements:`, bullets: ["**Placement rate: 88%** (2024–25).", "**Highest: Rs. 24 LPA**, **Average: Rs. 6.2 LPA**.", "Recruiters: TCS, Infosys, Wipro, Cognizant, Accenture, Amazon, Bosch, Capgemini.", "300+ hrs training from 2nd year; mandatory 6–8 week internships."] },
  faculty: { text: `Faculty:`, bullets: ["**65+ PhD** faculty + research scholars.", "Student–faculty ratio **1:15** with assigned mentors.", "Research in IEEE/Springer/Elsevier with funded grants."] },
  contact: { text: `Contact KUCET:`, bullets: ["📍 Vidyaranyapuri Campus, Kakatiya University, Warangal, Telangana – 506009.", "📞 +91-870-2458900, +91-98490-12345.", "✉️ info@kucet.ac.in, admissions@kucet.ac.in.", "🕒 Mon–Sat, 9:00 AM – 5:00 PM. Principal: Prof. G. Rajender Reddy."] },
  timings: { text: `Campus timings & calendar:`, bullets: ["Academic: Mon–Fri **9 AM–4:30 PM**; Sat **9 AM–12:40 PM**.", "Library: Mon–Fri 8 AM–8 PM; weekends 9 AM–4 PM.", "Two semesters; exams in Nov–Dec and Apr–May (CBCS)."] },
  sports: { text: `Campus life, sports & clubs:`, bullets: ["400m track, cricket/football/hockey grounds, indoor stadium, gym, yoga hall.", "Annual fest **Synapse**; coding, robotics, cultural, NSS & NCC clubs.", "FSSAI-certified canteens; college buses across Warangal/Hanamkonda/Kazipet."] },
  about: { text: `About KU College of Engineering and Technology (KUCET):`, bullets: ["Affiliated to **Kakatiya University, Warangal** (State University).", "**AICTE approved, NAAC accredited**; established 2006 on a 65-acre campus.", "7 B.Tech branches + M.Tech/MBA/MCA programs.", "Motto: Knowledge, Skill, and Character."] },
  courses: { text: `Programs offered at KUCET:`, bullets: DEPTS.map((d) => `**${d.code}** — ${d.name} (${d.seats} seats).`).concat(["Plus **M.Tech** (CSE, VLSI, Power, Structural, Thermal), **MBA**, **MCA**."]) },
};

/* ---------- main entry ---------- */
export function answerLocally(query: string): BotAnswer {
  const q = query.trim();
  if (!q) return { text: "Ask me anything about KUCET — admissions, fees, hostels, placements, or branch cutoffs!" };

  const intents = scoreIntents(q);
  const depts = findDepts(q);
  const primary = intents[0];

  // reasoning intents first (these COMPOSE answers)
  if (primary === "greeting") return TOPIC.greeting;
  if (intents.includes("compare")) return compareAnswer(q);
  if (intents.includes("chance")) return chanceAnswer(q);
  if (intents.includes("suggest")) return suggestAnswer(q);
  if (intents.includes("cost")) return costAnswer(q);

  // department-specific detail beats a generic topic
  if (depts.length && (intents.includes("placement") || intents.includes("faculty") || intents.includes("admission") || intents.includes("courses") || intents.length === 0)) {
    return deptDetail(q, depts, intents);
  }

  // topic block
  if (primary && TOPIC[primary]) return TOPIC[primary];

  // if only a department was named with no clear intent
  if (depts.length) return deptDetail(q, depts, intents);

  // graceful fallback that still guides the user
  return {
    text: `I want to help with "${q}". I couldn't pin down the exact topic, but here's what I can answer instantly:`,
    bullets: [
      "🎓 Admissions, eligibility & **cutoff ranks** (try: \"can I get CSE with rank 9000?\")",
      "💰 **Fee & cost estimates** (try: \"total cost for B.Tech with hostel and 92%\")",
      "🏠 Hostels, 📚 library, 🔬 labs, 💼 placements, 👨‍🏫 faculty",
      "🔀 Branch comparisons & suggestions (try: \"compare CSE and ECE\").",
    ],
  };
}
