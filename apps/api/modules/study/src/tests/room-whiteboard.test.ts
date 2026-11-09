const mockModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
jest.mock('../models/RoomWhiteboard', () => ({ RoomWhiteboard: mockModel }));

import {
  readWhiteboard,
  setWhiteboardLocked,
  writeWhiteboardElements
} from '../services/roomWhiteboard';

// The converted model returns the row directly; `.lean()` no longer exists.
const lean = (value: unknown) => Promise.resolve(value);
const raw = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  ...over
});
const stored = (id: string, version = 1, author = 'alice') => ({
  ...raw(id, { version }),
  customData: { authorId: author }
});

describe('room whiteboard service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty board for a room that has none', async () => {
    mockModel.findOne.mockReturnValue(lean(null));
    expect(await readWhiteboard('room_1')).toEqual({
      roomId: 'room_1',
      version: 0,
      locked: false,
      elements: []
    });
  });

  it('creates the board on first write with the author stamped from the caller', async () => {
    mockModel.findOne.mockReturnValue(lean(null));
    mockModel.findOneAndUpdate.mockReturnValue(
      lean({
        version: 1,
        locked: false,
        elements: [{ ...raw('a'), customData: { authorId: 'bob' } }]
      })
    );
    const { board, changed } = await writeWhiteboardElements('room_1', 'bob', 'host', [
      raw('a', { customData: { authorId: 'mallory' } })
    ]);
    expect(changed).toBe(true);
    expect(board.version).toBe(1);
    const update = mockModel.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set.elements[0].customData.authorId).toBe('bob');
  });

  it('retries when another participant saved first, keeping both edits', async () => {
    mockModel.findOne
      .mockReturnValueOnce(lean({ version: 1, locked: false, elements: [stored('a')] }))
      .mockReturnValueOnce(
        lean({ version: 2, locked: false, elements: [stored('a'), stored('b', 1, 'carol')] })
      );
    mockModel.findOneAndUpdate
      .mockReturnValueOnce(lean(null)) // lost the compare-and-set
      .mockImplementationOnce((_filter: unknown, update: { $set: { elements: unknown[] } }) =>
        lean({ version: 3, locked: false, elements: update.$set.elements })
      );
    const { board } = await writeWhiteboardElements('room_1', 'bob', 'host', [raw('c')]);
    expect(board.elements.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('gives up with a conflict instead of overwriting after repeated races', async () => {
    mockModel.findOne.mockReturnValue(lean({ version: 1, locked: false, elements: [stored('a')] }));
    mockModel.findOneAndUpdate.mockReturnValue(lean(null));
    await expect(
      writeWhiteboardElements('room_1', 'bob', 'host', [raw('c')])
    ).rejects.toMatchObject({ status: 409 });
  });

  it('does not write when nothing changed', async () => {
    mockModel.findOne.mockReturnValue(
      lean({ version: 5, locked: false, elements: [stored('a', 5)] })
    );
    const { changed } = await writeWhiteboardElements('room_1', 'bob', 'host', [
      raw('a', { version: 2 })
    ]);
    expect(changed).toBe(false);
    expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('blocks non-hosts on a locked board but lets the host edit', async () => {
    mockModel.findOne.mockReturnValue(lean({ version: 1, locked: true, elements: [] }));
    await expect(
      writeWhiteboardElements('room_1', 'bob', 'host', [raw('a')])
    ).rejects.toMatchObject({ status: 403 });
    mockModel.findOneAndUpdate.mockImplementation(
      (_f: unknown, u: { $set: { elements: unknown[] } }) =>
        lean({ version: 2, locked: true, elements: u.$set.elements })
    );
    const { changed } = await writeWhiteboardElements('room_1', 'host', 'host', [raw('a')]);
    expect(changed).toBe(true);
  });

  it('rejects disallowed element types before touching the database', async () => {
    await expect(
      writeWhiteboardElements('room_1', 'bob', 'host', [raw('a', { type: 'iframe' })])
    ).rejects.toMatchObject({
      status: 400
    });
    expect(mockModel.findOne).not.toHaveBeenCalled();
  });

  it('locks via upsert', async () => {
    mockModel.findOneAndUpdate.mockReturnValue(lean({ version: 0, locked: true, elements: [] }));
    expect((await setWhiteboardLocked('room_1', true)).locked).toBe(true);
  });
});
