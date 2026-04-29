# PATC Company Site

Static public company site for PATC, including a dark corridor-coordination product visual and the OSV-required one-page action-plan PDF.

## Run Locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Build PDF

Use a Python environment with `reportlab` installed, then run:

```bash
python3 scripts/build_action_plan_pdf.py
```

The generated action plan is written to `output/pdf/patc_osv_action_plan.pdf`.
