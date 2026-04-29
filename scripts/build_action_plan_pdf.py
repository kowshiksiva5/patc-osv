from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "patc_osv_action_plan.pdf"
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
        title="PATC OSV One-Year Action Plan",
        author="PATC Labs",
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
        para("PATC - One-Year Action Plan for Probabilistic Adaptive Traffic Control", title),
        para("<b>Goal.</b> Build a shadow-mode adaptive traffic control system for one Bangalore junction: observe live queues, estimate uncertainty, simulate the next cycles, and recommend explainable green-time changes before live actuation.", body),
        para("<b>Current proof package.</b> Bangalore junction observations, rejected fixed-time-only prototypes, a SUMO baseline, queue-estimation tests, and a failure log, each linked to notes, screenshots, notebooks, or demo outputs.", body),
        para("Why this team", section),
        para("The team combines industrial validation discipline with embedded/software execution. One founder is an IIT Hyderabad mechanical engineer with heavy-industry validation/testing experience across large industrial systems; the other is an electronics/software engineer with roughly 3 years building embedded, sensing, and software projects.", body),
        para("12-month build plan", section),
    ]

    plan_rows = [
        ["Months 1-2", "Lock one junction from the existing shortlist; collect 40-60 hours of observations/video/manual counts; document phase plan, queue buildup, empty-green waste, and rain/night failure cases."],
        ["Months 3-4", "Calibrate a one-junction simulator that predicts queue growth under uncertain arrivals and tests recommendations against fixed-time baselines."],
        ["Months 5-6", "Launch shadow-mode dashboard: phase, queue estimate, confidence, recommended action, reason, safety constraint, and fallback condition."],
        ["Months 7-9", "Run validation: sensor-noise tests, demand variation, spillback scenarios, delay analysis, and a public one-junction report."],
        ["Months 10-12", "Build embedded prototype and hardware-in-loop mock controller; prepare pilot protocol, operator workflow, and traffic-department briefing."],
    ]
    table = Table(
        [[para(a, title), para(b, body)] for a, b in plan_rows],
        colWidths=[1.14 * inch, 6.72 * inch],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Arial"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("LEADING", (0, 0), (-1, -1), 16.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#D5CEC0")),
            ]
        )
    )
    story.append(table)
    story.extend(
        [
            para("Cost overview for the fellowship year", section),
            para(
                "If awarded full fellowship funding: two-founder runway/focused build time ($50k); data collection and annotation ($14k); cameras, edge devices, mock controller, mounting, and test equipment ($12k); cloud/simulation/tooling ($8k); partner meetings, compliance, and pilot documentation ($8k); contingency ($8k).",
                body,
            ),
            para("Milestone outputs", section),
            para(
                "By year end: one annotated junction dataset, calibrated simulator, public dashboard demo, mock-controller demo, and validation report targeting 15-25% empty-green reduction, 10-15% queue/wait reduction, and zero safety-rule violations in shadow-mode tests.",
                body,
            ),
            para("Failure discipline", section),
            para(
                "This fails if it becomes a black-box demo operators cannot trust, if data access is too weak, if official signal access is not possible within the fellowship year, or if local optimization worsens downstream flow. Mitigation: stay in shadow mode first, publish baselines, show confidence, keep manual override, and prove one junction before citywide claims.",
                body,
            ),
        ]
    )

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
