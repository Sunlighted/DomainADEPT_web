"""Record the source expert in the source and the target domain, label every
episode's outcome / failure mode, and compose one labelled grid video per task.

Run from the ibrl repo (it imports train_rl / env):
  cd /home/Chenyang/ibrl && source set_env.sh
  CUDA_VISIBLE_DEVICES=1 MUJOCO_GL=egl /home/Chenyang/.conda/envs/ibrl/bin/python \
      /home/Chenyang/domainadept-site/tools/record_shift_demos.py --task threading --domain target --out <dir>

Policy / target definitions follow the 2026-09-22 zero-shot shims
(exps/dr_zeroshot_shim/*/PROVENANCE.md) and the paper's stage-1 cfgs; Threading
uses the expert that SimDist stage-1 actually distilled.
"""
import argparse
import dataclasses
import json
import os
import sys
from collections import deque

import numpy as np
import torch
import yaml

sys.path.insert(0, os.getcwd())
import common_utils  # noqa: E402
import train_rl  # noqa: E402
from common_utils import ibrl_utils as utils  # noqa: E402
from env.domain_shift import DomainShiftConfig  # noqa: E402
from env.robosuite_wrapper import PixelRobosuite  # noqa: E402
from env.strict_success import StrictSuccessConfig  # noqa: E402

EXPS = "/home/Chenyang/ibrl/exps"
TASKS = {
    # weight, cfg holding the target eval_domain_shift, strict, sigma
    "threading": dict(weight=f"{EXPS}/mimicgen/threading_ibrl_source_seed1/model0.pt",
                      target_cfg=f"{EXPS}/mimicgen/threading_simdist_dynens_diversev2_h5_seed1/cfg.yaml",
                      strict=True, sigma=0.1),
    "coffee": dict(weight=f"{EXPS}/dr_zeroshot_shim/coffee_src/model0.pt",
                   target_cfg=f"{EXPS}/mimicgen/coffee_s1g5x_dynens/cfg.yaml",
                   strict=False, sigma=0.1),
    "square": dict(weight=f"{EXPS}/dr_zeroshot_shim/square_src/model0.pt",
                   target_cfg=f"{EXPS}/mimicgen/square_simdist_rotw1_dynens_h5_seed1/cfg.yaml",
                   strict=False, sigma=0.1),
    "tpa": dict(weight=f"{EXPS}/dr_zeroshot_shim/tpa_src/model0.pt",
                target_cfg=f"{EXPS}/mimicgen/tpa_simdist_plain_diversev1_h5_seed1/cfg.yaml",
                strict=False, sigma=None),
}
LIFT = 0.03  # m above the start height = "lifted"


def shift_from(cfg_path, mode_override=None):
    with open(cfg_path) as f:
        raw = yaml.safe_load(f) or {}
    kw = {k: (tuple(v) if isinstance(v, list) else v) for k, v in (raw.get("eval_domain_shift") or {}).items()}
    valid = {f.name for f in dataclasses.fields(DomainShiftConfig)}
    kw = {k: v for k, v in kw.items() if k in valid}
    if mode_override is not None:
        kw["mode"] = mode_override
    return DomainShiftConfig(**kw), raw


# ------------------------------------------------------------------ probes
class Probe:
    """Per-step task state from the raw robosuite env (re-resolved after each hard reset)."""

    def __init__(self, task, pixel_env):
        self.task, self.pe = task, pixel_env

    @property
    def raw(self):
        return self.pe.env

    def body(self, name):
        return np.array(self.raw.sim.data.body_xpos[self.raw.obj_body_id[name]])

    def refresh(self):
        r, m = self.raw, self.raw.sim.model
        self.log = []
        if self.task == "threading":
            self.ng = m.geom_name2id("needle_obj_needle")
            self.rg = [m.geom_name2id(f"tripod_obj_ring_{i}") for i in range(r.tripod.num_ring_geoms)]
            self.radius = float(r.tripod.ring_size[1])
            self.tb = m.body_name2id(r.tripod.root_body)
            self.z0 = self.needle()[2]
        elif self.task == "coffee":
            self.z0 = self.body("coffee_pod")[2]
        elif self.task == "square":
            self.nut = r.nuts[0].name
            self.z0 = self.body(self.nut)[2]
        elif self.task == "tpa":
            self.z1, self.z2 = self.body("piece_1")[2], self.body("piece_2")[2]

    def needle(self):
        return np.array(self.raw.sim.data.geom_xpos[self.ng])

    def record(self):
        r = self.raw
        if self.task == "threading":
            ring = np.mean(r.sim.data.geom_xpos[self.rg], axis=0)
            n = self.needle()
            up = float(r.sim.data.body_xmat[self.tb].reshape(3, 3)[2, 2])  # cos(tilt) of the tripod
            self.log.append(dict(lift=n[2] - self.z0, d=float(np.linalg.norm(n - ring)), up=up))
        elif self.task == "coffee":
            m = r._get_partial_task_metrics()
            self.log.append(dict(lift=self.body("coffee_pod")[2] - self.z0, grasp=bool(m["grasp"]),
                                 rim=bool(m["rim"]), ins=bool(m["insertion"])))
        elif self.task == "square":
            nut = self.body(self.nut)
            peg = np.array(r.sim.data.body_xpos[r.peg1_body_id])
            self.log.append(dict(lift=nut[2] - self.z0, dxy=float(np.linalg.norm(nut[:2] - peg[:2])),
                                 low=bool(nut[2] < r.table_offset[2] + 0.05)))
        elif self.task == "tpa":
            self.log.append(dict(l1=self.body("piece_1")[2] - self.z1, l2=self.body("piece_2")[2] - self.z2,
                                 a1=bool(r._check_first_piece_is_assembled())))

    def classify(self, success):
        L = self.log
        if success:
            return "success"
        if self.task == "threading":
            if min(x["up"] for x in L) < np.cos(np.radians(20)):
                return "knocked tripod over"
            if max(x["lift"] for x in L) < LIFT:
                return "grasp failed"
            dmin = min(x["d"] for x in L)
            if dmin < self.radius:
                return "insertion not held"
            if dmin < 0.03:
                return "insertion failed"
            return "missed the ring"
        if self.task == "coffee":
            if not any(x["grasp"] for x in L) and max(x["lift"] for x in L) < LIFT:
                return "grasp failed"
            if any(x["ins"] for x in L):
                return "lid not closed"
            if any(x["rim"] for x in L):
                return "stuck on rim"
            return "dropped pod"
        if self.task == "square":
            if max(x["lift"] for x in L) < LIFT:
                return "grasp failed"
            if min(x["dxy"] for x in L) < 0.03:
                return "jammed on peg" if not any(x["low"] and x["dxy"] < 0.03 for x in L) else "released off peg"
            return "missed peg"
        if self.task == "tpa":
            if not any(x["a1"] for x in L):
                return "piece 1 grasp failed" if max(x["l1"] for x in L) < LIFT else "piece 1 insertion failed"
            return "piece 2 grasp failed" if max(x["l2"] for x in L) < LIFT else "piece 2 insertion failed"
        return "failed"


def act_chunk(agent, obs):
    if hasattr(agent, "act_chunk"):
        return agent.act_chunk(obs, eval_mode=True)
    return agent.act(obs, eval_mode=True).unsqueeze(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", required=True, choices=list(TASKS))
    ap.add_argument("--domain", required=True, choices=["source", "target"])
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--camera", default="agentview")
    ap.add_argument("--wh", default="320,240")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    W, H = (int(v) for v in a.wh.split(","))
    spec = TASKS[a.task]
    torch.backends.cudnn.benchmark = False
    torch.backends.cudnn.deterministic = True
    common_utils.set_all_seeds(a.seed)

    agent, _, env_params = train_rl.load_model(spec["weight"], "cuda")
    shift, _ = shift_from(spec["target_cfg"], None if a.domain == "target" else "none")
    env_params["domain_shift"] = shift
    env_params["strict_success"] = StrictSuccessConfig(enabled=spec["strict"])
    env_params["hand_init_perturb"] = None
    env_params["hand_init_perturb_joint_sigma"] = spec["sigma"]
    print(f"[demo] task={a.task} env={env_params['env_name']} domain={a.domain} shift={shift} "
          f"strict={spec['strict']} sigma={spec['sigma']} ep_len={env_params.get('episode_length')} "
          f"init_dist={env_params.get('init_distribution')} act_method={getattr(agent.cfg, 'act_method', None)}",
          flush=True)

    env = PixelRobosuite(**env_params)
    probe = Probe(a.task, env)
    os.makedirs(a.out, exist_ok=True)
    results = []
    with torch.no_grad(), utils.eval_mode(agent):
        for ep in range(a.n):
            np.random.seed(a.seed + ep)
            obs, _ = env.reset()
            if hasattr(agent, "reset_prior"):
                agent.reset_prior()
            probe.refresh()
            frames, q, done, success = [], deque(), False, False
            while not done:
                frames.append(env.env.sim.render(width=W, height=H, camera_name=a.camera)[::-1])
                if not q:
                    q.extend(act_chunk(agent, obs))
                obs, rew, done, success, _ = env.step(q.popleft())
                probe.record()
            frames.append(env.env.sim.render(width=W, height=H, camera_name=a.camera)[::-1])
            label = probe.classify(bool(success))
            np.savez_compressed(os.path.join(a.out, f"ep{ep}.npz"), frames=np.stack(frames))
            results.append(dict(ep=ep, seed=a.seed + ep, success=bool(success), label=label, len=len(frames)))
            print(f"[demo] {a.task}/{a.domain} ep{ep} seed{a.seed+ep}: {label} len={len(frames)}", flush=True)
    json.dump(dict(task=a.task, domain=a.domain, shift=dataclasses.asdict(shift), episodes=results,
                   weight=spec["weight"], target_cfg=spec["target_cfg"]),
              open(os.path.join(a.out, "results.json"), "w"), indent=1, default=str)
    print(f"[demo] {a.task}/{a.domain}: {sum(r['success'] for r in results)}/{len(results)}")


if __name__ == "__main__":
    main()
