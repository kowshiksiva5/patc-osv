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
        para("One-Year Action Plan: Timeline and Cost", title),
        para("<b>Completion target.</b> A field-ready shadow-mode traffic intelligence pilot: one Bengaluru junction as the first controlled testbed, one annotated dataset, calibrated simulator, recommendation dashboard, mock signal-controller demo, and validation report. This is the proof step before any live-road control rollout.", body),
        para("12-month timeline", section),
    ]

    plan_rows = [
        ["Months 1-2", "Select one Bengaluru junction, collect/manual-label traffic observations, and document signal phases, empty-green waste, queue spillback, rain/night issues, and pedestrian conflicts."],
        ["Months 3-4", "Build fixed-time baseline simulator and queue-estimation prototype with confidence scores; test changing arrivals, blockage, and sensor-noise cases."],
        ["Months 5-6", "Build probabilistic timing recommendation engine: queue estimate, confidence score, timing recommendation, reason, expected effect, and fallback trigger."],
        ["Months 7-8", "Build shadow-mode dashboard and mock signal-controller demo; compare recommendations against observed signal cycles with no live-road authority or signal-control dependency."],
        ["Months 9-10", "Run shadow tests, compare against fixed-time baseline, and refine using demand variation, camera-noise tests, rain/night robustness, and failure logs."],
        ["Months 11-12", "Produce validation report, pilot-readiness package, safety/fallback documentation, deployment checklist, stakeholder briefing, and repeatable rollout template for more junctions and other cities."],
    ]
    table = Table(
        [[para(a, title), para(b, body)] for a, b in plan_rows],
        colWidths=[1.12 * inch, 6.74 * inch],
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
            para("Cost overview", section),
        ]
    )

    cost_rows = [
        ["Founder execution runway", "$55k", "If awarded full fellowship funding: runway for Kowshik full-time execution and Sidvik's structured field, validation, safety, and deployment support."],
        ["Traffic data and labeling", "$12k", "Junction visits, video/manual counts, annotation, and repeat observations across peak, rain, and night cases."],
        ["Prototype hardware", "$10k", "Cameras, edge device, mock controller, relay board, mounts, power/network test equipment."],
        ["Simulation and cloud", "$8k", "SUMO experiments, storage, dashboard hosting, experiment tracking, backups, and compute."],
        ["Pilot preparation", "$7k", "Local travel, stakeholder meetings, operator workflow, and pilot-readiness package."],
        ["Safety/admin", "$5k", "Fallback documentation, validation review, legal/admin, and deployment-readiness materials."],
        ["Contingency", "$3k", "Hardware replacement, extra observations, data gaps, and stakeholder-demo costs."],
    ]
    cost_table = Table(
        [[para(a, title), para(b, title), para(c, body)] for a, b, c in cost_rows],
        colWidths=[2.05 * inch, 0.72 * inch, 5.09 * inch],
        hAlign="LEFT",
    )
    cost_table.setStyle(
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
    story.append(cost_table)
    story.append(
        para(
            "<b>Budget assumption.</b> The full $100k fellowship compresses a year of validation. A smaller grant would fund a narrower data/prototype slice but would not buy the same full-time execution runway.",
            body,
        )
    )

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
