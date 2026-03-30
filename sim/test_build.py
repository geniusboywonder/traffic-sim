"""
test_build.py — Smoke test: does the network builder produce a valid UXsim World?

Run from the sim/ directory:
    cd sim
    python test_build.py

Expected output:
  - Node and link counts printed
  - N7 snapped successfully (school ingress)
  - SCHOOL_INTERNAL_IN / _OUT links present
  - No Python exceptions
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from network_builder import build_world, SCHOOL_GATE_ID

def main():
    print("=" * 60)
    print("Building UXsim World from OSM + network-L2 overlay...")
    print("=" * 60)

    W, node_map, overlay_nodes = build_world()

    # Basic sanity checks
    assert len(W.NODES) > 100,  f"Expected >100 nodes, got {len(W.NODES)}"
    assert len(W.LINKS) > 200,  f"Expected >200 links, got {len(W.LINKS)}"

    # School gate must exist
    assert SCHOOL_GATE_ID in overlay_nodes, "School-Gate node missing"

    # School internal links must exist
    link_names = {l.name for l in W.LINKS}
    assert "SCHOOL_INTERNAL_IN"  in link_names, "SCHOOL_INTERNAL_IN link missing"
    assert "SCHOOL_INTERNAL_OUT" in link_names, "SCHOOL_INTERNAL_OUT link missing"

    # N7 must have snapped (critical ingress)
    assert "N7" in overlay_nodes, "N7 (school ingress) missing from overlay_nodes"

    # Check a few key overlay nodes snapped
    for nid in ("N1", "N2", "N3", "N7"):
        assert nid in overlay_nodes, f"{nid} missing"

    print()
    print("=" * 60)
    print("ALL CHECKS PASSED")
    print(f"  Nodes : {len(W.NODES)}")
    print(f"  Links : {len(W.LINKS)}")
    print(f"  N7    : {overlay_nodes['N7'].name}")
    print(f"  School-Gate: {overlay_nodes[SCHOOL_GATE_ID].name}")
    print("=" * 60)

if __name__ == "__main__":
    main()
