export function text(form: FormData, key: string, max = 500): string {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`Enter a valid ${key.replaceAll("_", " ")}.`);
  return value.trim();
}
export function optionalText(form: FormData, key: string, max = 2000): string {
  const value = form.get(key);
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > max)
    throw new Error(`Invalid ${key}.`);
  return value.trim();
}
export function choice(
  form: FormData,
  key: string,
  allowed: readonly string[],
): string {
  const value = text(form, key);
  if (!allowed.includes(value)) throw new Error(`Invalid ${key}.`);
  return value;
}
export function integer(
  form: FormData,
  key: string,
  min: number,
  max: number,
): number {
  const value = Number(text(form, key));
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${key} must be between ${min} and ${max}.`);
  return value;
}
