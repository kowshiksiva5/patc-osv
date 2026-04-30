# PATC Company Site

Static public company site for PATC, Probabilistic Adaptive Traffic Control.

The site is split into focused pages so the homepage stays fast:

- `index.html`: problem, public benefit, safety boundary, and links.
- `simulation.html`: lightweight multi-vehicle sector replay.
- `math.html`: model explanation, formulas, term notes, and references.
- `assets/site.css`: shared visual system.
- `assets/technical.css`: simulation and math page styles.
- `assets/light-sim.js`: sector replay logic.
- `output/pdf/patc_timeline_cost.pdf`: timeline and cost one-pager.

## Run Locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Build Artifacts

Use a Python environment with `reportlab` installed, then run:

```bash
python3 scripts/export_sample_trace.py
python3 scripts/build_action_plan_pdf.py
```

Generated outputs:

- `output/trace/patc_sample_recommendation.json`
- `output/pdf/patc_timeline_cost.pdf`
- `output/pdf/patc_m1_btp_request.pdf`
