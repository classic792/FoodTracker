export const readCookie = (header, name) => {
  if (typeof header !== "string") return null;
  let found = false;
  let value = null;
  for (const part of header.split(";")) {
    const entry = part.trim();
    const separator = entry.indexOf("=");
    const key = separator < 0 ? entry : entry.slice(0, separator).trim();
    if (key !== name) continue;
    if (found || separator < 0) return null;
    found = true;
    try {
      value = decodeURIComponent(entry.slice(separator + 1));
    } catch {
      return null;
    }
    if (!value || /[\s;\x00-\x1f\x7f]/.test(value)) return null;
  }
  return value;
};
