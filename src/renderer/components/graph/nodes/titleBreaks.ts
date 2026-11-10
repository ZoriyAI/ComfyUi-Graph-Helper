/**
 * A node class name ("CheckpointLoaderSimple", "easy_loraStack") has no spaces to wrap at, so a narrow or scaled
 * title would break in the middle of a word. These are the pieces a title may wrap between: before each capital
 * that follows a lowercase letter or digit, and after each underscore. A title with spaces wraps by itself and
 * comes back whole, as does a short one.
 */
export function titleParts(title: string): string[] {
  if (title.length < 12 || /\s/.test(title)) return [title];
  const parts = title.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=_)/).filter((part) => part !== '');
  return parts.length > 1 ? parts : [title];
}
