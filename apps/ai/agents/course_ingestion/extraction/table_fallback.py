"""Conservative table reconstruction from text-aligned source lines."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Sequence


def table_from_region(text: str) -> Optional[Dict]:
    """Return a table only when repeated columns and headers are explicit.

    PDF draw commands do not encode semantics. A grid of lines is not enough
    to infer cell membership; this function deliberately requires delimiter
    structure that survives text extraction.
    """
    lines = [line for line in text.splitlines() if line.strip()]
    pipes = [line for line in lines if line.count("|") >= 2]
    if len(pipes) < 3:
        return None
    rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in pipes]
    width = len(rows[0])
    if width < 2 or any(len(row) != width for row in rows):
        return None
    if all(re.fullmatch(r":?-{3,}:?", cell) for cell in rows[1]):
        rows.pop(1)
    if len(rows) < 2:
        return None
    return {
        "type": "table",
        "columns": rows[0][:20],
        "rows": rows[1:101],
    }


def table_from_cells(
    cells: Sequence[Sequence[float]], grid: Sequence[float]
) -> Optional[Dict]:
    """Reserved for a reviewed PDF table engine; never fabricate a grid."""
    return None
