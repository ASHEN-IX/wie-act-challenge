"""Export review JSON Schema from the existing Pydantic mirrors, not model code.
Run from apps/ai: python -m contracts.export_ednova_schema [--check]
Semantic relationships/ACL are enforced by the validators and owning services.
"""
import json
import sys
from pathlib import Path
from contracts.ednova import CONTRACTS


def schema_document():
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "EdNova ED-26 v1.0.0 review candidate",
        "description": "Structural export; relational validators and current runtime authorization are mandatory. Not officially frozen.",
        "anyOf": [{"$ref": f"#/$defs/{name}"} for name in CONTRACTS],
        "$defs": {name: adapter.json_schema(ref_template=f"#/$defs/{name}/$defs/{{model}}") for name, adapter in CONTRACTS.items()},
    }


def main():
    target = Path(__file__).resolve().parents[3] / "docs/contracts/ednova-v1.schema.json"
    encoded = json.dumps(schema_document(), indent=2, ensure_ascii=True) + "\n"
    if "--check" in sys.argv:
        if target.read_text() != encoded:
            raise SystemExit("ED-26 schema artifact drift; regenerate and review")
    else:
        target.write_text(encoded)


if __name__ == "__main__":
    main()
