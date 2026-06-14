/**
 * Parse employee ID from filename.
 * Rule: Extract everything before the first "__" (double underscore).
 * Fallback: If no "__" present, use first 8 characters.
 */
export function parseFilename(filename: string): string {
  const baseName = filename.replace(/\.pdf$/i, '')

  const doubleUnderscoreIndex = baseName.indexOf('__')
  if (doubleUnderscoreIndex > 0) {
    return baseName.substring(0, doubleUnderscoreIndex)
  }

  // Fallback: first 8 characters (edge case, likely never happens)
  return baseName.substring(0, Math.min(8, baseName.length))
}
