from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "patc_timeline_cost.pdf"
REQUEST_OUTPUT = ROOT / "output" / "pdf" / "patc_m1_btp_request.pdf"
ARIAL = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
ARIAL_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Arial", str(ARIAL)))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(ARIAL_BOLD)))


def para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def build_pdf() -> None:
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=0.22 * inch,
        leftMargin=0.22 * inch,
        topMargin=0.18 * inch,
        bottomMargin=0.18 * inch,
        title="PATC One-Year Timeline and Cost",
        author="PATC",
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body11",
        parent=styles["BodyText"],
        fontName="Arial",
        fontSize=8.6,
        leading=10.4,
        textColor=colors.HexColor("#17212B"),
        spaceAfter=5,
    )
    title = ParagraphStyle(
        "Title11",
        parent=body,
        fontName="Arial-Bold",
        fontSize=10.8,
        leading=12.0,
        spaceAfter=3,
    )
    section = ParagraphStyle(
        "Section11",
        parent=body,
        fontName="Arial-Bold",
        fontSize=9.2,
        leading=10.8,
        textColor=colors.HexColor("#0F5E64"),
        spaceBefore=6,
        spaceAfter=3,
    )

    story = [
        para("PATC 12-Month Pilot Build Plan and Budget", title),
        para("<b>Target.</b> Build a validated shadow-mode traffic-intelligence prototype for one Bengaluru connected-junction sector: field dataset, calibrated replay simulator, LWR-inspired density/flow calibration, expected-state startup-loss filter, recommendation engine, operator dashboard, safety playbook, and pilot-readiness package. The project period is data-first and replay-first; no field-controller writes are assumed.", body),
        para("12-month build schedule", section),
    ]

    plan_rows = [
        ["M1-2", "Select one 4-6 signal sector; log BTP/jurisdictional intimation; map geometry, phases, timings, observation protocol, admin needs, and success metrics."],
        ["M2-5", "Collect 180-240 clean site-hours across peak, off-peak, rain/night, weekday/weekend, school release, event surge, and seasonal variation."],
        ["M2-6", "Label 120-160 sessions for queue length, discharge, spillback, empty-green, phase state, pedestrian conflict, blockage, and anomalies, with inter-rater QA."],
        ["M3-6", "Build baseline replay: cleaned data pipeline, fixed-time baseline, LWR-inspired density calibration, expected-state startup-loss calibration, and scenario library."],
        ["M5-8", "Build shadow recommender: pressure score, Pi_m-corrected discharge, downstream risk check, action reason, confidence, and fallback trigger."],
        ["M7-10", "Build dashboard and mock-controller sandbox: replay timeline, recommendation log, before/after view, override notes, and validation traces."],
        ["M9-12", "Run 500-700 replay/simulation tests, seasonal holdout checks, rain/event stress tests, validation report, safety playbook, and pilot memo."],
    ]
    table = Table(
        [[para(a, title), para(b, body)] for a, b in plan_rows],
        colWidths=[0.52 * inch, 7.2 * inch],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Arial"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.6),
                ("LEADING", (0, 0), (-1, -1), 10.4),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.8),
                ("TOPPADDING", (0, 0), (-1, -1), 0.8),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#D5CEC0")),
            ]
        )
    )
    story.append(table)
    story.extend(
        [
            para("Cost overview - $100k requested", section),
            para("<b>Budget assumption.</b> The budget funds one connected-junction sector through replay-only pilot readiness. Rates are planning assumptions: $70 per clean site-hour includes two observers, $75/session includes labeling plus QA, and $8/test is compute/analysis amortization; M1 includes two local quote checks before spend.", body),
        ]
    )

    cost_rows = [
        ["Founder runway", "$30k", "2 builders x $1.25k/month x 12 = $30k. Gate: model, dashboard, field ops, pilot packet."],
        ["Field operations", "$16k", "200 hrs x $70 = $14k + $2k capture supplies. Gate: peak/rain/night/weekend observer logs."],
        ["Labeling and dataset QA", "$13k", "150 sessions x $75 = $11.25k + $1.75k QA. Gate: queue, flow, phase, spillback, anomaly tags."],
        ["Simulation tooling", "$10k", "$4k replay/SUMO + $3k calibration + $3k tracking. Gate: baseline, LWR-inspired, and startup-loss traces."],
        ["Dashboard prototype", "$8k", "$6k UI/replay tooling + $2k demo capture. Gate: log, before/after view, mock-controller sandbox."],
        ["Testing and validation", "$8k", "600 replay tests x $8 = $4.8k + $3.2k analysis/reporting. Gate: holdout baseline report."],
        ["Civic/pilot prep", "$5k", "25 reviews x $120 = $3k + $2k materials. Gate: BTP request, permission path, pilot workflow."],
        ["Cloud and storage", "$3k", "$1.2k hosting + $1k processed datasets + $0.8k backups/observability. No raw video by default."],
        ["Travel and contingency", "$7k", "$250/month travel = $3k + $2k repeat observations + $2k admin/demo contingency."],
    ]
    cost_table = Table(
        [[para(a, title), para(b, title), para(c, body)] for a, b, c in cost_rows],
        colWidths=[1.5 * inch, 0.46 * inch, 5.76 * inch],
        hAlign="LEFT",
    )
    cost_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Arial"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.6),
                ("LEADING", (0, 0), (-1, -1), 10.4),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.8),
                ("TOPPADDING", (0, 0), (-1, -1), 0.8),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#D5CEC0")),
            ]
        )
    )
    story.append(cost_table)
    story.extend(
        [
            para("M1 pilot packet", section),
            para("First-choice sector: Silk Board to HSR/Bomanahalli, with ORR Bellandur and Whitefield/ITPL as backups. Permission matrix: BTP Traffic Management Centre or jurisdictional traffic station for observation intimation; BBMP/DULT coordination only if required; no response by M2 means lawful public manual counts only. Sample shadow recommendation to validate: extend E/W green by 8s only if replay residual queue drops 118m -> 82m and fallback rules stay clear.", body),
            para("Fallback, privacy, and funding tiers", section),
            para("Fallback scopes the first $8k: if permission is logged by M2, use it for setup, 40-60 clean site-hours, first labels, and stakeholder reviews; if not, cap formal-permission work at $2k and shift $4k to public manual counts. Data mode A: no raw video. Data mode B, only if needed: disabled for school-release windows; raw pre-blur clips never leave device; visible observer notice/contact where practical; encrypted storage, access log, and 30-day deletion proof. At $50k ship dataset+replay; $75k adds dashboard; $100k adds full validation packet.", body),
            para("Acceptance criteria", section),
            para("M3: sector selected, baseline timings mapped, first 40-60 clean site-hours complete. M6 pass: queue MAE <=15m or <=20%, delay MAPE <=25%. M9 pass: N>=120 holdout sessions and zero critical unsafe recommendations, where unsafe means violating min-green, pedestrian, emergency, stale-data, or downstream-blockage constraints. M12: validation report, safety playbook, dashboard demo, and authority-ready pilot memo. If M6 replay cannot beat fixed-time delay or residual queue by at least 10% on labeled data, pivot to dataset/tooling.", body),
        ]
    )

    doc.build(story)


def build_request_pdf() -> None:
    register_fonts()
    REQUEST_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(REQUEST_OUTPUT),
        pagesize=A4,
        rightMargin=0.42 * inch,
        leftMargin=0.42 * inch,
        topMargin=0.42 * inch,
        bottomMargin=0.42 * inch,
        title="PATC M1 BTP Observation Request Draft",
        author="PATC",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("ReqBody", parent=styles["BodyText"], fontName="Arial", fontSize=10.5, leading=14)
    heading = ParagraphStyle("ReqHeading", parent=body, fontName="Arial-Bold", fontSize=14, leading=17, spaceAfter=8)
    subhead = ParagraphStyle(
        "ReqSubhead",
        parent=body,
        fontName="Arial-Bold",
        textColor=colors.HexColor("#0F5E64"),
        spaceBefore=7,
    )
    story = [
        para("PATC M1 Observation Permission Request - Draft", heading),
        para("<b>Date:</b> 30 Apr 2026<br/><b>To:</b> Bengaluru Traffic Police Traffic Management Centre / jurisdictional traffic police station for Silk Board-HSR/Bomanahalli<br/><b>From:</b> PATC application team (named contacts in application packet)<br/><b>Status:</b> Not sent. Prepared as the first civic artifact for a replay-only validation pilot.", body),
        para("Recipient role", subhead),
        para("BTP signal operations / jurisdictional traffic reviewer for roadside observation intimation. BBMP/DULT are coordination dependencies only if road works, junction geometry, or public-space use requires them.", body),
        para("First-choice sector", subhead),
        para("Silk Board to HSR/Bomanahalli 4-6 signal sector. Public-redacted approximate points: Silk Board main junction (~12.9177, 77.6238), HSR approach (~12.912, 77.641), Bomanahalli approach (~12.908, 77.623), downstream queue point withheld for private packet. Backup sectors: ORR Bellandur and Whitefield/ITPL.", body),
        para("Request", subhead),
        para("Permission or written/no-objection guidance for no-install roadside observation on proposed windows: weekday AM peak 8:00-10:00, weekday PM peak 5:30-7:30, weekend 11:00-1:00, and one rain/night repeat. The team records aggregate queue length, discharge, spillback, phase timing, and anomaly notes for replay validation only.", body),
        para("Observer safety checklist", subhead),
        para("Observers remain on public footpaths or safe public edges, use no road-facing obstruction, do not interact with signal cabinets, stop during police instruction or unsafe crowding, and keep one remote contact available during each window.", body),
        para("Privacy and retention", subhead),
        para("Default mode is no raw video: manual counts, phase notes, queue sketches, and aggregate labels. If short clips are needed for QA, Mode B is disabled for school-release windows; raw pre-blur clips never leave the capture device; visible observer notice/contact is used where practical; any privacy complaint deletes the clip immediately. Approved clips are blurred, encrypted, access-logged, retained for at most 30 days, then converted to aggregate labels or deleted with proof. No face, plate, identity, enforcement, or live-control pipeline.", body),
        para("Approval or denial path", subhead),
        para("If approved or acknowledged, run the four observation windows and return a one-page summary. If denied or no response by M2, proceed only with lawful no-install public-road manual counts and remove any agency-data dependency from the pilot plan.", body),
        para("Safety boundary", subhead),
        para("No controller writes, no field hardware, no signal timing changes, and no operational recommendation to operators during M1. Output is a replay dataset and validation memo.", body),
        para("Deliverable back to reviewer", subhead),
        para("One-page observation summary, labeled sample dataset, replay screenshot, baseline timing notes, and list of risks before any pilot-control discussion.", body),
    ]
    doc.build(story)


if __name__ == "__main__":
    build_pdf()
    build_request_pdf()
