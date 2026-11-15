/**
 * Joins class names, skipping empty values. Used by every ui component and many panels, so a conditional class is
 * written `cx(styles.a, on && styles.b)` instead of string templates.
 */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
