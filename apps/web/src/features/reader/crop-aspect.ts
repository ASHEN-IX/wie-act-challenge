/** Reserved display space for a source crop.
 *
 * A crop image has no intrinsic dimensions in the HTML, so its arrival shifts
 * the page. The canonical block already carries a validated bounding box from
 * the region detector, which gives the crop's aspect ratio without trusting
 * the image. Reserving space from that box removes the shift.
 *
 * The box is still untrusted input to this function: it is re-checked here
 * because a stored region predates any contract change, and a malformed box
 * must degrade to "no reservation" rather than a broken layout.
 */

export type CropAspect = {
  /** CSS `aspect-ratio` value, e.g. "4.2". */
  ratio: string;
  /** Whether the reservation is meaningful. A degenerate box does not reserve. */
  reserved: boolean;
};

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 20_000;
const MIN_RATIO = 0.05;
const MAX_RATIO = 20;

/** bbox is [x0, y0, x1, y1] in source units. */
export function cropAspect(bbox: unknown): CropAspect {
  if (!Array.isArray(bbox) || bbox.length !== 4) return { ratio: "1", reserved: false };
  const [x0, y0, x1, y1] = bbox;
  if (![x0, y0, x1, y1].every((value) => typeof value === "number" && Number.isFinite(value)))
    return { ratio: "1", reserved: false };

  const width = Math.abs(x1 - x0);
  const height = Math.abs(y1 - y0);
  if (
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  )
    return { ratio: "1", reserved: false };

  const ratio = width / height;
  // A very wide or very tall crop is legitimate but rare; outside these bounds
  // the box is more likely wrong than the crop is unusual, so do not reserve.
  if (!Number.isFinite(ratio) || ratio < MIN_RATIO || ratio > MAX_RATIO)
    return { ratio: "1", reserved: false };

  return { ratio: ratio.toFixed(3), reserved: true };
}
