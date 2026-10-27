import { StudyRoom } from '../models/StudyRoom';
import { canReadCourse } from './resourceAccess';
import { validateRoomRevision } from './roomActivity';
import { DEFAULT_BINARY_SEARCH, parseBinarySearchState } from '../../../../shared/visualization';

/** Separate demonstration projection, outside assessment and frozen activity DTOs. */
export async function readRoomVisualization(actor: string, roomId: string) {
  const read = () =>
    StudyRoom.findOne({
      roomId,
      status: 'active',
      participants: { $elemMatch: { userId: actor, leftAt: { $exists: false } } }
    }).lean();
  const original = await read();
  if (!original)
    throw Object.assign(new Error('Room visualization access denied'), { status: 403 });
  if (original.courseId && !(await canReadCourse(actor, original.courseId)))
    throw Object.assign(new Error('Course access unavailable'), { status: 403 });
  await validateRoomRevision(actor, original);
  const current = await read();
  if (!current) throw Object.assign(new Error('Room visualization access denied'), { status: 403 });
  if (current.courseId && !(await canReadCourse(actor, current.courseId)))
    throw Object.assign(new Error('Course access unavailable'), { status: 403 });
  await validateRoomRevision(actor, current);
  if (current.courseId && !(await canReadCourse(actor, current.courseId)))
    throw Object.assign(new Error('Course access unavailable'), { status: 403 });
  if (
    !(await StudyRoom.exists({
      _id: current._id,
      status: 'active',
      seq: current.seq,
      participants: { $elemMatch: { userId: actor, leftAt: { $exists: false } } }
    }))
  )
    throw Object.assign(new Error('Room changed; recover the current illustration'), {
      status: 409
    });
  return {
    roomId,
    seq: current.seq,
    state: parseBinarySearchState(current.visualizationState || DEFAULT_BINARY_SEARCH)
  };
}
