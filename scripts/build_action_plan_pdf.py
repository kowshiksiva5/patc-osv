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
        para("<b>Target.</b> Build a replay-first, shadow-mode pilot for one Bengaluru connected-junction sector around the HSR / Silk Board / Bommanahalli corridor. The 12 months fund permission work, baseline stabilization, temporary camera/sensor setup, sustained field data, labeling, weather/event context, AI + traffic-flow calibration, dashboarding, and authority-ready pilot evidence. No signal-controller writes are assumed in this phase.", body),
        para("12-month build schedule", section),
    ]

    plan_rows = [
        ["M1", "Confirm the first-choice 4-6 signal HSR/Silk Board-Bommanahalli sector only after a baseline-stability check for recent flyover/ramp and signal-pattern shifts. Map lane groups, phases, pedestrian crossings, bus stops, choke points, current ATCS context, and camera/sensor positions."],
        ["M2", "Run BTP/jurisdiction permission path, privacy notice plan, and existing ATCS benchmark/integration map. If install permission is not viable, narrow scope to public-observation decision support instead of pretending full model calibration is possible."],
        ["M3", "Execute site survey and temporary setup where allowed: 6-8 camera/viewpoint positions, timestamps, phase observation method, safe observer points, weather protection, storage workflow, signage/notice, and device security."],
        ["M4-6", "Collect sustained data across AM peak, PM peak, off-peak, weekend, night, rain, school-release, office surge, and disruption windows. Target 180-220 clean site-hours, with re-collection after major road/signal changes."],
        ["M5-7", "Run manual + automated labeling loop: queue length, discharge, spillback, blocked turns, pedestrian conflict, bus-stop friction, phase state, and anomaly notes. Join weather, holiday, event, roadwork, and ATCS-change metadata."],
        ["M7-8", "Build cleaned dataset v1, fixed-time/observed baseline replay, and calibrated models for saturation flow, queue accumulation, discharge, startup loss, spillback, and downstream blockage risk."],
        ["M8-9", "Build PATC shadow recommender and dashboard: timeline, queue/discharge charts, weather/event overlays, recommendation reason, confidence, rejected actions, fallback trigger, and audit log."],
        ["M9-11", "Run extended live shadow-mode soak during observation windows. The system recommends in real time without operator action or controller writes; coverage must include rain, incidents, stale-data, manual-override, and downstream-blockage cases."],
        ["M11-12", "Run stakeholder review loops and package evidence: dataset summary, ATCS benchmark, model limits, unsafe-case log, privacy handling, installation learnings, safety playbook, and supervised-pilot request."],
    ]
    table = Table(
        [[para(a, title), para(b, body)] for a, b in plan_rows],
        colWidths=[0.66 * inch, 7.06 * inch],
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
            para("<b>Budget assumption.</b> The budget funds one connected-junction sector through replay-only pilot readiness. The largest cost is field truth: permission work, temporary cameras/viewpoints, observer shifts, labeling, QA, privacy handling, weather/event metadata, existing-ATCS benchmarking, model calibration, and repeat collection. Amounts are planning estimates and include contingency for permission delays, traffic-pattern shifts, bad weather, equipment failure, and extra labeling.", body),
        ]
    )

    cost_rows = [
        ["Founders", "$18k", "Two-founder runway for model, dashboard, field ops, civic review, and pilot-packet work while most grant spend funds field-heavy execution."],
        ["Permits", "$10k", "BTP/jurisdiction meetings, ATCS benchmark review, admin/legal/privacy prep, reviewer material, pilot request packet, and local travel."],
        ["Capture kit", "$17k", "6-8 temporary camera/viewpoint positions, mounts, edge storage, power backup, weather protection, signage/notice, security, replacements."],
        ["Field ops", "$15k", "Observer shifts, repeated site visits, peak/off-peak/night/rain/weekend windows, safety coordination, and collection logs."],
        ["Label QA", "$13k", "250-350 annotation/QA hours, inter-rater checks, model-assisted correction, queue/discharge/spillback/anomaly validation."],
        ["Metadata", "$4k", "Weather feeds, event/holiday/roadwork annotation, metadata cleanup, and joining external context into replay sessions."],
        ["Model", "$9k", "AI measurement pipeline, traffic-flow calibration, replay simulator, holdout evaluation, and scenario library."],
        ["Dashboard", "$5k", "Replay UI, dashboard prototype, hosting, encrypted storage, backups, audit logs, and demo environment."],
        ["Safety", "$4k", "Live non-actuating tests, validation analysis, unsafe-case review, safety playbook, and final evidence report."],
        ["Reserve", "$5k", "Permission delays, repeat observations after bad data/weather, equipment failure, extra labeling, and admin overruns."],
    ]
    cost_table = Table(
        [[para(a, title), para(b, title), para(c, body)] for a, b, c in cost_rows],
        colWidths=[1.28 * inch, 0.46 * inch, 5.98 * inch],
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
            para("M1-M2 permission packet", section),
            para("First-choice sector: HSR / Silk Board / Bommanahalli connected-signal sector, with ORR Bellandur and Whitefield/ITPL as backups. Permission matrix: BTP Traffic Management Centre or jurisdictional traffic station for observation intimation; BBMP/DULT coordination only if public-space installation or roadwork coordination requires it. If no install permission is available by M2, scope narrows to no-install decision-support evidence and the team does not claim full AI+math calibration readiness.", body),
            para("Fallback and privacy", section),
            para("Default data mode is aggregate observation: manual counts, phase notes, queue sketches, and processed labels. If short QA clips are permitted, raw pre-blur clips stay on-device or encrypted storage, school-release windows are excluded unless explicitly approved, access is logged, a grievance contact is listed in field notices, and clips are deleted or converted to aggregate labels within 30 days. No face, plate, identity, enforcement, or live-control pipeline is part of year one.", body),
            para("Acceptance criteria", section),
            para("M2 pass: permission/no-objection path, privacy workflow, and existing-ATCS benchmark are clear; otherwise scope is formally reduced. M6 pass: 180+ usable site-hours or a narrower 2-3 junction dataset with stated gaps. M9 pass: labels and baseline replay are stable enough for shadow mode. M11 pass: 60+ clean shadow hours with zero critical unsafe recommendations, where unsafe means violating minimum-green, pedestrian, emergency, stale-data, manual-override, or downstream-blockage constraints. M12 pass: dashboard demo, dataset summary, safety case, privacy process, ATCS comparison, and authority-ready supervised-pilot request. If replay cannot improve labeled fixed-time/observed baselines by at least 10% on delay or residual queue, pivot to dataset and decision-support tooling.", body),
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
        para("<b>Date:</b> 30 Apr 2026<br/><b>To:</b> Bengaluru Traffic Police Traffic Management Centre / jurisdictional traffic police station for Silk Board-HSR/Bommanahalli<br/><b>From:</b> PATC application team (named contacts in application packet)<br/><b>Status:</b> Not sent. Prepared as the first civic artifact for a replay-only validation pilot.", body),
        para("Recipient role", subhead),
        para("BTP signal operations / jurisdictional traffic reviewer for roadside observation intimation. BBMP/DULT are coordination dependencies only if road works, junction geometry, or public-space use requires them.", body),
        para("First-choice sector", subhead),
        para("Silk Board to HSR/Bommanahalli 4-6 signal sector. Public-redacted approximate points: Silk Board main junction (~12.9177, 77.6238), HSR approach (~12.912, 77.641), Bommanahalli approach (~12.908, 77.623), downstream queue point withheld for private packet. Backup sectors: ORR Bellandur and Whitefield/ITPL.", body),
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
