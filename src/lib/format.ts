export function formatFeet(ft: number): string {
  const negative = ft < 0;
  let inches = Math.round(Math.abs(ft) * 12);
  const feet = Math.floor(inches / 12);
  inches %= 12;
  return `${negative ? "-" : ""}${feet}' ${inches}"`;
}

export function formatArea(sqFt: number): string {
  return `${sqFt.toFixed(1)} sq ft`;
}

export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (seconds < 172800) return "Yesterday";
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function hitLabel(slope: string, hits?: number, wind?: number): string {
  const parts: string[] = [];
  if (typeof hits === "number") parts.push(`${slope}=${hits}`);
  if (typeof wind === "number") parts.push(`${slope}=${wind}W`);
  return parts.join(" · ");
}
