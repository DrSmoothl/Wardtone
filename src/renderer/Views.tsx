import { bytes, statusText } from "./format";
import { useState, type CSSProperties } from "react";
import { themeCatalog, accents } from "../shared/themes";
import { accentColors } from "./themes/palette";
import { ThemePicker, TerminalConsole } from "./themes/ThemePresentation";
import {
  Play,
  Plus,
  Upload,
  Download,
  RefreshCw,
  FolderOpen,
  Search,
  ChevronRight,
  AudioLines,
  Check,
  Database,
  RotateCcw,
  Monitor,
  ArrowUpDown,
  FileAudio,
  SlidersHorizontal,
  Palette,
  HardDrive,
} from "lucide-react";
import {
  packKey,
  type AppState,
  type Inventory,
  type VoicePack,
  type PackEntry,
  type Config,
  type JournalView,
  type LogLine,
} from "../shared/model";
import {
  Button,
  Select,
  Checkbox,
  Switch,
  Segmented,
  Empty,
  Help,
  Hint,
} from "./components/ui";
import type { Run } from "./Setup";
import type { Preview } from "./Editor";
import { cueSearchText, getClipCue } from "../shared/cues";
import { CueInfo, PlaybackGuide } from "./components/CueInfo";
import { resourceCategory, type ResourceCategory } from "../shared/resources";

export function Workbench({
  state,
  inventory,
  busy,
  onNew,
  onImport,
  onEdit,
  onApply,
  onExport,
  onScan,
  onLibrary,
}: {
  state: AppState;
  inventory: Inventory | null;
  busy: boolean;
  onNew: () => void;
  onImport: () => void;
  onEdit: (p: VoicePack) => void;
  onApply: (p: VoicePack) => void;
  onExport: (p: VoicePack) => void;
  onScan: () => void;
  onLibrary: () => void;
}) {
  const total = inventory?.bundles.reduce((n, b) => n + b.clips.length, 0);
  return (
    <div className="workbench-layout">
      <TerminalConsole
        theme={state.config.theme}
        onLibrary={onLibrary}
        onNew={onNew}
        busy={busy}
      />

      <section className="workspace-summary">
        <div className="module-caption resource-caption">
          <Monitor />
          <span>RESOURCE MONITOR</span>
          <span className="module-code">
            {inventory ? "CONNECTED" : "WAITING"}
          </span>
        </div>
        <div className="resource-top">
          <span className="resource-symbol">
            <Monitor />
          </span>
          <div className="resource-identity">
            <strong>{inventory?.location.label ?? "游戏资源"}</strong>
            <span>
              {inventory ? (
                <>
                  资源版本 <span className="mono">{inventory.version}</span>
                </>
              ) : (
                "尚未读取"
              )}
            </span>
          </div>
          <Help label="查看资源位置">
            {inventory?.location.root ?? "扫描所选游戏目录后查看语音资源。"}
          </Help>
        </div>
        <div className="summary-numbers">
          <Button
            variant="ghost"
            className="summary-number"
            onClick={onLibrary}
          >
            <strong className="mono">{total ?? "—"}</strong>
            <span>播报、音效与音乐</span>
          </Button>
          <div className="summary-number">
            <strong className="mono">{inventory?.bundles.length ?? "—"}</strong>
            <span>资源包</span>
          </div>
          <div className="summary-number">
            <strong className="mono">
              {inventory?.bundles.filter((b) => b.status === "managed")
                .length ?? "—"}
            </strong>
            <span>已替换</span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="icon-button resource-rescan"
          aria-label="重新扫描资源"
          disabled={busy}
          onClick={onScan}
        >
          <RefreshCw />
        </Button>
      </section>
      {inventory?.warnings.length ? (
        <div className="inline-note">
          {inventory.warnings.length} 项资源尚未下载。
          <Button variant="ghost" size="sm" onClick={onLibrary}>
            查看资源
          </Button>
        </div>
      ) : null}
      <section className="pack-section">
        <div className="section-heading">
          <h2>
            我的语音包 <span className="count mono">{state.packs.length}</span>
          </h2>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onNew}>
            <Plus />
            新建语音包
          </Button>
        </div>
        {!state.packs.length ? (
          <div className="list-group">
            <Empty
              title="还没有语音包"
              action={
                <>
                  <Button onClick={onImport} disabled={busy}>
                    <Upload />
                    添加分享包
                  </Button>
                  <Button onClick={onNew} disabled={busy}>
                    开始制作
                    <ChevronRight />
                  </Button>
                </>
              }
            >
              添加一个分享包，或从语音库开始制作。
            </Empty>
          </div>
        ) : (
          <div className="pack-list list-group">
            {[...state.packs]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((p, index) => (
                <article className="pack-row" key={packKey(p)}>
                  <span className="pack-art" aria-hidden="true">
                    <FileAudio />
                    <span className="cassette-reels">
                      <i />
                      <i />
                    </span>
                    <span className="pack-serial">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <div className="pack-info">
                    <div>
                      <h3>{p.name}</h3>
                      <span className="tag mono">{p.version}</span>
                    </div>
                    <p>
                      {p.author}
                      <span>·</span>
                      {p.entries.length} 条音频
                      {p.description && (
                        <>
                          <span>·</span>
                          <Hint text={p.description}>
                            <span className="pack-description">
                              {p.description}
                            </span>
                          </Hint>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="actions">
                    <Button
                      variant="ghost"
                      className="icon-button"
                      aria-label={"导出 " + p.name}
                      disabled={busy}
                      onClick={() => onExport(p)}
                    >
                      <Download />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onEdit(p)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy || !inventory}
                      onClick={() => onApply(p)}
                    >
                      应用
                      <ChevronRight />
                    </Button>
                  </div>
                </article>
              ))}
            <Button
              variant="ghost"
              className="pack-new-tile"
              disabled={busy}
              onClick={onNew}
            >
              <Plus />
              <span>创建语音包</span>
            </Button>
          </div>
        )}
      </section>
      <section className="workbench-links">
        <Button variant="ghost" className="workflow-link" onClick={onLibrary}>
          <AudioLines />
          <span>浏览全部音频</span>
          <ChevronRight />
        </Button>
        <Button variant="ghost" className="workflow-link" onClick={onNew}>
          <SlidersHorizontal />
          <span>制作自己的语音包</span>
          <ChevronRight />
        </Button>
      </section>
    </div>
  );
}
export function Library({
  inventory,
  bundle,
  setBundle,
  search,
  setSearch,
  draft,
  busy,
  run,
  preview,
  onEdit,
  onBulk,
  onSilence,
}: {
  inventory: Inventory | null;
  bundle: string;
  setBundle: (b: string) => void;
  search: string;
  setSearch: (s: string) => void;
  draft: VoicePack | null;
  busy: boolean;
  run: Run;
  preview: Preview;
  onEdit: (bundle: string, clip: string) => void;
  onBulk: () => void;
  onSilence: (entries: PackEntry[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [category, setCategory] = useState<"all" | ResourceCategory>("all"),
    [sort, setSort] = useState<{ by: "name" | "duration"; direction: number }>({
      by: "name",
      direction: 1,
    });
  if (!inventory) return <Empty title="等待读取资源" />;
  const categoryBundles = inventory.bundles.filter(
    (item) => category === "all" || resourceCategory(item.path) === category,
  );
  const rows = categoryBundles
    .filter((b) => !bundle || b.path === bundle)
    .flatMap((b) => b.clips.map((c) => ({ b, c, key: b.path + "#" + c.name })))
    .filter(({ b, c }) =>
      (
        c.name +
        " " +
        cueSearchText(b.path, c.name) +
        " " +
        b.label +
        " " +
        b.language
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        sort.direction *
        (sort.by === "name"
          ? a.c.name.localeCompare(b.c.name, "en", { numeric: true })
          : a.c.duration - b.c.duration),
    );
  const current = inventory.bundles.find((b) => b.path === bundle),
    allSelected = !!rows.length && rows.every((r) => selected.includes(r.key));
  const order = (by: "name" | "duration") =>
    setSort({ by, direction: sort.by === by ? -sort.direction : 1 });
  return (
    <>
      <div className="library-categories">
        <Segmented
          label="音频分类"
          value={category}
          onChange={(value) => {
            setCategory(value);
            setBundle("");
            setSelected([]);
            setSearch("");
          }}
          options={[
            { value: "all", label: "全部" },
            { value: "voice", label: "终端播报" },
            { value: "effects", label: "公共音效" },
            { value: "music", label: "背景音乐" },
          ]}
        />
      </div>
      <div className="bundle-channels" role="group" aria-label="资源频道">
        <Button
          variant="ghost"
          className="bundle-channel channel-all"
          aria-pressed={!bundle}
          onClick={() => {
            setBundle("");
            setSelected([]);
          }}
        >
          <AudioLines />
          <span>
            全部频道<small>ALL CHANNELS</small>
          </span>
          <strong>
            {categoryBundles.reduce((n, b) => n + b.clips.length, 0)}
          </strong>
        </Button>
        {categoryBundles.map((b, index) => (
          <Button
            key={b.path}
            variant="ghost"
            className="bundle-channel"
            aria-pressed={bundle === b.path}
            onClick={() => {
              setBundle(b.path);
              setSelected([]);
            }}
          >
            <span className="channel-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              {b.label}
              <small>
                {b.language}
                {b.status === "missing" ? " · 未下载" : ""}
              </small>
            </span>
            <strong>{b.clips.length}</strong>
          </Button>
        ))}
      </div>
      <div className="library-console">
        <div className="module-caption">
          <AudioLines />
          <span>AUDIO DATABASE</span>
          <span className="module-code">{rows.length} RECORDS</span>
          <span className="window-controls" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="library-toolbar">
          <label className="search-input">
            <Search />
            <input
              aria-label="搜索音频"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected([]);
              }}
              placeholder="搜索音频、播放场景"
            />
          </label>
          <Select
            className="bundle-select"
            aria-label="筛选资源包"
            value={bundle}
            onValueChange={(value) => {
              setBundle(value);
              setSelected([]);
            }}
          >
            <option value="">全部资源包</option>
            {categoryBundles.map((b) => (
              <option value={b.path} key={b.path}>
                {b.label} · {b.language}
                {b.status === "missing" ? " · 未下载" : ""}
              </option>
            ))}
          </Select>
          <Button disabled={busy || !bundle} onClick={onBulk}>
            <Upload />
            批量添加
          </Button>
          <Help>
            先选择单个资源包，再批量添加音频。文件名与语音编号相同时会自动匹配，也可以逐项选择。
          </Help>
        </div>
        <div className="resource-summary">
          <span>{rows.length} 条音频</span>
          <PlaybackGuide />
          {current && (
            <>
              <span className={"status status-" + current.status}>
                {statusText[current.status]}
              </span>
              <span className="mono">{bytes(current.bytes)}</span>
            </>
          )}
          {selected.length > 0 && (
            <div className="selection-actions">
              <span>已选 {selected.length} 条</span>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  onSilence(
                    rows
                      .filter((r) => selected.includes(r.key))
                      .map((r) => ({
                        bundle: r.b.path,
                        clip: r.c.name,
                        kind: "silence",
                      })),
                  );
                  setSelected([]);
                }}
              >
                设为静音
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                取消选择
              </Button>
            </div>
          )}
        </div>
        <div className="table-scroll voice-table">
          <table>
            <thead>
              <tr>
                <th className="check-cell">
                  <Checkbox
                    aria-label="选择当前列表全部音频"
                    checked={
                      allSelected
                        ? true
                        : selected.length
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) =>
                      setSelected(checked ? rows.map((r) => r.key) : [])
                    }
                  />
                </th>
                <th
                  aria-sort={
                    sort.by === "name"
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <Button
                    className="sort-button"
                    variant="ghost"
                    size="sm"
                    onClick={() => order("name")}
                  >
                    音频
                    <ArrowUpDown />
                  </Button>
                </th>
                <th>主题 / 语言</th>
                <th
                  className="numeric"
                  aria-sort={
                    sort.by === "duration"
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <Button
                    className="sort-button"
                    variant="ghost"
                    size="sm"
                    onClick={() => order("duration")}
                  >
                    时长
                    <ArrowUpDown />
                  </Button>
                </th>
                <th>替换</th>
                <th className="align-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, c, key }) => (
                <tr
                  key={key}
                  className={selected.includes(key) ? "selected" : ""}
                >
                  <td>
                    <Checkbox
                      aria-label={"选择 " + c.name + " " + b.language}
                      checked={selected.includes(key)}
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked
                            ? [...selected, key]
                            : selected.filter((x) => x !== key),
                        )
                      }
                    />
                  </td>
                  <td>
                    <strong className="cue-title">
                      {getClipCue(b.path, c.name)?.title ?? "用途待核对"}
                    </strong>
                    <small className="clip-name mono">{c.name}</small>
                  </td>
                  <td>
                    <span>{b.label}</span>
                    <small>{b.language}</small>
                  </td>
                  <td className="numeric mono">
                    {c.duration.toFixed(2)} <span className="unit">s</span>
                  </td>
                  <td>
                    {draft?.entries.some(
                      (e) => e.bundle === b.path && e.clip === c.name,
                    ) ? (
                      <span className="status">已添加</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <CueInfo bundle={b.path} clip={c.name} />
                      <Button
                        variant="ghost"
                        className="icon-button"
                        aria-label={"试听原音 " + c.name + " " + b.language}
                        disabled={busy}
                        onClick={() =>
                          run("试听原音", () =>
                            preview(
                              "preview.clip",
                              { bundle: b.path, clip: c.name, original: true },
                              c.name + " · 原音",
                            ),
                          )
                        }
                      >
                        <Play />
                      </Button>
                      {b.status === "managed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run("试听当前音频", () =>
                              preview(
                                "preview.clip",
                                {
                                  bundle: b.path,
                                  clip: c.name,
                                  original: false,
                                },
                                c.name + " · 当前",
                              ),
                            )
                          }
                        >
                          当前
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => onEdit(b.path, c.name)}
                      >
                        替换
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title={
                current?.status === "missing"
                  ? "请先在游戏中下载该资源"
                  : "没有匹配的音频"
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
export function Backups({
  journals,
  busy,
  onRestore,
}: {
  journals: JournalView[];
  busy: boolean;
  onRestore: (j: JournalView) => void;
}) {
  if (!journals.length)
    return (
      <div className="list-group">
        <Empty title="还没有替换记录">应用语音包后，备份会显示在这里。</Empty>
      </div>
    );
  return (
    <>
      <div className="section-heading">
        <h2>
          替换记录 <span className="count mono">{journals.length}</span>
        </h2>
        <Help>
          每次替换保存原始字节、摘要和操作阶段。发现外部修改时会停止恢复。多次替换请从最近一次开始恢复。
        </Help>
      </div>
      <div className="journal-list list-group">
        {journals.map((j) => (
          <article className="journal" key={j.id}>
            <span
              className={
                "journal-icon " +
                (!["committed", "rolled-back"].includes(j.status) ? "warn" : "")
              }
            >
              <Database />
            </span>
            <div>
              <h3>
                {j.location}
                <span
                  className={
                    "status " +
                    (!["committed", "rolled-back"].includes(j.status)
                      ? "status-warning"
                      : "")
                  }
                >
                  {statusText[j.status]}
                </span>
              </h3>
              <p>
                {new Date(j.time).toLocaleString("zh-CN")}
                <span>·</span>
                {j.files} 个文件
              </p>
              <small className="mono">{j.id}</small>
              {j.error && <div className="error-inline">{j.error}</div>}
            </div>
            <Button
              size="sm"
              disabled={busy || j.status === "rolled-back"}
              onClick={() => onRestore(j)}
            >
              <RotateCcw />
              {j.status === "rolled-back" ? "已恢复" : "恢复此次修改"}
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
export function Settings({
  config,
  save,
  busy,
  onAdd,
  onDiagnostics,
  onOpenData,
}: {
  config: Config;
  save: (c: Config) => void;
  busy: boolean;
  onAdd: () => void;
  onDiagnostics: () => void;
  onOpenData: () => void;
}) {
  const [tab, setTab] = useState("appearance");
  const tabs = [
    { id: "appearance", name: "外观", icon: Palette },
    { id: "preferences", name: "偏好与连接", icon: SlidersHorizontal },
    { id: "data", name: "数据与诊断", icon: HardDrive },
  ];
  return (
    <div className="settings">
      <div className="tabs" role="tablist" aria-label="设置分类">
        {tabs.map(({ id, name, icon: Icon }, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={"settings-" + id}
            id={"tab-" + id}
            tabIndex={tab === id ? 0 : -1}
            key={id}
            onClick={() => setTab(id)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              setTab(tabs[next].id);
              (
                event.currentTarget.parentElement?.children[
                  next
                ] as HTMLButtonElement
              ).focus();
            }}
          >
            <Icon />
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={"settings-" + tab}
        aria-labelledby={"tab-" + tab}
      >
        {tab === "appearance" && (
          <>
            <div className="section-heading">
              <h2>终端主题</h2>
              <Help>
                {themeCatalog[config.theme].description}{" "}
                主题切换立即保存，重新启动后保留。
              </Help>
            </div>
            <ThemePicker
              config={config}
              busy={busy}
              onChange={(theme) => save({ ...config, theme })}
            />
            <div className="section-heading">
              <h2>显示</h2>
            </div>
            <div className="list-group settings-group">
              <div className="setting-row">
                <span>外观</span>
                <span className="setting-value">
                  <Monitor />
                  {themeCatalog[config.theme].appearance === "system"
                    ? "跟随系统"
                    : themeCatalog[config.theme].appearance === "light"
                      ? "终端浅色"
                      : "终端深色"}
                </span>
              </div>
              {themeCatalog[config.theme].customAccent && (
                <div className="setting-row">
                  <span>强调色</span>
                  <div className="accent-options">
                    {accents.map((color) => (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        key={color}
                        style={
                          {
                            "--swatch": `oklch(.52 ${accentColors[color].chroma} ${accentColors[color].hue})`,
                            "--swatch-hover": `oklch(.46 ${accentColors[color].chroma} ${accentColors[color].hue})`,
                          } as CSSProperties
                        }
                        className="accent-swatch"
                        aria-label={accentColors[color].name}
                        aria-pressed={config.accent === color}
                        onClick={() => save({ ...config, accent: color })}
                      >
                        {config.accent === color && <Check />}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="setting-row">
                <span>界面大小</span>
                <Segmented
                  label="界面大小"
                  value={String(config.zoom)}
                  onChange={(value) =>
                    save({ ...config, zoom: Number(value) as Config["zoom"] })
                  }
                  disabled={busy}
                  options={[
                    { value: "1", label: "100%" },
                    { value: "1.12", label: "112%" },
                    { value: "1.25", label: "125%" },
                  ]}
                />
              </div>
              <div className="setting-row">
                <label htmlFor="motion">
                  界面动效
                  <Help>
                    系统启用“减少动态效果”时自动停用。动效只用于选择变化、弹层及操作反馈。
                  </Help>
                </label>
                <Switch
                  id="motion"
                  checked={config.motion}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    save({ ...config, motion: checked })
                  }
                />
              </div>
            </div>
          </>
        )}
        {tab === "preferences" && (
          <>
            <div className="section-heading">
              <h2>制作偏好</h2>
            </div>
            <div className="list-group settings-group">
              <div className="setting-row">
                <label htmlFor="default-author">默认作者</label>
                <input
                  disabled={busy}
                  id="default-author"
                  key={config.author}
                  defaultValue={config.author}
                  maxLength={100}
                  placeholder="你的署名"
                  onBlur={(e) => {
                    if (e.target.value !== config.author)
                      save({ ...config, author: e.target.value });
                  }}
                />
              </div>
            </div>
            <div className="section-heading">
              <h2>游戏连接</h2>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onAdd}>
                <Plus />
                添加连接
              </Button>
            </div>
            <div className="list-group">
              {config.locations.map((l) => (
                <div className="setting-location" key={l.id}>
                  <FolderOpen />
                  <div>
                    <strong>{l.label}</strong>
                    <Hint text={l.root}>
                      <small>{l.root}</small>
                    </Hint>
                  </div>
                  {config.selected === l.id ? (
                    <span className="status">当前连接</span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => save({ ...config, selected: l.id })}
                    >
                      切换
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "data" && (
          <>
            <div className="section-heading">
              <h2>本地数据</h2>
              <Help>
                诊断包含配置、事务摘要及日志，不包含音频、游戏登录信息或 ADB
                私钥。
              </Help>
            </div>
            <div className="list-group settings-group">
              <div className="setting-row">
                <span>配置、备份与日志</span>
                <Button size="sm" onClick={onOpenData}>
                  <FolderOpen />
                  打开数据目录
                </Button>
              </div>
              <div className="setting-row">
                <span>诊断记录</span>
                <Button size="sm" disabled={busy} onClick={onDiagnostics}>
                  <Download />
                  导出诊断
                </Button>
              </div>
            </div>
            <div className="about-line">
              <strong>Wardtone</strong>
              <span>戍声 · 0.1.0</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export function Logs({
  lines,
  busy,
  refresh,
  exportDiagnostics,
}: {
  lines: LogLine[];
  busy: boolean;
  refresh: () => void;
  exportDiagnostics: () => void;
}) {
  const [search, setSearch] = useState(""),
    [level, setLevel] = useState("all"),
    [expanded, setExpanded] = useState<string | null>(null);
  const filtered = lines
    .filter(
      (l) =>
        (level === "all" || l.level === level) &&
        JSON.stringify(l).toLowerCase().includes(search.toLowerCase()),
    )
    .slice(-500)
    .reverse();
  return (
    <>
      <div className="library-toolbar">
        <label className="search-input">
          <Search />
          <input
            aria-label="搜索日志"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索事件、文件或操作编号"
          />
        </label>
        <Select value={level} onValueChange={setLevel} aria-label="日志级别">
          <option value="all">全部级别</option>
          <option value="info">信息</option>
          <option value="warn">警告</option>
          <option value="error">错误</option>
        </Select>
        <Button disabled={busy} onClick={refresh}>
          <RefreshCw />
          刷新
        </Button>
        <Button disabled={busy} onClick={exportDiagnostics}>
          <Download />
          导出诊断
        </Button>
      </div>
      <div className="log-list list-group">
        {filtered.map((l, i) => {
          const key = l.time + l.event + i;
          return (
            <div className={"log-item " + l.level} key={key}>
              <Button
                variant="ghost"
                className="log-summary"
                aria-expanded={expanded === key}
                onClick={() => setExpanded(expanded === key ? null : key)}
              >
                <time className="mono">
                  {new Date(l.time).toLocaleTimeString("zh-CN", {
                    hour12: false,
                  })}
                </time>
                <span className="log-level">
                  {{ info: "信息", warn: "警告", error: "失败" }[l.level]}
                </span>
                <strong className="mono">{l.event}</strong>
                <span className="mono operation">
                  {l.operation.slice(0, 8)}
                </span>
                <ChevronRight className={expanded === key ? "expanded" : ""} />
              </Button>
              {expanded === key && (
                <pre>
                  {JSON.stringify(l.detail, null, 2)}
                  {"\n"}操作编号：{l.operation}
                </pre>
              )}
            </div>
          );
        })}
        {!filtered.length && <Empty title="没有匹配的日志" />}
      </div>
      <div className="list-foot">
        <span>最近 {filtered.length} 条</span>
        <Help>
          诊断导出包含完整保留日志。点击记录可查看参数、文件摘要和操作编号。
        </Help>
      </div>
    </>
  );
}
