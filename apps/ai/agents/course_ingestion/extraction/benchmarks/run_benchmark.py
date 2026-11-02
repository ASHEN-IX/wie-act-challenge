"""Reproducible CPU comparison; marker checks are not equation accuracy."""
import json
import resource
import subprocess
import sys
import time
from pathlib import Path

APP = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(APP))
SOURCE = Path(__file__).with_name('reference-course.pdf')
MARKERS = ['∀ε > 0', '∃Nε ∈N', '⇒', '≤ε']


def measure(engine):
    start = time.perf_counter()
    if engine == 'hybrid':
        from agents.course_ingestion.extraction.pdf_loader import extract_pages_from_pdf_sandboxed
        from agents.course_ingestion.extraction.layout import regions_from_pages, quality_summary
        pages = extract_pages_from_pdf_sandboxed(str(SOURCE))
        text = '\n'.join(p['text'] for p in pages)
        first = pages[0]['text']
        regions = regions_from_pages(pages)
        extra = {'quality': quality_summary(regions), 'pages': len(pages),
                 'serializedPageBytes': len(json.dumps(pages).encode()),
                 'figureRegions': [r for r in regions if r['type'] == 'figure']}
    elif engine == 'pdfplumber':
        import pdfplumber
        with pdfplumber.open(SOURCE) as pdf:
            pages = [page.extract_text() or '' for page in pdf.pages]
        text, first, extra = '\n'.join(pages), pages[0], {'pages': len(pages)}
    elif engine == 'native':
        import fitz
        with fitz.open(SOURCE) as pdf:
            pages = [page.get_text() for page in pdf]
        text, first, extra = '\n'.join(pages), pages[0], {'pages': len(pages)}
    else:
        import fitz
        import tempfile
        from agents.course_ingestion.extraction.ocr import _ocr_page
        with fitz.open(SOURCE) as pdf, tempfile.TemporaryDirectory() as directory:
            text, confidence = _ocr_page(pdf[0], directory)
        first, extra = text, {'pages': 1, 'ocrConfidence': confidence}
    return {'engine': engine, 'wallSeconds': round(time.perf_counter() - start, 4),
            'parentMaxRssKiB': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            'childMaxRssKiB': resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,
            'characters': len(text), 'page1Markers': {s: s in first for s in MARKERS},
            'page1Excerpt': first[:1800], **extra}


if __name__ == '__main__':
    if len(sys.argv) > 1:
        print(json.dumps(measure(sys.argv[1]), ensure_ascii=False))
    else:
        results = []
        for engine in ['native', 'pdfplumber', 'ocr-page1', 'hybrid']:
            result = subprocess.run([sys.executable, __file__, engine], capture_output=True, text=True, timeout=120)
            results.append(json.loads(result.stdout) if result.returncode == 0 else {'engine': engine, 'error': result.stderr[-1000:]})
        print(json.dumps(results, ensure_ascii=False, indent=2))
