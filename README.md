# PATC Company Site

Static public company site for PATC plus the OSV-required one-page action-plan PDF.

## Run Locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Build PDF

```bash
python3 -m pip install reportlab pymupdf
python3 scripts/build_action_plan_pdf.py
```

The generated action plan is written to `output/pdf/patc_osv_action_plan.pdf`.
