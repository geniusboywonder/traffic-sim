"""
sumo_to_json.py — STUB. Convert SUMO FCD + tripinfo XML to canonical SimOutput JSON.

Not implemented in this version. See docs/superpowers/specs/2026-03-30-offline-sim-design.md.

SUMO output files required:
  fcd.xml      — per-vehicle position/speed per timestep (--fcd-output)
  tripinfo.xml — per-vehicle journey stats: waitingTime, timeLoss (--tripinfo-output)
  edges.xml    — per-edge counts (--edgedata-output)
"""

from .schema import SimOutput


def convert(fcd_xml_path, tripinfo_xml_path, scenario: str) -> SimOutput:
    raise NotImplementedError(
        "SUMO converter is a stub. "
        "Implement FCD + tripinfo XML parsing per docs/sim-output-format.md."
    )
