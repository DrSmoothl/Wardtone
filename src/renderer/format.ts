export const bytes = (n: number) =>
  n >= 1024 * 1024
    ? (n / 1024 / 1024).toFixed(2) + " MB"
    : n >= 1024
      ? (n / 1024).toFixed(1) + " KB"
      : n + " B";
export const statusText: Record<string, string> = {
  official: "原始资源",
  managed: "已替换",
  changed: "外部修改",
  missing: "未下载",
  committed: "已应用",
  "rolled-back": "已恢复",
  prepared: "等待恢复",
  committing: "写入中断",
  "rolling-back": "恢复中断",
  "recovery-required": "需要恢复",
};
