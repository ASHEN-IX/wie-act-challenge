import {
  MAX_ELEMENTS,
  WhiteboardError,
  mergeElements,
  sanitizeElement,
  sanitizeUpdate,
  type BoardElement
} from '../shared/ednova/whiteboard';

const el = (over: Record<string, unknown> = {}, author = 'alice'): BoardElement =>
  sanitizeElement(
    { id: 'a', type: 'rectangle', version: 1, versionNonce: 5, isDeleted: false, ...over },
    author
  );

describe('whiteboard element validation', () => {
  it('stamps the authenticated author over any client claim', () => {
    const e = sanitizeElement(
      { id: 'a', type: 'text', version: 1, versionNonce: 1, customData: { authorId: 'mallory' } },
      'alice'
    );
    expect(e.customData.authorId).toBe('alice');
  });

  it.each(['image', 'iframe', 'embeddable', 'selection', 'script'])(
    'rejects element type %s',
    (type) => {
      expect(() => sanitizeElement({ id: 'a', type, version: 1, versionNonce: 1 }, 'x')).toThrow(
        WhiteboardError
      );
    }
  );

  it.each([
    { id: '../x' },
    { id: '' },
    { id: 'a'.repeat(65) },
    { version: 1.5 },
    { version: -1 },
    { versionNonce: 'x' }
  ])('rejects malformed fields %j', (over) => {
    expect(() => el(over)).toThrow(WhiteboardError);
  });

  it('rejects oversized elements and oversized updates', () => {
    expect(() => el({ points: new Array(40000).fill([123456.789, 123456.789]) })).toThrow(
      /too large/
    );
    expect(() => sanitizeUpdate(new Array(501).fill({}), 'x')).toThrow(/Too many/);
    expect(() => sanitizeUpdate('nope', 'x')).toThrow(/array/);
  });
});

describe('whiteboard merge', () => {
  it('keeps edits to different elements from two participants', () => {
    const base = [el({ id: 'a' }), el({ id: 'b' })];
    const fromAlice = el({ id: 'a', version: 2, x: 10 }, 'alice');
    const fromBob = el({ id: 'b', version: 2, x: 20 }, 'bob');
    const first = mergeElements(base, [fromAlice]).elements;
    const second = mergeElements(first, [fromBob]).elements;
    expect(second.find((e) => e.id === 'a')?.x).toBe(10);
    expect(second.find((e) => e.id === 'b')?.x).toBe(20);
  });

  it('converges regardless of arrival order for the same element', () => {
    const base = [el()];
    const a = el({ version: 2, versionNonce: 9, x: 1 });
    const b = el({ version: 2, versionNonce: 3, x: 2 });
    const one = mergeElements(mergeElements(base, [a]).elements, [b]).elements[0];
    const two = mergeElements(mergeElements(base, [b]).elements, [a]).elements[0];
    expect(one.x).toBe(2);
    expect(two.x).toBe(2);
  });

  it('never lets an older version overwrite a newer one', () => {
    const base = [el({ version: 5, x: 5 })];
    const result = mergeElements(base, [el({ version: 4, x: 4 })]);
    expect(result.changed).toBe(false);
    expect(result.elements[0].x).toBe(5);
  });

  it('keeps the original author when someone else edits an element', () => {
    const base = [el({}, 'alice')];
    const edited = el({ version: 2 }, 'bob');
    const merged = mergeElements(base, [edited]).elements[0];
    expect(merged.customData.authorId).toBe('alice');
  });

  it('records deletion as a tombstone so it propagates', () => {
    const merged = mergeElements([el()], [el({ version: 2, isDeleted: true })]).elements;
    expect(merged[0].isDeleted).toBe(true);
  });

  it('drops tombstones before refusing a full board', () => {
    const live = Array.from({ length: MAX_ELEMENTS - 1 }, (_, i) => el({ id: `l${i}` }));
    const dead = [el({ id: 'd1', isDeleted: true }), el({ id: 'd2', isDeleted: true })];
    const result = mergeElements([...live, ...dead.slice(0, 1)], [dead[1]]);
    expect(result.elements.every((e) => !e.isDeleted)).toBe(true);
    const full = Array.from({ length: MAX_ELEMENTS }, (_, i) => el({ id: `f${i}` }));
    expect(() => mergeElements(full, [el({ id: 'extra' })])).toThrow(/full/);
  });
});
