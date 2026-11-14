import { bytes } from "./format";
import { useState } from "react";
import {
  Plus,
  Upload,
  Play,
  Trash2,
  Save,
  Download,
  FileAudio,
  ArrowRight,
  FolderInput,
} from "lucide-react";
import type {
  Inventory,
  VoicePack,
  PackEntry,
  BundleView,
} from "../shared/model";
import { Empty, Help, Modal } from "./components/ui";
import { Button, Select, Segmented, Slider } from "./components/ui";
import type { Run } from "./Setup";
import { decode, processAudio, type AudioFile } from "./audio";
import { getClipCue } from "../shared/cues";
import { CueInfo } from "./components/CueInfo";
import { isMusicBundle } from "../shared/resources";

function AudioEncodingSelect({
  value,
  onChange,
}: {
  value: "ima" | "pcm";
  onChange: (value: "ima" | "pcm") => void;
}) {
  return (
    <label>
      <span>
        音质
        <Help>
          保真模式使用 16 位
          PCM，保留单声道或双声道，文件较大；紧凑模式使用单声道 IMA ADPCM。
          保持官方大小按整个资源包的字节数判断，超出时可选择变长包。
        </Help>
      </span>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== "ima" && next !== "pcm")
            throw new Error("不支持的音频编码：" + next);
          onChange(next);
        }}
      >
        <option value="pcm">保真 · 保留声道</option>
        <option value="ima">紧凑 · 单声道</option>
      </Select>
    </label>
  );
}
export type Preview = (
  action: string,
  input: unknown,
  label: string,
) => Promise<void>;
export function Editor({
  draft,
  setDraft,
  inventory,
  run,
  busy,
  save,
  exportDraft,
  addFromLibrary,
  onNew,
  editEntry,
  preview,
}: {
  draft: VoicePack | null;
  setDraft: (p: VoicePack) => void;
  inventory: Inventory | null;
  run: Run;
  busy: boolean;
  save: () => Promise<void>;
  exportDraft: () => Promise<void>;
  addFromLibrary: () => void;
  onNew: () => void;
  editEntry: (e: PackEntry) => void;
  preview: Preview;
}) {
  const [importTarget, setImportTarget] = useState("");
  if (!draft)
    return (
      <Empty
        title="制作你的第一套语音"
        action={
          <Button variant="primary" onClick={onNew}>
            <Plus size={16} />
            新建语音包
          </Button>
        }
      />
    );
  const patch = (value: Partial<VoicePack>) =>
    setDraft({ ...draft, ...value, updatedAt: new Date().toISOString() });
  return (
    <div className="editor-content">
      <section className="editor-metadata">
        <div className="module-caption">
          <FileAudio />
          <span>PACK IDENTITY</span>
          <span className="module-code">01</span>
        </div>
        <div className="section-heading">
          <h2>语音包信息</h2>
          <Help>
            版本使用 1.0.0
            格式。更改版本号保存后，会保留旧版本。分享包包含元数据和替换内容。
          </Help>
        </div>
        <div className="metadata-form">
          <div className="form-grid">
            <label>
              名称
              <input
                value={draft.name}
                maxLength={80}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="为语音包起个名字"
              />
            </label>
            <label>
              作者
              <input
                value={draft.author}
                maxLength={100}
                onChange={(e) => patch({ author: e.target.value })}
              />
            </label>
          </div>
          <div className="form-grid version-row">
            <label>
              版本
              <input
                value={draft.version}
                onChange={(e) => patch({ version: e.target.value })}
                placeholder="1.0.0"
                className="mono"
              />
            </label>
            <label>
              描述
              <textarea
                value={draft.description}
                maxLength={4000}
                rows={2}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="风格、内容或使用说明（可选）"
              />
            </label>
          </div>
        </div>
      </section>
      <section className="editor-tracks">
        <div className="module-caption">
          <Play />
          <span>TRACK ASSEMBLY</span>
          <span className="module-code">{draft.entries.length} TRACKS</span>
        </div>
        <div className="section-heading entries-heading">
          <h2>
            替换条目 <span className="count">{draft.entries.length}</span>
          </h2>
          <div className="actions">
            <Button onClick={addFromLibrary}>
              <Plus size={15} />
              添加语音
            </Button>
            <Select
              aria-label="导入资源包的目标"
              value={importTarget || inventory?.bundles[0]?.path || ""}
              onValueChange={(e) => setImportTarget(e)}
            >
              {inventory?.bundles.map((b) => (
                <option key={b.path} value={b.path}>
                  {b.label} · {b.language}
                </option>
              ))}
            </Select>
            <Button
              disabled={busy || !inventory?.bundles.length}
              onClick={() =>
                run("导入现有资源包", async () => {
                  const target = importTarget || inventory!.bundles[0].path;
                  const result = await window.desktop.invoke<PackEntry[]>(
                    "pack.importBundle",
                    target,
                  );
                  if (result.length) {
                    const entries = new Map(
                      draft.entries.map((e) => [e.bundle + "#" + e.clip, e]),
                    );
                    for (const e of result)
                      entries.set(e.bundle + "#" + e.clip, e);
                    patch({ entries: [...entries.values()] });
                  }
                })
              }
              title="导入到所选资源包"
            >
              <FolderInput size={15} />
              导入 .ab
            </Button>
          </div>
        </div>
        {!draft.entries.length ? (
          <div className="empty-inline">
            <FileAudio size={20} />
            <span>从语音库选择播报、音效或背景音乐</span>
            <Button variant="ghost" onClick={addFromLibrary}>
              打开语音库
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : (
          <div className="entry-list">
            {draft.entries.map((e) => (
              <div className="entry-row" key={e.bundle + "#" + e.clip}>
                <Button
                  variant="ghost"
                  className="icon-button"
                  aria-label={"试听 " + e.clip}
                  disabled={busy}
                  onClick={() =>
                    run("试听替换语音", () =>
                      preview("preview.entry", e, e.clip),
                    )
                  }
                >
                  <Play size={16} />
                </Button>
                <div>
                  <strong>
                    {getClipCue(e.bundle, e.clip)?.title ?? e.clip}
                  </strong>
                  <small>
                    {e.clip} ·{" "}
                    {inventory?.bundles.find((b) => b.path === e.bundle)
                      ?.label ?? e.bundle}
                  </small>
                </div>
                <span className="tag">
                  {e.kind === "audio"
                    ? "自定义音频"
                    : e.kind === "silence"
                      ? "静音"
                      : "引用 · " + e.donorClip}
                </span>
                <CueInfo bundle={e.bundle} clip={e.clip} />
                <Button disabled={busy} onClick={() => editEntry(e)}>
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  className="icon-button"
                  aria-label={"移除 " + e.clip}
                  onClick={() =>
                    patch({ entries: draft.entries.filter((x) => x !== e) })
                  }
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="editor-bottom">
        <span className="muted">{draft.entries.length} 条替换</span>
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() => run("导出语音包", exportDraft)}
          >
            <Download size={16} />
            保存并导出
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => run("保存语音包", save)}
          >
            <Save size={16} />
            保存语音包
          </Button>
        </div>
      </div>
    </div>
  );
}
export function EntryEditor({
  target,
  existing,
  inventory,
  run,
  busy,
  onSave,
  onClose,
  preview,
}: {
  target: { bundle: string; clip: string };
  existing?: PackEntry;
  inventory: Inventory;
  run: Run;
  busy: boolean;
  onSave: (entry: PackEntry) => void;
  onClose: () => void;
  preview: Preview;
}) {
  const [kind, setKind] = useState<PackEntry["kind"]>(
      existing?.kind ?? "audio",
    ),
    [audio, setAudio] = useState<{
      file: AudioFile;
      buffer: AudioBuffer;
    } | null>(null),
    [blob, setBlob] = useState(existing?.blob),
    [start, setStart] = useState(0),
    [end, setEnd] = useState(0),
    [rate, setRate] = useState(isMusicBundle(target.bundle) ? 44100 : 24000),
    [encoding, setEncoding] = useState<"ima" | "pcm">(
      isMusicBundle(target.bundle) ? "pcm" : "ima",
    ),
    [gain, setGain] = useState(1),
    [donorBundle, setDonorBundle] = useState(
      existing?.donorBundle ?? target.bundle,
    ),
    [donorClip, setDonorClip] = useState(existing?.donorClip ?? target.clip);
  async function entry(): Promise<PackEntry> {
    if (kind === "silence") return { ...target, kind };
    if (kind === "reference")
      return { ...target, kind, donorBundle, donorClip };
    let hash = blob;
    if (audio) {
      const channels =
        encoding === "pcm" && audio.buffer.numberOfChannels > 1 ? 2 : 1;
      const pcm = await processAudio(audio.buffer, {
        start,
        end,
        rate,
        gain,
        channels,
      });
      hash = (
        await window.desktop.invoke<{ blob: string }>("audio.encode", {
          pcm,
          rate,
          encoding,
          channels,
        })
      ).blob;
      setBlob(hash);
    }
    if (!hash) throw new Error("请先选择替换音频");
    return { ...target, kind, blob: hash };
  }
  return (
    <Modal title={"替换 " + target.clip} open onClose={onClose}>
      <div className="dialog-body">
        <div className="target-caption">
          <span>
            {inventory.bundles.find((b) => b.path === target.bundle)?.label} ·{" "}
            {inventory.bundles.find((b) => b.path === target.bundle)?.language}{" "}
            · {getClipCue(target.bundle, target.clip)?.title ?? "用途待核对"}
          </span>
          <CueInfo bundle={target.bundle} clip={target.clip} />
        </div>
        <Segmented
          label="替换方式"
          value={kind}
          onChange={setKind}
          disabled={busy}
          options={[
            { value: "audio", label: "自定义音频" },
            { value: "reference", label: "引用原音" },
            { value: "silence", label: "静音" },
          ]}
        />
        {kind === "audio" && (
          <>
            <Button
              className="audio-picker"
              disabled={busy}
              onClick={() =>
                run("读取替换音频", async () => {
                  const files = await window.desktop.invoke<AudioFile[]>(
                    "pick.audio",
                    { multiple: false },
                  );
                  if (!files.length) return;
                  const buffer = await decode(files[0]);
                  setAudio({ file: files[0], buffer });
                  setStart(0);
                  setEnd(buffer.duration);
                  setBlob(undefined);
                })
              }
            >
              <Upload size={20} />
              <span>
                {audio?.file.name ??
                  (blob ? "已添加音频 · 点击更换" : "选择音频文件")}
                <small>
                  {audio
                    ? audio.buffer.duration.toFixed(2) +
                      " 秒 · " +
                      bytes(audio.file.bytes.length)
                    : "WAV / MP3 / OGG / FLAC / M4A"}
                </small>
              </span>
            </Button>
            {audio && (
              <>
                <AudioEncodingSelect value={encoding} onChange={setEncoding} />
                <div className="form-grid">
                  <label>
                    开始（秒）
                    <input
                      type="number"
                      min={0}
                      max={end}
                      step="0.05"
                      value={start}
                      onChange={(e) => setStart(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    结束（秒）
                    <input
                      type="number"
                      min={start}
                      max={audio.buffer.duration}
                      step="0.05"
                      value={Number(end.toFixed(3))}
                      onChange={(e) => setEnd(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    <span>
                      采样率
                      <Help>
                        较低采样率可以减小封包。按整包字节数判断能否保持官方大小；变长模式无需与官方字节数相同。
                      </Help>
                    </span>
                    <Select
                      value={rate}
                      onValueChange={(e) => setRate(Number(e))}
                    >
                      {[16000, 24000, 32000, 44100, 48000].map((n) => (
                        <option key={n} value={n}>
                          {n / 1000} kHz
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    音量 · {Math.round(gain * 100)}%
                    <Slider
                      label="替换音量"
                      value={gain}
                      min={0}
                      max={2}
                      step={0.05}
                      onValueChange={setGain}
                    />
                  </label>
                </div>
                <div className="processing-summary">
                  <span>{Math.max(0, end - start).toFixed(2)} 秒</span>
                  <span>
                    {encoding === "pcm"
                      ? `${audio.buffer.numberOfChannels > 1 ? "双声道" : "单声道"} · PCM`
                      : "单声道 · IMA ADPCM"}
                  </span>
                </div>
              </>
            )}
          </>
        )}
        {kind === "reference" && (
          <div className="form-stack">
            <label>
              资源包
              <Select
                value={donorBundle}
                onValueChange={(e) => {
                  setDonorBundle(e);
                  setDonorClip(
                    inventory.bundles.find((b) => b.path === e)?.clips[0]
                      ?.name ?? "",
                  );
                }}
              >
                {inventory.bundles
                  .filter((b) => b.clips.length)
                  .map((b) => (
                    <option key={b.path} value={b.path}>
                      {b.label} · {b.language}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              原语音
              <Select value={donorClip} onValueChange={(e) => setDonorClip(e)}>
                {inventory.bundles
                  .find((b) => b.path === donorBundle)
                  ?.clips.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} · {c.event} · {c.duration.toFixed(2)} 秒
                    </option>
                  ))}
              </Select>
            </label>
          </div>
        )}
        {kind === "silence" && (
          <div className="silence-state">
            <i />
            <span>将此条语音替换为静音</span>
          </div>
        )}
      </div>
      <footer className="dialog-footer">
        <Button
          disabled={busy}
          onClick={() =>
            run("试听处理结果", async () =>
              preview("preview.entry", await entry(), target.clip),
            )
          }
        >
          <Play size={15} />
          试听
        </Button>
        <div className="actions">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              run("添加替换条目", async () => {
                onSave(await entry());
                onClose();
              })
            }
          >
            添加到语音包
          </Button>
        </div>
      </footer>
    </Modal>
  );
}
export function BatchEditor({
  files,
  bundle,
  run,
  busy,
  onSave,
  onClose,
}: {
  files: AudioFile[];
  bundle: BundleView;
  run: Run;
  busy: boolean;
  onSave: (entries: PackEntry[]) => void;
  onClose: () => void;
}) {
  const [mapping, setMapping] = useState(
      files.map(
        (f) =>
          bundle.clips.find(
            (c) =>
              c.name.toLowerCase() ===
              f.name.replace(/\.[^.]+$/, "").toLowerCase(),
          )?.name ?? "",
      ),
    ),
    [rate, setRate] = useState(isMusicBundle(bundle.path) ? 44100 : 24000),
    [encoding, setEncoding] = useState<"ima" | "pcm">(
      isMusicBundle(bundle.path) ? "pcm" : "ima",
    );
  return (
    <Modal title="批量添加音频" open onClose={onClose} wide>
      <div className="dialog-body">
        <div className="section-heading">
          <span>
            {bundle.label} · {files.length} 个文件
          </span>
          <label className="inline-field">
            采样率
            <Select value={rate} onValueChange={(e) => setRate(Number(e))}>
              <option value={16000}>16 kHz</option>
              <option value={24000}>24 kHz</option>
              <option value={44100}>44.1 kHz</option>
            </Select>
          </label>
        </div>
        <AudioEncodingSelect value={encoding} onChange={setEncoding} />
        <div className="batch-list">
          {files.map((f, i) => (
            <div key={i} className="batch-row">
              <span>{f.name}</span>
              <ArrowRight size={14} />
              <Select
                aria-label={f.name + " 对应音频"}
                value={mapping[i]}
                onValueChange={(e) =>
                  setMapping(mapping.map((x, n) => (n === i ? e : x)))
                }
              >
                <option value="">选择目标音频</option>
                {bundle.clips.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} · {c.event}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </div>
      <footer className="dialog-footer">
        <span className="muted">按文件名自动匹配，可逐项调整</span>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            run("批量转换音频", async () => {
              if (mapping.some((x) => !x))
                throw new Error("请为每个文件选择目标音频");
              if (new Set(mapping).size !== mapping.length)
                throw new Error("同一条音频不能对应多个文件");
              const entries: PackEntry[] = [];
              for (let i = 0; i < files.length; i++) {
                const buffer = await decode(files[i]),
                  channels =
                    encoding === "pcm" && buffer.numberOfChannels > 1 ? 2 : 1,
                  pcm = await processAudio(buffer, {
                    start: 0,
                    end: buffer.duration,
                    rate,
                    gain: 1,
                    channels,
                  }),
                  { blob } = await window.desktop.invoke<{ blob: string }>(
                    "audio.encode",
                    { pcm, rate, encoding, channels },
                  );
                entries.push({
                  bundle: bundle.path,
                  clip: mapping[i],
                  kind: "audio",
                  blob,
                });
              }
              onSave(entries);
              onClose();
            })
          }
        >
          添加 {files.length} 条
        </Button>
      </footer>
    </Modal>
  );
}
