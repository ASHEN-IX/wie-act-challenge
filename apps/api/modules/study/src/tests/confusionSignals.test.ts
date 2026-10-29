/**
 * P0-6 — tentative confusion signals (repeated errors, hint escalation, help requests).
 */

import {
  HINT_ESCALATION_LEVEL,
  REPEATED_ERRORS_THRESHOLD,
  assessConfusion,
  helpRequestedIn
} from '../services/confusionSignals';

describe('assessConfusion', () => {
  it('is not tentative without any signal', () => {
    expect(assessConfusion({})).toEqual({ tentative: false, reasons: [] });
    expect(assessConfusion({ wrongAttempts: 1, hintLevel: 1 })).toEqual({
      tentative: false,
      reasons: []
    });
  });

  it('flags repeated errors at the threshold', () => {
    expect(assessConfusion({ wrongAttempts: REPEATED_ERRORS_THRESHOLD })).toEqual({
      tentative: true,
      reasons: ['repeated_errors']
    });
  });

  it('flags hint escalation at the second hint level', () => {
    expect(assessConfusion({ hintLevel: HINT_ESCALATION_LEVEL })).toEqual({
      tentative: true,
      reasons: ['hint_escalation']
    });
  });

  it('flags an explicit help request in the transcript', () => {
    expect(assessConfusion({ transcriptText: "Honestly I'm lost on this step" })).toEqual({
      tentative: true,
      reasons: ['help_requested']
    });
  });

  it('reports every signal that applies', () => {
    expect(
      assessConfusion({ wrongAttempts: 3, hintLevel: 2, transcriptText: 'je ne comprends pas' })
    ).toEqual({
      tentative: true,
      reasons: ['repeated_errors', 'hint_escalation', 'help_requested']
    });
  });
});

describe('helpRequestedIn', () => {
  it.each([
    "I don't understand the key",
    'Je ne comprends pas la clé primaire',
    'ma fhemtch had partie',
    'ما فهمت هاد السؤال',
    'I AM CONFUSED'
  ])('recognises %s', (text) => {
    expect(helpRequestedIn(text)).toBe(true);
  });

  it('does not flag routine discussion', () => {
    expect(helpRequestedIn('I think the primary key should be the student id')).toBe(false);
    expect(helpRequestedIn('Let us check the second normal form together')).toBe(false);
  });
});
