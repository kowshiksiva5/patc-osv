# PATC Company Site

Static public company site for PATC. The homepage directly embeds the interactive city-network simulation, model telemetry, LWR/Markov visualizations, proof path, and a generated one-page timeline/cost PDF used outside the public site.

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
