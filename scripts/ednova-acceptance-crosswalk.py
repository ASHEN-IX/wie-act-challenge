"""Refresh source-linked aliases in the acceptance matrix; never certifies tests.

Preserves the existing criterion assessments. Rejects missing canonical views.
"""

import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MATRIX = ROOT / "reports/EDNOVA-ATOMIC-ACCEPTANCE-MATRIX.md"
MARKER = "\n## Source-view traceability index\n"
MISSIONS = [
    "DOC", "01", "02", "26", "04", "06", "03", "30", "05", "10",
    "29", "28", "08/29", "27", "32", "31", "07", "07", "12", "09",
    "11", "13", "14", "15", "16", "17", "18", "19", "33", "34",
    "31/32", "35", "07", "20", "21", "25", "22", "23", "24",
]
CONTRACTS = [
    "06", "06/30", "04/05/06/30", "27/28/32", "29", "08/29", "29/33",
    "08/34", "33/34", "07", "17", "25", "07", "09/25", "09", "07/09",
    "11", "18",
]


def tasks(value):
    result = set()
    for match in re.finditer(r"ED-(DOC|\d{2})(?:[–-](?:ED-)?(\d{2}))?((?:/\d{2})*)", value):
        first, end, suffix = match.groups()
        result.add("ED-" + first)
        if end:
            result.update(f"ED-{i:02}" for i in range(int(first), int(end) + 1))
        result.update("ED-" + item for item in suffix.split("/") if item)
    return sorted(result)


def aliases(value):
    return ["ED-" + item for item in value.split("/")]


def read(relative):
    return (ROOT / relative).read_text().splitlines()


def add(kind, identifier, relative, line, owners, requirement):
    assert owners, identifier
    views.append((kind, identifier, relative, line, owners, requirement))


views = []
product = "docs/product-specification.md"
lines = read(product)
for index, line in enumerate(lines):
    match = re.match(r"### (F\d{2}) — (.*)", line)
    if not match:
        continue
    end = next((i for i in range(index + 1, len(lines)) if lines[i].startswith("### F")), len(lines))
    body = lines[index:end]
    acceptance = next((s.removeprefix("- **Acceptance:** ") for s in body if s.startswith("- **Acceptance:**")), None)
    assert acceptance, match.group(1)
    acceptance_line = next(i + 1 for i in range(index, end) if lines[i].startswith("- **Acceptance:**"))
    add("Feature", match.group(1), product, acceptance_line, tasks("\n".join(body)), acceptance)

testing = "docs/testing-plan.md"
for index, line in enumerate(read(testing)):
    if not re.match(r"\| T\d{2} \|", line):
        continue
    cells = [cell.strip() for cell in line.strip("|").split("|")]
    add("Scenario", cells[0], testing, index + 1, tasks(cells[1]), cells[3])

roadmap = "EdNova_Complete_Codex_Mission_Roadmap.md"
for index, line in enumerate(read(roadmap)):
    match = re.match(r"### (M\d{2}) — (.*)", line)
    if match:
        add("Mission", match.group(1), roadmap, index + 1,
            aliases(MISSIONS[int(match.group(1)[1:])]), match.group(2))

technical = "docs/contracts/technical-contracts.md"
for index, line in enumerate(read(technical)):
    match = re.match(r"## Contract (\d{2}): (.*)", line)
    if match:
        add("Contract", "Contract " + match.group(1), technical, index + 1,
            aliases(CONTRACTS[int(match.group(1)) - 1]), match.group(2))

expected = {"Feature": 22, "Scenario": 38, "Mission": 39, "Contract": 18}
for kind, count in expected.items():
    selected = [v[1] for v in views if v[0] == kind]
    assert len(selected) == len(set(selected)) == count, (kind, selected)

matrix = MATRIX.read_text().split(MARKER)[0]
canonical = set(re.findall(r"^## (ED-(?:DOC|\d{2})) —", matrix, re.M))
assert canonical == {"ED-DOC", *(f"ED-{i:02}" for i in range(1, 36))}
atoms = json.loads((ROOT / 'reports/EDNOVA-ACCEPTANCE-CRITERIA.json').read_text())['tasks']
assert set(atoms) == canonical
assert all(requirements and len(requirements) == len(set(requirements)) for requirements in atoms.values())
quotes = {}
task = None
for number, line in enumerate(read('docs/sprint-backlog.md'), 1):
    match = re.match(r'## (ED-(?:DOC|\d{2})) —', line)
    if match:
        task = match.group(1)
    prefix = '- **Acceptance criteria:** '
    if task and line.startswith(prefix):
        quotes[task] = (number, line[len(prefix):])
assert set(quotes) == canonical
for kind, identifier, relative, line, owners, requirement in views:
    assert set(owners) <= canonical, (identifier, owners)

sections = re.split(r"(?=^## ED-)", matrix, flags=re.M)
for i, section in enumerate(sections):
    match = re.match(r"## (ED-(?:DOC|\d{2})) —", section)
    if match:
        task = match.group(1)
        related = [f"[{identifier}](../{relative}:{line})"
                   for _, identifier, relative, line, owners, _ in views
                   if match.group(1) in owners]
        sections[i] = re.sub(
            r"^- Related T/M/technical-contract links:.*$",
            "- Related source views (aliases, not independent feature counts): " + ", ".join(related),
            section, flags=re.M,
        )
        section = sections[i]
        source_line, quote = quotes[task]
        status_match = re.search(r'prior task status: ([A-Z_]+)', section)
        inherited = status_match.group(1) if status_match else 'PARTIAL'
        block = [
            '<!-- atomic-data:start -->',
            f'Original acceptance ([source line {source_line}](../docs/sprint-backlog.md:{source_line})): {quote}',
            '',
            'Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.',
            '',
            '| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |',
            '|---|---|---|---|---|'
        ]
        for number, requirement in enumerate(atoms[task], 1):
            status, confidence = inherited, 'LOW at criterion level'
            evidence = 'Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification.'
            if task == 'ED-01' and number in range(1, 11):
                status, confidence = 'IMPLEMENTED_UNVERIFIED', 'MEDIUM; dated check, full criterion certification pending'
                filename = ('build-final-source.log' if number <= 2 else 'lint-final-source.log' if number <= 4 else 'typecheck-final-source.log' if number <= 6 else 'node-current.log')
                evidence = f'[Executed local check](evidence/ednova-execution-20261027/{filename}); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance.'
            elif task == 'ED-01' and number == 12:
                status, confidence = 'IMPLEMENTED_UNVERIFIED', 'MEDIUM; dated skip inventory'
                evidence = '[Five named Python fixture skips](EDNOVA-TEST-COVERAGE.md); current Node integration has zero skips.'
            block.append(f'| {task}-A{number:03} | {requirement.replace("|", "&#124;")} | {status} | {confidence} | {evidence} |')
        block += ['<!-- atomic-data:end -->']
        rendered = '\n'.join(block)
        if '<!-- atomic-data:start -->' in section:
            section = re.sub(r'<!-- atomic-data:start -->.*?<!-- atomic-data:end -->', lambda _: rendered, section, flags=re.S)
        else:
            section, replaced = re.subn(r'\| Criterion \| Requirement segment \| Current criterion status \|.*?(?=\n\n|\Z)', lambda _: rendered, section, count=1, flags=re.S)
            assert replaced == 1, task
        sections[i] = section
matrix = "".join(sections).rstrip() + "\n"
matrix = matrix.replace(
    '**INCOMPLETE: this is a traceable first decomposition of canonical backlog acceptance fields, not a completed atomic audit.** Semicolon/sentence clauses can still contain multiple independent assertions. Product, testing, mission, technical-contract, security and operational requirements must be independently decomposed, linked and deduplicated before this matrix meets the mission exit criterion. Do not infer verification from a parent task status.',
    f'**INCOMPLETE overall audit.** The 36 canonical acceptance fields now have {sum(map(len, atoms.values()))} maintained normative assertions, with original quotes preserved and all F/T/M/contract view IDs resolved. These supersede the initial C-numbered sentence segments. Independent product/testing/mission/security/operational strengthening still needs semantic reconciliation and deduplication; source-view coverage alone is not the full atomic-audit exit gate. Do not infer child verification from a parent task status.'
)
matrix += MARKER + "\n"
matrix += (
    "This index resolves all 22 feature, 38 scenario, 39 mission and 18 technical-contract "
    "references to canonical tasks and exact source lines. It does **not** mark any scenario "
    "executed or certify all strengthened criteria in each source view. Scenario outcomes below "
    "are preserved verbatim; mission/contract titles identify their complete source sections. "
    "Security and operational requirements still need criterion-level reconciliation. "
    "Run `python3 scripts/ednova-acceptance-crosswalk.py` after changing canonical sources; "
    "the script rejects missing view IDs and preserves existing criterion assessments.\n\n"
)
matrix += "| View | Canonical tasks | Exact source | Required outcome or scope | Verification status |\n|---|---|---|---|---|\n"
for kind, identifier, relative, line, owners, requirement in views:
    matrix += (
        f"| {identifier} | {', '.join(owners)} | [{relative}:{line}](../{relative}:{line}) "
        f"| {requirement.replace('|', '&#124;')} | PARTIAL — full view acceptance not established |\n"
    )
scoped_ids = re.findall(r"^\| (ED-(?:DOC|\d{2})-V\d+) \|", matrix, re.M)
assert len(scoped_ids) == len(set(scoped_ids)), "Duplicate scoped criterion ID"
MATRIX.write_text(matrix)
print(f"Crosswalk refreshed: 36 tasks, {sum(map(len, atoms.values()))} canonical assertions, 22 features, 38 scenarios, 39 missions, 18 contracts; no parent status promoted.")
