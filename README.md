# PATC Company Site

Static public company site for PATC, Probabilistic Adaptive Traffic Control.

The site is structured as a fast multi-page product website:

- `index.html`: public product homepage for the Bengaluru traffic problem, PATC positioning, operating belief, public benefit, safety boundary, and page links.
- `simulation.html`: controllable connected-sector replay with two stable scenarios, equal vehicle load across PATC and fixed-time modes, lane-clamped vehicles, PATC all-signal corridor coordination, queue pressure, severe stops, delay, and completion checks.
- `math.html`: technology deep dive for the operating stack, traffic-wave modeling, probabilistic state, constraints, validation path, and references.
- `contact.html`: clean founder contact page with LinkedIn links.
- `assets/site.css`: shared dark visual system.
- `assets/home.css`: homepage-only visual shell and evidence styling.
- `assets/technical.css`: simulation and math page styling.
- `assets/corridor-data.js`: sector geometry, feeder nodes, sensor points, routes, signal phases, and scenario data.
- `assets/light-sim.js`: lane-aware mixed-vehicle replay logic.
- `output/pdf/patc_timeline_cost.pdf`: separate OSV timeline and cost one-pager, generated but not linked from the public company navigation.

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
- `output/pdf/patc_m1_traffic_police_request.pdf`
