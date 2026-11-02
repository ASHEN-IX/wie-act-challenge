import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./formula-actions',()=>({loadFormulaWorkspace:vi.fn()}));
import {FormulaReview} from './formula-review';
describe('Studio formula workspace',()=>{
  it('shows an accessible loading region without inventing consent, jobs or decisions',()=>{
    const html=renderToStaticMarkup(<FormulaReview courseId="course" revisionTag="rev" />);
    expect(html).toContain('aria-label="Formula review"');expect(html).toContain('Formula workspace unavailable or loading.');
    expect(html).not.toContain('Authorize this document');expect(html).not.toContain('Accept proposal');expect(html).not.toContain('Job: completed');
  });
  it('requires course edits to be resolved before mutations',()=>{
    const html=renderToStaticMarkup(<FormulaReview courseId="course" revisionTag="rev" disabled />);
    expect(html).toContain('Save or discard course edits');
  });
});
