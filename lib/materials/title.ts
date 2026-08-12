export function materialTitleFromFilename(filename: string): string {
  const title = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (title || "Study Material").slice(0, 120);
}

export function materialTitleFromNote(text: string): string {
  const firstMeaningfulLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, "").trim())
    .find(Boolean);

  return (firstMeaningfulLine || "Study Note").slice(0, 120);
}
