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
REQUEST_OUTPUT = ROOT / "output" / "pdf" / "patc_m1_traffic_police_request.pdf"
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
        fontSize=8.25,
        leading=9.75,
        textColor=colors.HexColor("#17212B"),
        spaceAfter=3,
    )
    title = ParagraphStyle(
        "Title11",
        parent=body,
        fontName="Arial-Bold",
        fontSize=10.4,
        leading=11.6,
        spaceAfter=3,
    )
    section = ParagraphStyle(
        "Section11",
        parent=body,
        fontName="Arial-Bold",
        fontSize=8.8,
        leading=10.2,
        textColor=colors.HexColor("#0F5E64"),
        spaceBefore=4,
        spaceAfter=2,
    )

    story = [
        para("PATC 12-Month Pilot Build Plan and Budget", title),
        para("<b>Target.</b> Build a replay-first, shadow-mode pilot for the already-selected HSR / Silk Board / Bommanahalli connected-signal corridor. The 12 months fund detailed field mapping, permission work, camera/sensor procurement, temporary observation setup, sustained data collection, labeling, weather/event context, AI + traffic-flow calibration, dashboarding, and authority-ready pilot evidence. No signal-controller writes are assumed in this phase.", body),
        para("12-month build schedule", section),
    ]

    plan_rows = [
        ["M1", "Detailed mapping of the finalized HSR / Silk Board / Bommanahalli sector. Mark existing traffic cameras, signal heads, phase groups, stop lines, pedestrian crossings, footpaths, bus stops, turn pockets, choke points, blind spots, safe mounting points, and missing details not visible from Google Maps. Lock sensor map and bill of materials."],
        ["M2", "Run Bengaluru Traffic Police / jurisdiction permission path, privacy notice plan, vendor quotes, procurement, and existing ATCS benchmark map. By month end, order or receive the temporary cameras/sensors, mounts, storage, power backup, signage, and weather protection needed for field setup."],
        ["M3", "Place and calibrate the allowed temporary setup: 6-8 camera/viewpoint positions, timestamps, phase-observation workflow, safe observer points, data storage, power checks, device security, privacy notice placement, and dry-run collection."],
        ["M4-6", "Collect sustained data across AM peak, PM peak, off-peak, weekend, night, rain, school-release, office surge, and disruption windows. Keep more time here because seasonal variation, rain, events, and roadwork can change the same corridor. Target 180-220 clean site-hours."],
        ["M5-7", "Run manual + automated labeling: queue length, discharge, spillback, blocked turns, pedestrian conflict, bus-stop friction, phase state, and anomaly notes. Join weather, holiday, event, roadwork, and ATCS-change metadata; QA requires repeated human review."],
        ["M7-8", "Build cleaned dataset v1, observed/fixed-time baseline replay, and calibrated models for saturation flow, queue accumulation, discharge, startup loss, spillback, downstream blockage risk, and mixed-traffic uncertainty."],
        ["M8-9", "Build PATC shadow recommender and dashboard: timeline, queue/discharge charts, weather/event overlays, recommendation reason, confidence, rejected actions, fallback trigger, and audit log. No operator action or controller writes."],
        ["M9-11", "Run extended shadow-mode soak during live observation windows. Compare PATC recommendations with observed outcomes and baseline timing across rain, incidents, stale data, manual override, and downstream-blockage cases."],
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
                ("FONTSIZE", (0, 0), (-1, -1), 8.25),
                ("LEADING", (0, 0), (-1, -1), 9.75),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4),
                ("TOPPADDING", (0, 0), (-1, -1), 0.4),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#D5CEC0")),
            ]
        )
    )
    story.append(table)
    story.extend(
        [
            para("Cost overview - USD 75k grant ask / USD 95k tracked pilot", section),
            para("<b>Budget assumption.</b> Amounts below are in USD, not INR lakhs. The grant ask is planned at USD 75k. The full tracked pilot is roughly USD 95k after adding founder/in-kind support for unpaid build time, coordination, and reusable equipment. The budget is intentionally grouped into practical work packages instead of over-splitting permissions, cameras, calibration, labeling, and software into inflated-looking standalone buckets.", body),
        ]
    )

    cost_rows = [
        ["Founder/in-kind", "USD 20k", "Not part of the grant ask: founder build time, coordination, reusable devices, civic preparation, and runway tracked as matching support."],
        ["Field sensing setup", "USD 20k", "Temporary cameras/viewpoints, mounts, edge storage, power backup, weather protection, installation help where allowed, timestamp calibration, and replacements."],
        ["Data collection", "USD 16k", "Repeated site visits and observer shifts across AM/PM peaks, off-peak, weekend, night, rain, school-release, office surge, and disruption windows."],
        ["Labeling + validation", "USD 11k", "Manual plus automated labeling, inter-rater checks, queue/discharge/spillback/anomaly validation, and correction passes."],
        ["Model + dashboard", "USD 9k", "Traffic-flow calibration, replay simulator, shadow recommender, dashboard, audit log, holdout evaluation, and demo hosting."],
        ["Civic + privacy", "USD 7k", "Detailed sector mapping, Bengaluru Traffic Police / jurisdiction meetings, ATCS benchmark review, admin/legal/privacy prep, and reviewer material."],
        ["Cloud + reserve", "USD 12k", "Encrypted storage, backups, weather/event metadata, local travel, repeat observations after bad data/weather, equipment failure, and seasonal re-collection buffer."],
    ]
    cost_table = Table(
        [[para(a, title), para(b, title), para(c, body)] for a, b, c in cost_rows],
        colWidths=[1.46 * inch, 0.78 * inch, 5.48 * inch],
        hAlign="LEFT",
    )
    cost_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Arial"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.25),
                ("LEADING", (0, 0), (-1, -1), 9.75),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4),
                ("TOPPADDING", (0, 0), (-1, -1), 0.4),
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
            para("Selected sector: HSR / Silk Board / Bommanahalli connected-signal corridor, chosen after comparing multiple Bengaluru options. Permission matrix: Bengaluru Traffic Police Traffic Management Centre or jurisdictional traffic station for observation intimation; BBMP/DULT coordination only if public-space installation or roadwork coordination requires it. If install permission is not available by M2, scope narrows to no-install public-observation evidence and the team does not claim full AI+math calibration readiness.", body),
            para("Fallback and privacy", section),
            para("Default data mode is aggregate observation: manual counts, phase notes, queue sketches, and processed labels. If short QA clips are permitted, raw pre-blur clips stay on-device or encrypted storage, school-release windows are excluded unless explicitly approved, access is logged, a grievance contact is listed in field notices, and clips are deleted or converted to aggregate labels within 30 days. No face, plate, identity, enforcement, or live-control pipeline is part of year one.", body),
            para("Acceptance criteria", section),
            para("M2 pass: permission/no-objection path, privacy workflow, exact sensor map, vendor orders, and existing-ATCS benchmark are clear; otherwise scope is formally reduced. M6 pass: 180+ usable site-hours or a narrower 2-3 junction dataset with stated gaps. M9 pass: labels and baseline replay are stable enough for shadow mode. M11 pass: 60+ clean shadow hours with zero critical unsafe recommendations, where unsafe means violating minimum-green, pedestrian, emergency, stale-data, manual-override, or downstream-blockage constraints. M12 pass: dashboard demo, dataset summary, safety case, privacy process, ATCS comparison, and authority-ready supervised-pilot request.", body),
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
        title="PATC M1 Traffic Police Observation Request Draft",
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
        para("Bengaluru Traffic Police signal operations / jurisdictional traffic reviewer for roadside observation intimation. BBMP/DULT are coordination dependencies only if road works, junction geometry, or public-space use requires them.", body),
        para("Selected sector", subhead),
        para("Silk Board to HSR/Bommanahalli connected-signal sector. Public-redacted approximate points: Silk Board main junction (~12.9177, 77.6238), HSR approach (~12.912, 77.641), Bommanahalli approach (~12.908, 77.623), downstream queue point withheld for private packet. The sector was selected after comparing multiple Bengaluru options; this request is for observation guidance, not corridor selection.", body),
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
