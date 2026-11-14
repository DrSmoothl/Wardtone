import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { Store } from "./storage";

const installSchema = z.object({
  key: z.string(),
  displayName: z.string(),
  installLocation: z.string(),
  displayIcon: z.string(),
});
export type WindowsInstall = z.infer<typeof installSchema>;

// JSON + UTF-8 avoids decoding reg.exe output with the wrong Windows code page.
const registryScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$records = New-Object 'System.Collections.Generic.List[object]'
foreach ($hiveName in @('CurrentUser', 'LocalMachine')) {
  foreach ($viewName in @('Registry64', 'Registry32')) {
    $hive = [Enum]::Parse([Microsoft.Win32.RegistryHive], $hiveName)
    $view = [Enum]::Parse([Microsoft.Win32.RegistryView], $viewName)
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    $uninstall = $null
    try {
      $uninstall = $base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall')
      if ($null -eq $uninstall) { continue }
      foreach ($name in $uninstall.GetSubKeyNames()) {
        $entry = $uninstall.OpenSubKey($name)
        if ($null -eq $entry) { continue }
        try {
          $raw = [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames
          $records.Add([ordered]@{
            key = $hiveName + '/' + $viewName + '/' + $name
            displayName = [string]$entry.GetValue('DisplayName', '', $raw)
            installLocation = [string]$entry.GetValue('InstallLocation', '', $raw)
            displayIcon = [string]$entry.GetValue('DisplayIcon', '', $raw)
          })
        } finally { $entry.Dispose() }
      }
    } finally {
      if ($null -ne $uninstall) { $uninstall.Dispose() }
      $base.Dispose()
    }
  }
}
[Console]::Write((ConvertTo-Json -InputObject @($records.ToArray()) -Compress -Depth 4))
`;

export async function readWindowsInstalls(): Promise<WindowsInstall[]> {
  const { stdout } = await promisify(execFile)(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(registryScript, "utf16le").toString("base64"),
    ],
    {
      windowsHide: true,
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  return z
    .array(installSchema)
    .parse(JSON.parse(stdout.replace(/^\uFEFF/, "")));
}

export function windowsSearchRoots(
  installs: WindowsInstall[],
  environment: NodeJS.ProcessEnv,
  home: string,
) {
  const env = new Map(
    Object.entries(environment).map(([key, value]) => [
      key.toUpperCase(),
      value,
    ]),
  );
  const roots = new Map<string, string>();
  const rejected: {
    key: string;
    field: string;
    value: string;
    reason: string;
  }[] = [];
  function absolute(value: string) {
    const expanded = value
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/%([^%]+)%/g, (token, name: string) => {
        const replacement = env.get(name.toUpperCase());
        if (!replacement) throw new Error("未定义环境变量：" + token);
        return replacement;
      });
    // A drive-relative path (C:Games) or root-relative path (\Games) is ambiguous.
    if (!/^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i.test(expanded))
      throw new Error("安装路径不是完整的 Windows 路径");
    return path.win32.normalize(expanded);
  }
  function add(value: string) {
    const normalized = absolute(value);
    const root =
      normalized === path.win32.parse(normalized).root
        ? normalized
        : normalized.replace(/[\\/]+$/, "");
    roots.set(root.toLowerCase(), root);
  }
  for (const entry of installs) {
    if (
      !/arknights|明日方舟|hypergryph|gryphline/i.test(
        Object.values(entry).join(" "),
      )
    )
      continue;
    for (const field of ["installLocation", "displayIcon"] as const) {
      const value = entry[field].trim();
      if (!value) continue;
      try {
        if (field === "installLocation") add(value);
        else {
          const icon = absolute(value.replace(/,\s*-?\d+\s*$/, ""));
          if (!/\.(?:exe|ico|dll)$/i.test(icon))
            throw new Error("DisplayIcon 未指向可识别的图标或程序");
          add(path.win32.dirname(icon));
        }
      } catch (error) {
        rejected.push({ key: entry.key, field, value, reason: String(error) });
      }
    }
  }
  const local =
    env.get("LOCALAPPDATA") || path.win32.join(home, "AppData", "Local");
  add(path.win32.join(local, "..", "LocalLow", "Hypergryph"));
  for (const name of ["Hypergryph", "Gryphline", "Arknights"])
    add(path.win32.join(local, name));
  const systemDrive = env.get("SYSTEMDRIVE") || "C:";
  const programRoots = [
    env.get("PROGRAMFILES") ||
      path.win32.join(systemDrive + "\\", "Program Files"),
    env.get("PROGRAMFILES(X86)") ||
      path.win32.join(systemDrive + "\\", "Program Files (x86)"),
    env.get("PROGRAMW6432"),
  ].filter((value): value is string => Boolean(value));
  for (const base of programRoots)
    for (const name of ["Arknights", "明日方舟", "Hypergryph", "Gryphline"])
      add(path.win32.join(base, name));
  for (let code = 65; code <= 90; code++)
    for (const name of [
      "Arknights",
      "明日方舟",
      "Hypergryph",
      "Gryphline",
      "Games",
    ])
      add(`${String.fromCharCode(code)}:\\${name}`);
  return { roots: [...roots.values()], rejected };
}

export async function discoverWindowsRoots(store: Store) {
  await store.log("info", "discovery", "windows.registry.started", {});
  try {
    const entries = await readWindowsInstalls();
    const result = windowsSearchRoots(entries, process.env, os.homedir());
    for (const rejected of result.rejected)
      await store.log(
        "warn",
        "discovery",
        "windows.registry.path-rejected",
        rejected,
      );
    await store.log("info", "discovery", "windows.roots", {
      entries: entries.length,
      roots: result.roots,
    });
    return result.roots;
  } catch (error) {
    await store.log("error", "discovery", "windows.registry.failed", {
      error: String(error),
    });
    throw new Error("Windows 安装信息读取失败：" + String(error), {
      cause: error,
    });
  }
}
