# PATC Company Site

Static public company site for PATC. The homepage is a native product surface for sector-level adaptive traffic intelligence, with a linked shadow-mode simulation artifact and a generated one-page timeline/cost PDF used outside the public site.

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

The generated timeline/cost PDF is written to `output/pdf/patc_timeline_cost.pdf`.
