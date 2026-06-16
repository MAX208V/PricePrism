// 从 dashboard.js 提取的工具函数

export function fmtUTC(iso: string | number | Date): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n: number): string => n < 10 ? "0" + n : "" + n;
  return pad(d.getUTCMonth() + 1) + "/" + pad(d.getUTCDate()) + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " UTC";
}

export function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}