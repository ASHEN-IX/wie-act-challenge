"""Recover embedded Type-1 glyph identities for PDF text extraction.

Some TeX PDFs declare a valid /Differences glyph list but provide a broken
ToUnicode CMap. MuPDF trusts the CMap and turns symbols such as ``universal``
into ordinary Latin characters. This mapping repairs that narrow, explicit case.
It never rewrites text and never guesses from a character's visual appearance.
"""

from __future__ import annotations

from typing import Dict, Optional


# Adobe Glyph List names used by TeX math fonts. Only unambiguous identities
# are listed. Unknown names remain untouched and trigger a review warning.
GLYPH_UNICODE: Dict[str, str] = {
    "universal": "∀",
    "existential": "∃",
    "element": "∈",
    "greaterequal": "≥",
    "lessequal": "≤",
    "arrowdblright": "⇒",
    "arrowdblleft": "⇐",
    "arrowright": "→",
    "arrowleft": "←",
    "mapsto": "↦",
    "infinity": "∞",
    "minus": "−",
    "multiply": "×",
    "union": "∪",
    "intersection": "∩",
    "propersubset": "⊂",
    "propersuperset": "⊃",
    "negationslash": "≠",
    "equivalence": "≡",
    "approxequal": "≈",
    "similar": "∼",
    "proportional": "∝",
    "plusminus": "±",
    "minusplus": "∓",
    "radical": "√",
    "partialdiff": "∂",
    "summationdisplay": "∑",
    "summationtext": "∑",
    "integraldisplay": "∫",
    "integraltext": "∫",
    "productdisplay": "∏",
    "producttext": "∏",
    "epsilon1": "ε",
    "epsilon": "ϵ",
    "alpha": "α",
    "beta": "β",
    "gamma": "γ",
    "delta": "δ",
    "theta": "θ",
    "lambda": "λ",
    "mu": "μ",
    "pi": "π",
    "rho": "ρ",
    "sigma": "σ",
    "tau": "τ",
    "phi": "φ",
    "chi": "χ",
    "psi": "ψ",
    "omega": "ω",
    "Gamma": "Γ",
    "Delta": "Δ",
    "Theta": "Θ",
    "Lambda": "Λ",
    "Pi": "Π",
    "Sigma": "Σ",
    "Phi": "Φ",
    "Psi": "Ψ",
    "Omega": "Ω",
}

# These names have a mathematically distinct identity from their visual/base
# code point. A best-effort map is safer than discarding an entire equation.
GLYPH_FALLBACKS: Dict[str, str] = {
    "alpha1": "α",
    "beta1": "β",
    "gamma1": "γ",
    "delta1": "δ",
    "theta1": "ϑ",
    "lambda1": "λ",
    "mu1": "μ",
    "pi1": "ϖ",
    "rho1": "ϱ",
    "sigma1": "ς",
    "phi1": "ϕ",
    "omega1": "ϖ",
}


def glyph_unicode(name: str) -> Optional[str]:
    """Return an exact glyph identity, or None when it is not trustworthy."""
    normalized = name.split(".")[0]
    return GLYPH_UNICODE.get(normalized) or GLYPH_FALLBACKS.get(normalized)
