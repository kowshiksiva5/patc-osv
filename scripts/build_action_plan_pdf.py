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
        rightMargin=0.36 * inch,
        leftMargin=0.36 * inch,
        topMargin=0.32 * inch,
        bottomMargin=0.3 * inch,
        title="PATC One-Year Timeline and Cost",
        author="PATC",
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body11",
        parent=styles["BodyText"],
        fontName="Arial",
        fontSize=11,
        leading=16.5,
        textColor=colors.HexColor("#17212B"),
        spaceAfter=5,
    )
    title = ParagraphStyle(
        "Title11",
        parent=body,
        fontName="Arial-Bold",
        fontSize=11,
        leading=16.5,
        spaceAfter=6,
    )
    section = ParagraphStyle(
        "Section11",
        parent=body,
        fontName="Arial-Bold",
        fontSize=11,
        leading=16.5,
        textColor=colors.HexColor("#0F5E64"),
        spaceBefore=6,
        spaceAfter=3,
    )

    story = [
        para("One-Year Timeline and Cost", title),
        para("<b>Target.</b> Convert PATC from early observations and concept work into a validated shadow-mode adaptive traffic-control prototype for one Bengaluru corridor/sector: field data, labeled dataset, calibrated simulation, recommendation engine, dashboard, mock controller, safety notes, and pilot-readiness package.", body),
        para("12-month build schedule", section),
    ]

    plan_rows = [
        ["M1", "Select one corridor/sector with 4-6 connected signals; define target metrics, observation protocol, baseline plans, and stakeholder interview list."],
        ["M1-3", "Collect 120-180 field observation hours across peak, off-peak, rain/night, weekday/weekend, school/office cycles, and seasonal variation."],
        ["M2-4", "Label 80-120 observation/video sessions: queue length, discharge rate, spillback, empty-green, phase state, pedestrian conflict, anomaly tags."],
        ["M3-5", "Complete 25-35 stakeholder interviews with commuters, traffic police/operators where accessible, local businesses, civic/ITS reviewers."],
        ["M4-7", "Build estimator and simulator: queue pressure, arrival forecast, discharge model, confidence score, SUMO corridor model, fixed-time baseline."],
        ["M7-10", "Build and validate shadow recommender: timing/offset action, reason, expected effect, fallback trigger; run 300-500 scenario tests."],
        ["M10-12", "Package pilot readiness: dashboard, mock controller, safety/fallback playbook, validation report, stakeholder deck, next-year pilot memo."],
    ]
    table = Table(
        [[para(a, title), para(b, body)] for a, b in plan_rows],
        colWidths=[0.68 * inch, 6.87 * inch],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Arial"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("LEADING", (0, 0), (-1, -1), 16.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#D5CEC0")),
            ]
        )
    )
    story.append(table)
    story.extend(
        [
            para("Cost overview - $100k requested", section),
        ]
    )

    cost_rows = [
        ["Builder runway", "$38k", "12 months lean full-time build focus and structured technical/field execution support."],
        ["Field data collection", "$14k", "120-180 observation hours, local travel, junction visits, repeat rain/night/peak coverage."],
        ["Labeling and dataset QA", "$12k", "80-120 labeled sessions with queue, flow, spillback, phase, pedestrian, anomaly labels."],
        ["Simulation/model engineering", "$10k", "SUMO setup, calibration, scenario generation, experiment tracking, validation tooling."],
        ["Prototype/demo setup", "$9k", "Mock-controller sandbox, replay tools, demo dashboard integration, capture workflow, local test setup."],
        ["Stakeholder/pilot prep", "$7k", "25-35 interviews, demos, operator workflow, documentation, local coordination."],
        ["Cloud/dashboard", "$4k", "Hosting, backups, video/data storage, dashboard/demo environment."],
        ["Safety/legal/review", "$3k", "Safety/fallback review, deployment-readiness notes, consent/admin material."],
        ["Contingency", "$3k", "Extra data gaps, repeat observations, unexpected field/demo costs."],
    ]
    cost_table = Table(
        [[para(a, title), para(b, title), para(c, body)] for a, b, c in cost_rows],
        colWidths=[2.0 * inch, 0.58 * inch, 4.97 * inch],
        hAlign="LEFT",
    )
    cost_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Arial"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("LEADING", (0, 0), (-1, -1), 16.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#D5CEC0")),
            ]
        )
    )
    story.append(cost_table)

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
