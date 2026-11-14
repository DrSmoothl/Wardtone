import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readWindowsInstalls,
  windowsSearchRoots,
  type WindowsInstall,
} from "../src/core/windows-discovery";
import { findRoots, manifestName } from "../src/core/game";
import { Store } from "../src/core/storage";

const home = "C:\\Users\\测试用户";
const install = (values: Partial<WindowsInstall>): WindowsInstall => ({
  key: "CurrentUser/Registry64/Arknights",
  displayName: "明日方舟",
  installLocation: "",
  displayIcon: "",
  ...values,
});

describe("Windows install discovery", () => {
  it("searches late drive letters, Unity user data and both Program Files folders", () => {
    const { roots } = windowsSearchRoots([], {}, home);
    expect(roots).toEqual(
      expect.arrayContaining([
        "G:\\Games",
        "Z:\\明日方舟",
        home + "\\AppData\\LocalLow\\Hypergryph",
        "C:\\Program Files\\Arknights",
        "C:\\Program Files (x86)\\Hypergryph",
      ]),
    );
  });

  it("expands environment values without losing Unicode, spaces or case-insensitive variable names", () => {
    const { roots, rejected } = windowsSearchRoots(
      [install({ installLocation: '"%GameDisk%\\我的游戏\\明日方舟"' })],
      { GAMEDISK: "R:", LocalAppData: "S:\\用户数据\\Local" },
      home,
    );
    expect(roots).toContain("R:\\我的游戏\\明日方舟");
    expect(roots).toContain("S:\\用户数据\\LocalLow\\Hypergryph");
    expect(rejected).toEqual([]);
  });

  it("uses DisplayIcon when the installer omitted InstallLocation", () => {
    const { roots, rejected } = windowsSearchRoots(
      [
        install({
          displayIcon: '"H:\\Games, Archive\\明日方舟\\Arknights.exe",-123',
        }),
        install({ displayIcon: "J:\\Custom Games\\Arknights\\icon.ico,0" }),
      ],
      {},
      home,
    );
    expect(roots).toContain("H:\\Games, Archive\\明日方舟");
    expect(roots).toContain("J:\\Custom Games\\Arknights");
    expect(rejected).toEqual([]);
  });

  it("deduplicates registry views and common roots with Windows path semantics", () => {
    const { roots } = windowsSearchRoots(
      [
        install({ installLocation: "G:/Arknights/" }),
        install({
          installLocation: "g:\\arknights",
          displayIcon: '"G:\\Arknights\\Arknights.exe",0',
        }),
      ],
      {},
      home,
    );
    expect(
      roots.filter((root) => root.toLowerCase() === "g:\\arknights"),
    ).toHaveLength(1);
  });

  it("reports invalid game paths and ignores unrelated uninstall entries", () => {
    const { roots, rejected } = windowsSearchRoots(
      [
        install({ installLocation: "C:relative" }),
        install({ installLocation: "%NO_SUCH_VARIABLE%\\Arknights" }),
        install({ installLocation: "\\relative" }),
        install({ displayIcon: "C:\\Games\\not-an-icon" }),
        install({
          key: "Unrelated",
          displayName: "Other app",
          installLocation: "L:\\OtherApp",
        }),
      ],
      {},
      home,
    );
    expect(rejected).toHaveLength(4);
    expect(
      rejected.every((entry) => entry.key && entry.field && entry.reason),
    ).toBe(true);
    expect(roots).not.toContain("L:\\OtherApp");
  });

  it("finds nested manifests under a Unicode installation directory", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "wardtone-discovery-"),
    );
    try {
      const game = path.join(root, "我的游戏", "明日方舟");
      const bundles = path.join(
        game,
        "Arknights_Data",
        "StreamingAssets",
        "Bundles",
      );
      await fs.mkdir(bundles, { recursive: true });
      await fs.writeFile(path.join(bundles, manifestName), "{}");
      const store = new Store(path.join(root, "store"));
      await store.init();
      expect(await findRoots(game, store)).toEqual([bundles]);
      expect(await findRoots(game, store, 1)).toEqual([]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform === "win32")(
    "reads actual 32/64-bit Windows registry entries and resolves their Unicode resource directories",
    async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "戍声识别-"));
      const keyName = "Wardtone-CI-" + randomUUID();
      const env = {
        ...process.env,
        WARDTONE_CI_INSTALL_ROOT: root,
        WARDTONE_CI_REGISTRY_KEY: keyName,
      };
      const run = (script: string) =>
        promisify(execFile)(
          "powershell.exe",
          [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            Buffer.from(script, "utf16le").toString("base64"),
          ],
          { env, windowsHide: true, timeout: 15000 },
        );
      const setup = String.raw`
$ErrorActionPreference = 'Stop'
foreach ($viewName in @('Registry32', 'Registry64')) {
  $view = [Enum]::Parse([Microsoft.Win32.RegistryView], $viewName)
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, $view)
  try {
    $key = $base.CreateSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall\' + $env:WARDTONE_CI_REGISTRY_KEY + '-' + $viewName)
    try {
      $key.SetValue('DisplayName', '明日方舟 CI 测试')
      $key.SetValue('InstallLocation', '%WARDTONE_CI_INSTALL_ROOT%', [Microsoft.Win32.RegistryValueKind]::ExpandString)
    } finally { $key.Dispose() }
  } finally { $base.Dispose() }
}`;
      const cleanup = String.raw`
$ErrorActionPreference = 'Stop'
foreach ($viewName in @('Registry32', 'Registry64')) {
  $view = [Enum]::Parse([Microsoft.Win32.RegistryView], $viewName)
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, $view)
  try {
    $base.DeleteSubKeyTree('Software\Microsoft\Windows\CurrentVersion\Uninstall\' + $env:WARDTONE_CI_REGISTRY_KEY + '-' + $viewName, $false)
  } finally { $base.Dispose() }
}`;
      try {
        await run(setup);
        const entries = (await readWindowsInstalls()).filter((entry) =>
          entry.key.includes(keyName),
        );
        expect(
          entries.some((entry) => entry.key.includes("/Registry32/")),
        ).toBe(true);
        expect(
          entries.some((entry) => entry.key.includes("/Registry64/")),
        ).toBe(true);
        expect(
          entries.every((entry) => entry.displayName === "明日方舟 CI 测试"),
        ).toBe(true);
        const { roots, rejected } = windowsSearchRoots(
          entries,
          env,
          os.homedir(),
        );
        expect(roots).toContain(root);
        expect(rejected).toEqual([]);
        const bundles = path.join(root, "游戏资源", "Bundles");
        await fs.mkdir(bundles, { recursive: true });
        await fs.writeFile(path.join(bundles, manifestName), "{}");
        const store = new Store(path.join(root, "store"));
        await store.init();
        expect(await findRoots(root, store)).toEqual([bundles]);
      } finally {
        try {
          await run(cleanup);
        } finally {
          await fs.rm(root, { recursive: true, force: true });
        }
      }
    },
  );
});
