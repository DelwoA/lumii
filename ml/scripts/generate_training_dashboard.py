from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def number(value: float) -> str:
    return f"{value:,.0f}"


def metric(value: float, digits: int = 4) -> str:
    return f"{value:.{digits}f}"


def line_path(values: list[float], minimum: float, maximum: float) -> str:
    width, height = 760.0, 230.0
    points = []
    for index, value in enumerate(values):
        x = index * width / max(len(values) - 1, 1)
        y = height - (value - minimum) * height / max(maximum - minimum, 1e-9)
        points.append(f"{x:.1f},{y:.1f}")
    return " ".join(points)


def build_dashboard(manifest: dict[str, object], evaluation: dict[str, object]) -> str:
    history = evaluation["training_history"]
    train_losses = [row["train_loss"] for row in history]
    validation_losses = [row["validation_log_loss"] for row in history]
    loss_min = min(train_losses + validation_losses) - 0.0005
    loss_max = max(train_losses + validation_losses) + 0.0005
    metrics = evaluation["metrics"]
    deep = metrics["deep_calibrated"]
    bkt = metrics.get("bkt_fitted", metrics.get("bkt_state"))
    if bkt is None:
        raise ValueError("Evaluation must include a BKT baseline")
    examples = evaluation["dataset_examples"]
    checks = evaluation["promotion_checks"]
    promoted = bool(evaluation["promote_deep"])
    model_version = html.escape(evaluation["model_version"])
    confidence = evaluation.get("deep_confidence_intervals", {})
    accuracy_interval = confidence.get("accuracy")
    auc_interval = confidence.get("roc_auc")
    best_epoch = min(range(len(history)), key=lambda index: history[index]["validation_log_loss"])
    split_rows = {row["split"]: row["len"] for row in manifest["split_rows"]}
    processed_width = 100 * manifest["rows"] / manifest["raw_rows_read"]
    removed_width = 100 - processed_width
    created_at = html.escape(evaluation["created_at"].replace("T", " ").split(".")[0] + " UTC")

    gate_rows = "".join(
        f"<li class='{'passed' if passed else 'failed'}'><span class='check'>"
        f"{'✓' if passed else '×'}</span><span>"
        f"{html.escape(name.replace('_', ' ').title())}</span>"
        f"<strong>{'Passed' if passed else 'Failed'}</strong></li>"
        for name, passed in checks.items()
    )
    epoch_ticks = "".join(f"<span>{index}</span>" for index in range(1, len(history) + 1))
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LUMII mastery training report</title>
  <style>
    * {{ box-sizing: border-box; }}
    :root {{ --ink:#142033; --muted:#627086; --line:#dbe2ea; --paper:#f4f7fa; --panel:#ffffff; --navy:#0c1b33; --blue:#3166d5; --blue-soft:#e8efff; --green:#16845b; --green-soft:#e5f5ee; --amber:#bb6b10; }}
    body {{ margin:0; background:var(--paper); color:var(--ink); font:14px/1.45 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    .shell {{ display:grid; grid-template-columns:220px 1fr; min-height:100vh; }}
    aside {{ background:var(--navy); color:#dce7f8; padding:30px 22px; }}
    .brand {{ font-size:19px; font-weight:700; letter-spacing:.08em; color:white; margin-bottom:8px; }}
    .brand-sub {{ color:#96a9c6; font-size:12px; margin-bottom:42px; }}
    nav a {{ display:flex; gap:10px; color:#aebed5; text-decoration:none; padding:10px 12px; margin:5px 0; border-radius:8px; }}
    nav a.active {{ background:#173052; color:white; }}
    .nav-dot {{ width:8px; height:8px; margin-top:6px; border-radius:50%; background:currentColor; }}
    .aside-foot {{ margin-top:50px; padding-top:20px; border-top:1px solid #233a5d; color:#8fa3c0; font-size:11px; }}
    main {{ padding:26px 34px 56px; max-width:1220px; width:100%; }}
    .topbar {{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }}
    .crumb {{ color:var(--muted); font-size:12px; }}
    .status {{ display:inline-flex; align-items:center; gap:7px; background:{"var(--green-soft)" if promoted else "#fff3df"}; color:{"#0d6645" if promoted else "#8a510c"}; border:1px solid {"#b9e2d1" if promoted else "#ebc98f"}; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:650; }}
    .status i {{ width:7px; height:7px; background:var(--green); border-radius:50%; }}
    .capture-panel {{ background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:26px; margin-bottom:26px; box-shadow:0 7px 24px rgba(28,45,72,.06); }}
    .section-head {{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:22px; }}
    h1,h2,h3,p {{ margin-top:0; }}
    h1 {{ font-size:25px; margin-bottom:5px; letter-spacing:-.02em; }}
    h2 {{ font-size:20px; margin-bottom:5px; letter-spacing:-.015em; }}
    h3 {{ font-size:13px; margin-bottom:12px; }}
    .muted {{ color:var(--muted); }}
    .run-id {{ color:var(--muted); font:12px ui-monospace, SFMono-Regular, Menlo, monospace; text-align:right; }}
    .stats {{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }}
    .stat {{ border:1px solid var(--line); background:#fbfcfe; border-radius:10px; padding:16px; }}
    .stat label {{ display:block; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:7px; }}
    .stat strong {{ display:block; font-size:23px; letter-spacing:-.02em; }}
    .stat small {{ color:var(--muted); }}
    .grid-2 {{ display:grid; grid-template-columns:1fr 1fr; gap:20px; }}
    .subpanel {{ border-top:1px solid var(--line); padding-top:18px; }}
    .funnel {{ display:flex; height:34px; border-radius:7px; overflow:hidden; margin:12px 0 9px; background:#edf1f5; }}
    .funnel .kept {{ width:{processed_width:.2f}%; background:var(--blue); }}
    .funnel .removed {{ width:{removed_width:.2f}%; background:#cfd8e3; }}
    .legend {{ display:flex; gap:18px; color:var(--muted); font-size:12px; }}
    .legend span::before {{ content:""; display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:6px; background:var(--blue); }}
    .legend span:last-child::before {{ background:#cfd8e3; }}
    .split {{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }}
    .split div {{ background:#f7f9fc; border-radius:8px; padding:12px; }}
    .split b {{ display:block; font-size:16px; }}
    .chart-wrap {{ display:grid; grid-template-columns:58px 1fr; gap:10px; }}
    .y-axis {{ display:flex; flex-direction:column; justify-content:space-between; text-align:right; color:var(--muted); font-size:11px; padding:2px 0 18px; }}
    .chart {{ position:relative; height:262px; border-left:1px solid var(--line); border-bottom:1px solid var(--line); background:repeating-linear-gradient(to bottom, transparent 0, transparent 56px, #edf1f5 57px); }}
    .chart svg {{ position:absolute; left:0; top:0; width:100%; height:230px; overflow:visible; }}
    .train-line {{ fill:none; stroke:var(--blue); stroke-width:2.2; }}
    .val-line {{ fill:none; stroke:var(--green); stroke-width:2.2; }}
    .epoch-axis {{ display:grid; grid-template-columns:repeat({len(history)},1fr); color:var(--muted); font-size:11px; margin-top:237px; text-align:center; }}
    .chart-legend {{ display:flex; gap:20px; margin:14px 0 0 68px; font-size:12px; color:var(--muted); }}
    .chart-legend i {{ display:inline-block; width:18px; height:3px; background:var(--blue); vertical-align:middle; margin-right:6px; }}
    .chart-legend span:last-child i {{ background:var(--green); }}
    .epoch-note {{ background:var(--green-soft); color:#175f46; border-radius:9px; padding:14px 16px; margin-top:18px; display:flex; justify-content:space-between; gap:20px; }}
    .metric-table {{ width:100%; border-collapse:collapse; }}
    .metric-table th,.metric-table td {{ border-bottom:1px solid var(--line); padding:12px 9px; text-align:right; }}
    .metric-table th:first-child,.metric-table td:first-child {{ text-align:left; }}
    .metric-table thead th {{ color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.05em; }}
    .winner {{ color:var(--green); font-weight:700; }}
    .delta {{ display:inline-block; margin-left:5px; padding:2px 6px; border-radius:999px; background:var(--green-soft); color:#176a4c; font-size:10px; }}
    .gate-list {{ list-style:none; padding:0; margin:0; }}
    .gate-list li {{ display:grid; grid-template-columns:24px 1fr auto; align-items:center; padding:11px 0; border-bottom:1px solid var(--line); }}
    .check {{ color:var(--green); font-weight:800; }}
    .gate-list strong {{ color:var(--green); font-size:12px; }}
    .gate-list .failed .check,.gate-list .failed strong {{ color:#b33d32; }}
    .decision {{ margin-top:18px; background:var(--blue-soft); border-left:4px solid var(--blue); padding:16px; border-radius:7px; }}
    .decision strong {{ display:block; margin-bottom:3px; }}
    .artifact-row {{ display:grid; grid-template-columns:1fr auto; gap:20px; align-items:center; margin-top:18px; padding-top:16px; border-top:1px solid var(--line); }}
    code {{ font:12px ui-monospace, SFMono-Regular, Menlo, monospace; color:#34445b; }}
    @media (max-width:900px) {{ .shell{{grid-template-columns:1fr}} aside{{display:none}} main{{padding:18px}} .stats{{grid-template-columns:1fr 1fr}} .grid-2{{grid-template-columns:1fr}} }}
  </style>
</head>
<body>
<div class="shell">
  <aside>
    <div class="brand">LUMII</div><div class="brand-sub">ML EXPERIMENT CONSOLE</div>
    <nav><a class="active" href="#overview"><span class="nav-dot"></span>Run overview</a><a href="#training"><span class="nav-dot"></span>Training</a><a href="#evaluation"><span class="nav-dot"></span>Evaluation</a></nav>
    <div class="aside-foot">Knowledge tracing workbench<br>Reproducible run · seed 42</div>
  </aside>
  <main>
    <div class="topbar"><div class="crumb">Experiments / Mastery tracking / {model_version}</div><div class="status"><i></i> Run complete</div></div>

    <section id="overview" class="capture-panel">
      <div class="section-head"><div><h1>Mastery prediction experiment</h1><p class="muted">EdNet-KT1 · student-isolated evaluation · leakage-safe portable features</p></div><div class="run-id">{model_version}<br>{created_at}</div></div>
      <div class="stats">
        <div class="stat"><label>Raw interactions</label><strong>{number(manifest["raw_rows_read"])}</strong><small>bounded EdNet sample</small></div>
        <div class="stat"><label>Clean interactions</label><strong>{number(manifest["rows"])}</strong><small>single-skill evidence</small></div>
        <div class="stat"><label>Students</label><strong>{number(manifest["students"])}</strong><small>anonymized learners</small></div>
        <div class="stat"><label>Knowledge skills</label><strong>{number(manifest["concepts"])}</strong><small>EdNet skill labels</small></div>
      </div>
      <div class="grid-2">
        <div class="subpanel"><h3>Preprocessing funnel</h3><div class="funnel" role="img" aria-label="{processed_width:.1f} percent retained and {removed_width:.1f} percent removed"><div class="kept"></div><div class="removed"></div></div><div class="legend"><span>{number(manifest["rows"])} retained</span><span>{number(manifest["removed_rows"])} ambiguous, invalid, or duplicate</span></div></div>
        <div class="subpanel"><h3>Student-level split</h3><div class="split"><div><span class="muted">Train</span><b>{number(split_rows["train"])}</b><small>70% students</small></div><div><span class="muted">Validation</span><b>{number(split_rows["validation"])}</b><small>15% students</small></div><div><span class="muted">Test</span><b>{number(split_rows["test"])}</b><small>15% students</small></div></div></div>
      </div>
    </section>

    <section id="training" class="capture-panel">
      <div class="section-head"><div><h2>Training progression</h2><p class="muted">Residual attention next-response predictor · sequence length {evaluation["sequence_length"]} · best-checkpoint restore</p></div><div class="run-id">{number(examples["train"])} train sequences<br>{len(history)} epochs completed</div></div>
      <div class="chart-wrap"><div class="y-axis"><span>{loss_max:.4f}</span><span>{(loss_min + loss_max) / 2:.4f}</span><span>{loss_min:.4f}</span></div><div class="chart"><svg viewBox="0 0 760 230" preserveAspectRatio="none" role="img" aria-label="Training and validation log loss by epoch"><polyline class="train-line" points="{line_path(train_losses, loss_min, loss_max)}"/><polyline class="val-line" points="{line_path(validation_losses, loss_min, loss_max)}"/></svg><div class="epoch-axis">{epoch_ticks}</div></div></div>
      <div class="chart-legend"><span><i></i>Training BCE loss</span><span><i></i>Validation log loss</span></div>
      <div class="epoch-note"><div><strong>Best checkpoint retained</strong><br><span>Epoch {best_epoch + 1} · validation log loss {validation_losses[best_epoch]:.5f}</span></div><div><strong>Selection discipline</strong><br><span>Validation chooses checkpoint; held-out test is evaluated once</span></div></div>
    </section>

    <section id="evaluation" class="capture-panel">
      <div class="section-head"><div><h2>Held-out model evaluation</h2><p class="muted">{number(deep["examples"])} untouched test sequences · students never observed during fitting or calibration</p></div><div class="status"><i></i> {"Promotion approved" if promoted else "Candidate retained"}</div></div>
      <div class="grid-2">
        <div>
          <table class="metric-table"><thead><tr><th>Metric</th><th>Deep calibrated</th><th>Fitted BKT</th></tr></thead><tbody>
            <tr><td>ROC-AUC ↑</td><td class="winner">{metric(deep["roc_auc"], 5)} <span class="delta">+{metric(deep["roc_auc"] - bkt["roc_auc"], 5)}</span></td><td>{metric(bkt["roc_auc"], 5)}</td></tr>
            <tr><td>Log loss ↓</td><td class="winner">{metric(deep["log_loss"], 5)} <span class="delta">−{metric(bkt["log_loss"] - deep["log_loss"], 5)}</span></td><td>{metric(bkt["log_loss"], 5)}</td></tr>
            <tr><td>Brier score ↓</td><td class="winner">{metric(deep["brier"], 5)}</td><td>{metric(bkt["brier"], 5)}</td></tr>
            <tr><td>Calibration ECE ↓</td><td class="winner">{metric(deep["ece_15"], 5)}</td><td>{metric(bkt["ece_15"], 5)}</td></tr>
            <tr><td>Accuracy</td><td class="winner">{metric(deep["accuracy"] * 100, 2)}%</td><td>{metric(bkt["accuracy"] * 100, 2)}%</td></tr>
            <tr><td>PR-AUC ↑</td><td class="winner">{metric(deep.get("pr_auc", 0), 5)}</td><td>{metric(bkt.get("pr_auc", 0), 5)}</td></tr>
          </tbody></table>
          <p class="muted">{"Accuracy 95% CI " + metric(accuracy_interval["lower_95"] * 100, 2) + "%–" + metric(accuracy_interval["upper_95"] * 100, 2) + "% · AUC 95% CI " + metric(auc_interval["lower_95"], 4) + "–" + metric(auc_interval["upper_95"], 4) if accuracy_interval and auc_interval else "Cluster-bootstrap confidence intervals are generated for final candidates."}</p>
        </div>
        <div><h3>Production promotion gates</h3><ul class="gate-list">{gate_rows}</ul><div class="decision"><strong>{"Serve deep predictions with BKT fallback" if promoted else "Do not promote this candidate"}</strong><span>{"Deep model supplies next-answer probability. BKT remains the interpretable mastery state and automatic reliability path." if promoted else "The artifact remains in the candidate registry. Production continues to use the reliable BKT path until every hard gate passes."}</span></div></div>
      </div>
      <div class="artifact-row"><div><strong>Verified inference artifact</strong><br><code>{"ml/artifacts/champion/temporal_mastery.onnx" if promoted else "ml/artifacts/candidates/transfer-attention-v2/transfer_mastery.onnx"}</code></div><div class="run-id">PyTorch ↔ ONNX max error<br><strong>{evaluation["onnx_max_absolute_error"]:.2e}</strong></div></div>
    </section>
  </main>
</div>
</body>
</html>"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest", type=Path, default=ROOT / "data/processed/ednet_manifest.json"
    )
    parser.add_argument(
        "--evaluation", type=Path, default=ROOT / "reports/generated/evaluation.json"
    )
    parser.add_argument("--output", type=Path, default=ROOT / "reports/training-dashboard.html")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    evaluation = json.loads(args.evaluation.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_dashboard(manifest, evaluation), encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
