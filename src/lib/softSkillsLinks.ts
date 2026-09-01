/** Public Soft Skills profile for a student. */
export function softSkillsProfileHref(username: string | null | undefined): string | null {
  const normalized = username?.trim();
  if (!normalized) return null;
  return `/user/${encodeURIComponent(normalized)}`;
}
