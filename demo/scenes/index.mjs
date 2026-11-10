// Recording order. Practice must run before the instructor scene so insights have data;
// the reader scene must run first after `demo/reset.sh` (it uses the one-request coach approval).
import { landing, onboarding, reader, practice, nardouchVoice, lab, progress, tasks } from './learner.mjs';
import { room } from './room.mjs';
import { instructor } from './instructor.mjs';

export const SCENES = { landing, onboarding, reader, practice, 'nardouch-voice': nardouchVoice, lab, room, progress, tasks, instructor };
