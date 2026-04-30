# PATC Company Site

Static public company site for PATC, Probabilistic Adaptive Traffic Control.

The site is structured as a fast multi-page product website:

- `index.html`: professional homepage for the Bengaluru traffic problem, PATC positioning, public benefit, safety boundary, evidence, and page links.
- `simulation.html`: controllable HSR / Silk Board sector replay with scenarios, PATC shadow mode, fixed-time baseline, queue pressure, delay, and completion checks.
- `math.html`: technical deep dive for traffic-wave math, probabilistic state, constraints, validation path, and references.
- `contact.html`: founding team contact page with LinkedIn links.
- `assets/site.css`: shared dark visual system.
- `assets/home.css`: homepage-only visual shell and evidence styling.
- `assets/technical.css`: simulation and math page styling.
- `assets/corridor-data.js`: HSR sector geometry, routes, signal phases, and scenario data.
- `assets/light-sim.js`: lane-aware multi-vehicle replay logic.
- `output/pdf/patc_timeline_cost.pdf`: OSV timeline and cost one-pager.

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

Inside Codex, the bundled workspace Python already has the PDF dependencies:

```bash
/Users/kowshik/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build_action_plan_pdf.py
```

Generated outputs:

- `output/trace/patc_sample_recommendation.json`
- `output/pdf/patc_timeline_cost.pdf`
- `output/pdf/patc_m1_btp_request.pdf`
