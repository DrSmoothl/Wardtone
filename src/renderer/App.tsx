import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Library,
  AudioLines,
  PencilLine,
  Database,
  ScrollText,
  Settings2,
  Plus,
  Upload,
  RefreshCw,
  CheckCircle2,
  Copy,
  AlertCircle,
  X,
  Download,
  FolderOpen,
  Volume2,
  ChevronRight,
  ShieldCheck,
  Monitor,
} from "lucide-react";
import {
  packKey,
  defaultConfig,
  type AppState,
  type Inventory,
  type VoicePack,
  type PackEntry,
  type Location,
  type LogLine,
  type PlanView,
  type JournalView,
} from "../shared/model";
import { Brand, Help, Modal, Spinner, Empty } from "./components/ui";
import {
  Button,
  Select,
  ScrollArea,
  Disclosure,
  Segmented,
} from "./components/ui";
import { useDelayedBusy } from "./useDelayedBusy";
import { AudioPlayer } from "./components/AudioPlayer";
import { Setup, type Run } from "./Setup";
import { Editor, EntryEditor, BatchEditor, type Preview } from "./Editor";
import {
  Workbench,
  Library as VoiceLibrary,
  Backups,
  Settings,
  Logs,
} from "./Views";
import type { AudioFile } from "./audio";
import { useTheme } from "./themes/useTheme";
import { TerminalIdentity } from "./themes/ThemePresentation";

const navigation = [
  ["home", "工作台", LayoutDashboard, "WORKSPACE"],
  ["library", "语音库", Library, "VOICES"],
  ["editor", "制作", PencilLine, "STUDIO"],
  ["backups", "备份与恢复", Database, "RECOVERY"],
  ["logs", "日志", ScrollText, "EVENTS"],
  ["settings", "设置", Settings2, "SYSTEM"],
] as const;
type Page = (typeof navigation)[number][0];
type DisplayError = { message: string; operation?: string; details?: string };
export default function App() {
  const [state, setState] = useState<AppState | null>(null),
    [inventory, setInventory] = useState<Inventory | null>(null),
    [page, setPage] = useState<Page>("home"),
    [working, setWorking] = useState(""),
    [error, setError] = useState<DisplayError | null>(null),
    [notice, setNotice] = useState(""),
    [progress, setProgress] = useState<LogLine | null>(null),
    [logs, setLogs] = useState<LogLine[]>([]),
    [draft, setDraft] = useState<VoicePack | null>(null),
    [bundle, setBundle] = useState(""),
    [search, setSearch] = useState(""),
    [addLocation, setAddLocation] = useState(false),
    [closeRequested, setCloseRequested] = useState(false);
  const [target, setTarget] = useState<{ bundle: string; clip: string } | null>(
      null,
    ),
    [batch, setBatch] = useState<{ files: AudioFile[]; bundle: string } | null>(
      null,
    ),
    [applyPack, setApplyPack] = useState<VoicePack | null>(null),
    [mode, setMode] = useState<"exact" | "variable">("exact"),
    [timing, setTiming] = useState<"closed" | "hot">("closed"),
    [plan, setPlan] = useState<PlanView | null>(null),
    [pendingDraft, setPendingDraft] = useState<"new" | VoicePack | null>(null),
    [restore, setRestore] = useState<JournalView | null>(null),
    [player, setPlayer] = useState<{ label: string; url: string } | null>(null);
  const operationInFlight = useRef(false),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = !!working;
  useTheme(state?.config ?? defaultConfig);
  const showWorking = useDelayedBusy(busy);
  const lastWorking = useRef(working);
  if (working) lastWorking.current = working;
  const notify = (text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  };
  const run: Run = useCallback(async (label, task) => {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setWorking(label);
    setError(null);
    try {
      await task();
    } catch (cause) {
      const e = cause as Error & { operation?: string; details?: string };
      setError({
        message: e?.message ?? String(cause),
        operation: e?.operation,
        details: e?.details ?? e?.stack,
      });
    } finally {
      operationInFlight.current = false;
      setWorking("");
    }
  }, []);
  const refresh = async () => {
    const result = await window.desktop.invoke<AppState>("state");
    setState(result);
    return result;
  };
  const scan = async () => {
    const result = await window.desktop.invoke<Inventory>("scan");
    setInventory(result);
    return result;
  };
  useEffect(() => {
    if (!window.desktop) {
      setError({ message: "请从戍声桌面应用启动此界面。" });
      return;
    }
    void run("读取本地配置", async () => {
      await window.desktop.invoke("window.ready");
      const current = await refresh();
      if (current.config.selected) await scan();
    });
    return window.desktop.onProgress((line) => {
      setProgress(line);
      setLogs((previous) => [...previous.slice(-2999), line]);
      if (line.event === "desktop.error")
        setError({ message: "桌面操作失败", details: String(line.detail) });
      if (line.event === "backend.stopped")
        setError({
          message: "资源服务已停止，请重启应用并检查恢复记录。",
          details: String(line.detail),
        });
    });
  }, [run]);
  useEffect(
    () => () => {
      if (player) URL.revokeObjectURL(player.url);
    },
    [player],
  );
  const preview: Preview = async (action, input, label) => {
    const result = await window.desktop.invoke<{
      mime: string;
      bytes: Uint8Array;
    }>(action, input);
    setPlayer({
      label,
      url: URL.createObjectURL(
        new Blob([new Uint8Array(result.bytes)], { type: result.mime }),
      ),
    });
  };
  const selectLocation = async (location: Location) => {
    setState(
      await window.desktop.invoke<AppState>("location.select", location),
    );
    await scan();
    setBundle("");
    setAddLocation(false);
    notify("游戏资源已连接");
  };
  const createDraft = async () => {
    const p = await window.desktop.invoke<VoicePack>("pack.new");
    setDraft(p);
    return p;
  };
  const ensureDraft = async () => draft ?? createDraft();
  const addEntries = (entries: PackEntry[]) => {
    setDraft((current) => {
      if (!current) throw new Error("语音包草稿不存在");
      const map = new Map(
        current.entries.map((e) => [e.bundle + "#" + e.clip, e]),
      );
      for (const entry of entries)
        map.set(entry.bundle + "#" + entry.clip, entry);
      return {
        ...current,
        entries: [...map.values()],
        updatedAt: new Date().toISOString(),
      };
    });
  };
  const editVoice = (resource: string, clip: string) =>
    void run("准备替换语音", async () => {
      await ensureDraft();
      setTarget({ bundle: resource, clip });
    });
  const saveDraft = async () => {
    if (!draft) throw new Error("没有可保存的草稿");
    await window.desktop.invoke("pack.save", draft);
    await refresh();
    notify("语音包已保存");
  };
  const exportDraft = async () => {
    if (!draft) throw new Error("没有可导出的草稿");
    await window.desktop.invoke("pack.save", draft);
    await refresh();
    const file = await window.desktop.invoke<string | null>(
      "pack.export",
      packKey(draft),
    );
    if (file) notify("语音包已导出");
  };
  const diagnostics = () =>
    void run("导出诊断", async () => {
      const result = await window.desktop.invoke<string | null>("diagnostics");
      if (result) notify("诊断记录已导出");
    });
  const switchDraft = (next: "new" | VoicePack) => {
    if (draftDirty) {
      setPendingDraft(next);
      return;
    }
    void openDraft(next);
  };
  const openDraft = (next: "new" | VoicePack) =>
    run("打开制作草稿", async () => {
      if (next === "new") await createDraft();
      else setDraft(structuredClone(next));
      setPendingDraft(null);
      setPage("editor");
    });
  const newDraft = () => switchDraft("new");
  const importShared = () =>
    void run("添加分享语音包", async () => {
      const pack = await window.desktop.invoke<VoicePack | null>("pack.import");
      if (pack) {
        await refresh();
        notify("已添加 " + pack.name);
      }
    });
  const showPlan = (pack: VoicePack) => {
    setMode(state!.config.replacementMode);
    setTiming(state!.config.replacementTiming);
    setApplyPack(pack);
    setPlan(null);
  };
  const editorExisting = draft?.entries.find(
    (e) => e.bundle === target?.bundle && e.clip === target?.clip,
  );
  const title = navigation.find((n) => n[0] === page)![1];
  const selectedLocation = state?.config.locations.find(
    (l) => l.id === state.config.selected,
  );
  const draftDirty =
    !!draft &&
    JSON.stringify(draft) !==
      JSON.stringify(state?.packs.find((p) => packKey(p) === packKey(draft)));
  useEffect(
    () =>
      window.desktop?.onCloseRequested(() => {
        if (draftDirty || busy) setCloseRequested(true);
        else
          void window.desktop
            .invoke("window.confirmClose")
            .catch((cause) =>
              setError({ message: "退出失败：" + String(cause) }),
            );
      }),
    [draftDirty, busy],
  );
  const errorPanel = error && (
    <div className="error-toast" role="alert">
      <div>
        <AlertCircle size={18} />
        <strong>{error.message}</strong>
        <Button
          variant="ghost"
          className="icon-button"
          aria-label="关闭错误提示"
          onClick={() => setError(null)}
        >
          <X size={16} />
        </Button>
      </div>
      {error.operation && (
        <small className="mono">操作编号 {error.operation}</small>
      )}
      {error.details && (
        <Disclosure title="详细信息">
          <pre>{error.details}</pre>
          <Button
            size="sm"
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  [error.message, error.operation, error.details]
                    .filter(Boolean)
                    .join("\n"),
                )
                .then(() => notify("诊断信息已复制"))
                .catch((cause) =>
                  setError({ message: "复制失败：" + String(cause) }),
                );
            }}
          >
            <Copy />
            复制诊断信息
          </Button>
        </Disclosure>
      )}
    </div>
  );
  return (
    <>
      {state?.config.selected && (
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          跳到主要内容
        </a>
      )}
      <div className="titlebar">
        <span>Wardtone</span>
      </div>
      {errorPanel}
      {notice && (
        <div
          className="notice"
          role="status"
          onPointerEnter={() => clearTimeout(noticeTimer.current)}
          onPointerLeave={() => {
            noticeTimer.current = setTimeout(() => setNotice(""), 4000);
          }}
        >
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}
      {!state ? (
        <div className="boot">
          {working ? (
            <>
              <Brand />
              <Spinner />
              <span>{working}</span>
            </>
          ) : (
            <>
              <Brand />
              <h1>无法读取本地配置</h1>
              <div className="actions">
                <Button onClick={diagnostics}>
                  <Download size={16} />
                  导出诊断
                </Button>
                <Button
                  onClick={() =>
                    void run("打开数据目录", async () => {
                      await window.desktop.invoke("open.data");
                    })
                  }
                >
                  <FolderOpen size={16} />
                  打开数据目录
                </Button>
                <Button
                  onClick={() =>
                    void run("重建配置", async () => {
                      setState(
                        await window.desktop.invoke<AppState>("config.repair"),
                      );
                      notify("已备份原配置并重建");
                    })
                  }
                >
                  备份并重建配置
                </Button>
              </div>
            </>
          )}
        </div>
      ) : !state.config.selected ? (
        <ScrollArea className="onboarding-scroll">
          <div className="onboarding">
            <Setup run={run} busy={busy} onSelect={selectLocation} />
            {showWorking && (
              <div className="setup-progress">
                <Spinner />
                {lastWorking.current}
              </div>
            )}
          </div>
        </ScrollArea>
      ) : (
        <div className="app-layout">
          <aside className="sidebar">
            <Brand small />
            <TerminalIdentity theme={state.config.theme} />
            <nav aria-label="主要导航">
              {navigation.map(([id, label, Icon, english]) => (
                <Button
                  key={id}
                  aria-current={page === id ? "page" : undefined}
                  variant="ghost"
                  className={
                    (page === id ? "active " : "") +
                    (id === "backups" ? "nav-group-start" : "")
                  }
                  onClick={() => {
                    setPage(id);
                    if (id === "logs")
                      void run("读取操作日志", async () =>
                        setLogs(await window.desktop.invoke<LogLine[]>("logs")),
                      );
                  }}
                >
                  <Icon size={16} />
                  <span className="nav-label">
                    {label}
                    <small>{english}</small>
                  </span>
                  <span className="nav-index" aria-hidden="true">
                    0{navigation.findIndex(([item]) => item === id) + 1}
                  </span>
                  {id === "editor" && draftDirty && (
                    <i className="unsaved-dot" />
                  )}
                  {id === "backups" &&
                    state.journals.some(
                      (j) => !["committed", "rolled-back"].includes(j.status),
                    ) && <span className="warning-dot" />}
                </Button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <Button
                variant="ghost"
                className="connection-button"
                title={
                  "游戏连接：" + (selectedLocation?.label ?? "选择资源目录")
                }
                aria-label={
                  "游戏连接：" + (selectedLocation?.label ?? "选择资源目录")
                }
                onClick={() => setAddLocation(true)}
              >
                <span className="status-dot" />
                <span>
                  <strong>
                    {selectedLocation?.kind === "adb"
                      ? "安卓模拟器"
                      : "本机客户端"}
                  </strong>
                  <small>{inventory ? "资源已连接" : "待扫描资源"}</small>
                </span>
                <Monitor className="connection-icon" />
                <ChevronRight size={14} />
              </Button>
              <small className="app-version mono">
                Wardtone {state.version}
              </small>
            </div>
          </aside>
          <main className="main" id="main-content" tabIndex={-1}>
            <header className="page-header">
              <div className="page-title">
                <div className="page-heading">
                  <span className="page-overline" aria-hidden="true">
                    0{navigation.findIndex((n) => n[0] === page) + 1} /{" "}
                    {navigation.find((n) => n[0] === page)![3]}
                  </span>
                  <h1>{title}</h1>
                </div>
                {page === "library" && (
                  <Help>
                    按当前游戏清单识别终端播报、公共音效和背景音乐。原音试听从匹配当前版本的备份读取。
                  </Help>
                )}
                {page === "editor" && draftDirty && (
                  <span className="tag">未保存</span>
                )}
              </div>
              <div className="actions">
                {page === "home" && (
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={importShared}
                  >
                    <Upload size={16} />
                    添加语音包
                  </Button>
                )}
                {page === "editor" && (
                  <Button disabled={busy} onClick={newDraft}>
                    <Plus size={16} />
                    新建
                  </Button>
                )}
                {page === "library" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run("重新扫描资源", async () => {
                        await scan();
                        notify("资源已刷新");
                      })
                    }
                  >
                    <RefreshCw size={16} />
                    重新扫描
                  </Button>
                )}
              </div>
            </header>
            <ScrollArea className="main-scroll">
              <div className={"page-content page-" + page}>
                {page === "home" && (
                  <Workbench
                    state={state}
                    inventory={inventory}
                    busy={busy}
                    onNew={newDraft}
                    onImport={importShared}
                    onEdit={(p) => switchDraft(p)}
                    onApply={showPlan}
                    onExport={(p) =>
                      void run("导出语音包", async () => {
                        if (
                          await window.desktop.invoke("pack.export", packKey(p))
                        )
                          notify("语音包已导出");
                      })
                    }
                    onScan={() =>
                      void run("扫描资源", async () => {
                        await scan();
                      })
                    }
                    onLibrary={() => setPage("library")}
                  />
                )}
                {page === "library" && (
                  <VoiceLibrary
                    inventory={inventory}
                    bundle={bundle}
                    setBundle={setBundle}
                    search={search}
                    setSearch={setSearch}
                    draft={draft}
                    busy={busy}
                    run={run}
                    preview={preview}
                    onEdit={editVoice}
                    onBulk={() =>
                      void run("添加批量音频", async () => {
                        await ensureDraft();
                        const files = await window.desktop.invoke<AudioFile[]>(
                          "pick.audio",
                          { multiple: true },
                        );
                        if (files.length) setBatch({ files, bundle });
                      })
                    }
                    onSilence={(entries) =>
                      void run("添加静音条目", async () => {
                        await ensureDraft();
                        addEntries(entries);
                        notify("已添加 " + entries.length + " 条静音替换");
                      })
                    }
                  />
                )}
                {page === "editor" && (
                  <Editor
                    draft={draft}
                    setDraft={setDraft}
                    inventory={inventory}
                    run={run}
                    busy={busy}
                    save={saveDraft}
                    exportDraft={exportDraft}
                    addFromLibrary={() => setPage("library")}
                    onNew={newDraft}
                    editEntry={(e) =>
                      void run("打开语音编辑", async () => {
                        if (!inventory) throw new Error("资源尚未扫描");
                        setTarget({ bundle: e.bundle, clip: e.clip });
                      })
                    }
                    preview={preview}
                  />
                )}
                {page === "backups" && (
                  <Backups
                    journals={state.journals}
                    busy={busy}
                    onRestore={setRestore}
                  />
                )}
                {page === "settings" && (
                  <Settings
                    config={state.config}
                    save={(config) =>
                      void run("保存设置", async () => {
                        const previous = state.config.selected;
                        setState(
                          await window.desktop.invoke<AppState>(
                            "config.save",
                            config,
                          ),
                        );
                        if (previous !== config.selected) {
                          setInventory(null);
                          await scan();
                          setBundle("");
                        }
                      })
                    }
                    busy={busy}
                    onAdd={() => setAddLocation(true)}
                    onDiagnostics={diagnostics}
                    onOpenData={() =>
                      void run("打开数据目录", async () => {
                        await window.desktop.invoke("open.data");
                      })
                    }
                  />
                )}
                {page === "logs" && (
                  <Logs
                    lines={logs}
                    busy={busy}
                    refresh={() =>
                      void run("刷新日志", async () =>
                        setLogs(await window.desktop.invoke<LogLine[]>("logs")),
                      )
                    }
                    exportDiagnostics={diagnostics}
                  />
                )}
              </div>
            </ScrollArea>
            {player && (
              <AudioPlayer
                source={player}
                onClose={() => setPlayer(null)}
                onError={(message) => setError({ message })}
              />
            )}
            <footer className="statusbar">
              <span className="status-text">
                {showWorking ? (
                  <>
                    <Spinner />
                    {lastWorking.current}
                  </>
                ) : (
                  <>
                    <span className="status-dot" />
                    就绪
                  </>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="status-log"
                onClick={() => {
                  setPage("logs");
                  void run("读取日志", async () =>
                    setLogs(await window.desktop.invoke<LogLine[]>("logs")),
                  );
                }}
              >
                <ScrollText />
                查看日志
              </Button>
            </footer>
          </main>
        </div>
      )}
      <Modal
        title="游戏连接"
        open={addLocation}
        onClose={() => setAddLocation(false)}
        wide
      >
        <div className="dialog-body">
          <Setup compact run={run} busy={busy} onSelect={selectLocation} />
        </div>
      </Modal>
      {target && inventory && (
        <EntryEditor
          key={target.bundle + target.clip}
          target={target}
          existing={editorExisting}
          inventory={inventory}
          run={run}
          busy={busy}
          onSave={(entry) => {
            addEntries([entry]);
            notify("已添加到制作草稿");
          }}
          onClose={() => setTarget(null)}
          preview={preview}
        />
      )}
      {batch && inventory && (
        <BatchEditor
          files={batch.files}
          bundle={inventory.bundles.find((b) => b.path === batch.bundle)!}
          run={run}
          busy={busy}
          onSave={(entries) => {
            addEntries(entries);
            notify("已添加 " + entries.length + " 条替换");
          }}
          onClose={() => setBatch(null)}
        />
      )}
      {applyPack && (
        <Modal
          title={"应用 " + applyPack.name}
          open
          onClose={() => {
            if (!busy) setApplyPack(null);
          }}
          wide
        >
          <div className="dialog-body">
            <div className="form-grid">
              <label>
                <span>
                  资源模式
                  <Help>
                    保持官方大小：生成与原包字节数完全相同的资源。变长包：同步调整本地清单大小字段，首次启用需要关闭游戏。
                  </Help>
                </span>
                <Segmented
                  label="资源模式"
                  disabled={busy}
                  value={mode}
                  onChange={(value) => {
                    setMode(value);
                    setPlan(null);
                  }}
                  options={[
                    { value: "exact", label: "保持官方大小" },
                    { value: "variable", label: "变长包" },
                  ]}
                />
              </label>
              <label>
                <span>
                  应用时机
                  <Help>
                    热替换需等待语音播放结束并处于菜单或试听空闲状态；游戏已缓存的资源在释放后生效。
                  </Help>
                </span>
                <Segmented
                  label="应用时机"
                  disabled={busy}
                  value={timing}
                  onChange={(value) => {
                    setTiming(value);
                    setPlan(null);
                  }}
                  options={[
                    { value: "closed", label: "关闭后替换" },
                    { value: "hot", label: "启动后替换" },
                  ]}
                />
              </label>
            </div>
            {plan ? (
              <>
                <div className="plan-heading">
                  <ShieldCheck size={18} />
                  <span>
                    {plan.unchanged
                      ? "内容已应用，无需重复写入"
                      : "备份与替换计划"}
                  </span>
                </div>
                <div className="table-scroll">
                  <table className="plan-table">
                    <thead>
                      <tr>
                        <th>文件</th>
                        <th className="numeric">当前字节数</th>
                        <th className="numeric">替换后</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.files.map((f) => (
                        <tr key={f.path}>
                          <td>
                            <strong className="mono">
                              {f.path.split("/").at(-1)}
                            </strong>
                            <small>
                              {f.path.split("/").slice(0, -1).join("/") ||
                                "本地资源清单"}
                            </small>
                            {f.unchanged && (
                              <span className="tag">无需写入</span>
                            )}
                          </td>
                          <td className="numeric mono">
                            {f.before.toLocaleString()}
                          </td>
                          <td className="numeric mono">
                            {f.after.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {plan.warnings.map((warning, i) => (
                  <div className="inline-note" key={i}>
                    {warning}
                  </div>
                ))}
              </>
            ) : (
              <div className="plan-empty">
                <Database size={20} />
                <span>生成计划后查看大小、备份与兼容性结果</span>
              </div>
            )}
          </div>
          <footer className="dialog-footer">
            <Button onClick={() => setApplyPack(null)} disabled={busy}>
              取消
            </Button>
            {!plan ? (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void run("生成替换计划", async () => {
                    setState(
                      await window.desktop.invoke<AppState>("config.save", {
                        ...state!.config,
                        replacementMode: mode,
                        replacementTiming: timing,
                      }),
                    );
                    setPlan(
                      await window.desktop.invoke<PlanView>("plan", {
                        key: packKey(applyPack),
                        mode,
                        timing,
                      }),
                    );
                  })
                }
              >
                生成替换计划
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={busy || plan.unchanged}
                onClick={() =>
                  void run("备份并应用语音包", async () => {
                    await window.desktop.invoke("apply", plan.id);
                    await refresh();
                    await scan();
                    setApplyPack(null);
                    notify("语音包已应用，备份已保存");
                  })
                }
              >
                {busy ? <Spinner /> : <ShieldCheck size={16} />}备份并应用
              </Button>
            )}
          </footer>
        </Modal>
      )}
      <Modal
        title={busy ? "操作正在进行" : "退出 Wardtone"}
        open={closeRequested}
        onClose={() => setCloseRequested(false)}
      >
        <div className="dialog-body">
          <p>
            {busy
              ? working + "，完成后可以退出。"
              : draftDirty
                ? "当前语音包有未保存的修改。"
                : "操作已完成，可以退出。"}
          </p>
        </div>
        <footer className="dialog-footer">
          <Button onClick={() => setCloseRequested(false)}>
            {busy ? "继续等待" : "继续编辑"}
          </Button>
          {!busy && draftDirty && (
            <>
              <Button
                variant="danger"
                onClick={() =>
                  void run("退出应用", async () => {
                    await window.desktop.invoke("window.confirmClose");
                  })
                }
              >
                舍弃并退出
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  void run("保存并退出", async () => {
                    await saveDraft();
                    await window.desktop.invoke("window.confirmClose");
                  })
                }
              >
                保存并退出
              </Button>
            </>
          )}
          {!busy && !draftDirty && (
            <Button
              variant="primary"
              onClick={() =>
                void run("退出应用", async () => {
                  await window.desktop.invoke("window.confirmClose");
                })
              }
            >
              退出
            </Button>
          )}
        </footer>
      </Modal>
      {pendingDraft && (
        <Modal
          title="当前草稿尚未保存"
          open
          onClose={() => setPendingDraft(null)}
        >
          <div className="dialog-body">
            <p>保存当前语音包后再切换，或舍弃本次编辑。</p>
          </div>
          <footer className="dialog-footer">
            <Button onClick={() => setPendingDraft(null)}>继续编辑</Button>
            <Button onClick={() => void openDraft(pendingDraft)}>
              舍弃并切换
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run("保存并切换", async () => {
                  await saveDraft();
                  const next = pendingDraft;
                  setPendingDraft(null);
                  if (next === "new") await createDraft();
                  else setDraft(structuredClone(next));
                  setPage("editor");
                })
              }
            >
              保存并切换
            </Button>
          </footer>
        </Modal>
      )}
      {restore && (
        <Modal title="恢复此次修改" open onClose={() => setRestore(null)}>
          <div className="dialog-body">
            <div className="restore-summary">
              <Database size={20} />
              <div>
                <strong>{restore.location}</strong>
                <p>
                  {new Date(restore.time).toLocaleString("zh-CN")} ·{" "}
                  {restore.files} 个文件
                </p>
              </div>
            </div>
            <p>将恢复这次操作前的文件。恢复前请退出游戏。</p>
            <small className="mono muted">{restore.id}</small>
          </div>
          <footer className="dialog-footer">
            <Button disabled={busy} onClick={() => setRestore(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run("恢复备份", async () => {
                  await window.desktop.invoke("restore", restore.id);
                  await refresh();
                  await scan();
                  setRestore(null);
                  notify("原文件已恢复");
                })
              }
            >
              核对并恢复
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
