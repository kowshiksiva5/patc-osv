from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "trace" / "patc_sample_recommendation.json"


def pressure_score(density: float, wait_frames: int, context_risk: float) -> float:
    return density * (1 + wait_frames / 60) * (1 + context_risk * 0.35)


def build_trace() -> dict[str, object]:
    frame_samples = [
        {"frame": 0, "ew_density": 64, "ns_density": 38, "ew_wait_frames": 90, "context_risk_ew": 0.42},
        {"frame": 90, "ew_density": 78, "ns_density": 42, "ew_wait_frames": 126, "context_risk_ew": 0.51},
        {"frame": 180, "ew_density": 92, "ns_density": 44, "ew_wait_frames": 148, "context_risk_ew": 0.58},
    ]
    final = frame_samples[-1]
    ew_score = pressure_score(final["ew_density"], final["ew_wait_frames"], final["context_risk_ew"])
    ns_score = pressure_score(final["ns_density"], 20, 0.24)
    extension_seconds = 8
    fixed_queue_m = round(ew_score * 0.308)
    patc_queue_m = round(fixed_queue_m - extension_seconds * 4.5)
    fixed_delay_s = round(fixed_queue_m * 0.627)
    patc_delay_s = round(patc_queue_m * 0.683)
    confidence = round(min(0.78, 0.55 + ((ew_score / ns_score) - 1) / 20), 2)

    return {
        "trace_id": "PATC-SIM-0430-PEAK-SPILLBACK-001",
        "generated_by": "scripts/export_sample_trace.py",
        "generated_at_ist": "2026-04-30T02:20:00+05:30",
        "status": "synthetic_concept_trace_not_field_result",
        "scenario": "peak_spillback",
        "seed": "patc-peak-spillback-v1",
        "config": {
            "demand_percent": 112,
            "discharge_percent": 90,
            "safety_bias_percent": 108,
            "controlled_node": "sector_key_node_3_2",
            "context_nodes": 5,
            "fallback_after_stale_cycles": 2,
        },
        "frame_samples": frame_samples,
        "score": {
            "formula": "density * (1 + wait_frames / 60) * (1 + context_risk * 0.35)",
            "ew_score": round(ew_score, 2),
            "ns_score": round(ns_score, 2),
            "ew_to_ns_ratio": round(ew_score / ns_score, 2),
        },
        "recommendation": {
            "action": "extend_ew_green",
            "extension_seconds": extension_seconds,
            "confidence": confidence,
            "fallback_triggers": [
                "pedestrian_window_active",
                "emergency_preemption",
                "stale_data_for_2_cycles",
            ],
        },
        "illustrative_metrics": {
            "fixed_time_residual_queue_m": fixed_queue_m,
            "patc_residual_queue_m": patc_queue_m,
            "fixed_time_average_delay_s": fixed_delay_s,
            "patc_average_delay_s": patc_delay_s,
        },
        "metric_derivation": {
            "fixed_queue_m": "round(ew_score * 0.308)",
            "patc_queue_m": "round(fixed_queue_m - extension_seconds * 4.5)",
            "fixed_delay_s": "round(fixed_queue_m * 0.627)",
            "patc_delay_s": "round(patc_queue_m * 0.683)",
            "confidence": "round(min(0.78, 0.55 + ((ew_score / ns_score) - 1) / 20), 2)",
            "requires_field_validation": True,
        },
        "synthetic_assumptions": {
            "0.308_queue_scale": "illustrative conversion from synthetic pressure score to queue meters; calibrate with observed queue labels by M3",
            "4.5_m_per_green_second": "illustrative discharge effect per extra green second; calibrate with field discharge rates",
            "0.627_fixed_delay_scale": "illustrative fixed-time delay conversion from residual queue",
            "0.683_patc_delay_scale": "illustrative PATC delay conversion after smoother discharge",
            "0.78_confidence_cap": "keeps concept replay confidence below field-calibrated confidence until real labels exist",
        },
        "field_replacement_plan": "Replace synthetic context pressure with measured queue, occupancy, discharge, and downstream capacity labels.",
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(build_trace(), indent=2) + "\n")


if __name__ == "__main__":
    main()
