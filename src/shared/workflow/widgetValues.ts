/** Positional values can be named only when the catalog proves the whole serialized layout. */
export function widgetOrderMatches(values: unknown, order: readonly string[] | undefined, reliable = true): boolean {
  return Array.isArray(values) && reliable && order !== undefined && order.length === values.length;
}
