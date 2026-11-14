import { useState } from "react";
import {
  Monitor,
  Smartphone,
  FolderOpen,
  Search,
  Check,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import type { Location } from "../shared/model";
import { Brand, Help } from "./components/ui";
import { Button, Select, Segmented } from "./components/ui";
export type Run = (label: string, task: () => Promise<void>) => Promise<void>;
type Device = {
  serial: string;
  label: string;
  port: number;
  connection: "server" | "direct";
  state: string;
};
export function Setup({
  run,
  busy,
  onSelect,
  compact = false,
}: {
  run: Run;
  busy: boolean;
  onSelect: (location: Location) => Promise<void>;
  compact?: boolean;
}) {
  const [kind, setKind] = useState<"local" | "adb">("local"),
    [candidates, setCandidates] = useState<Location[]>([]),
    [devices, setDevices] = useState<Device[]>([]),
    [device, setDevice] = useState(""),
    [port, setPort] = useState(5555),
    [root, setRoot] = useState(
      "/sdcard/Android/data/com.hypergryph.arknights/files/Bundles",
    ),
    [note, setNote] = useState("");
  const locate = (list: Location[]) => {
    setCandidates(list);
    setNote(
      list.length
        ? ""
        : kind === "local"
          ? "未找到资源目录。请手动选择游戏安装目录或 Bundles 文件夹。"
          : "未找到资源目录。请确认游戏资源已下载，并手动填写模拟器内的 Bundles 路径。",
    );
  };
  const adbLocation = (): Location => {
    const d = devices.find((x) => x.serial === device);
    return {
      id: crypto.randomUUID(),
      kind: "adb",
      root,
      label: d?.label ?? "模拟器 · " + port,
      serial: d?.serial ?? "127.0.0.1:" + port,
      port: d?.port ?? port,
      connection: d?.connection ?? "direct",
    };
  };
  return (
    <div className={"setup " + (compact ? "compact" : "")}>
      {!compact && (
        <>
          <Brand />
          <div className="setup-heading">
            <span className="eyebrow">初次设置</span>
            <h1>连接你的明日方舟</h1>
          </div>
        </>
      )}
      <Segmented
        label="客户端类型"
        value={kind}
        disabled={busy}
        onChange={(value) => {
          setKind(value);
          setCandidates([]);
          setNote("");
        }}
        options={[
          { value: "local", label: "本机客户端" },
          { value: "adb", label: "安卓模拟器" },
        ]}
      />
      {kind === "local" ? (
        <div className="setup-actions">
          <Button
            disabled={busy}
            onClick={() =>
              run("选择资源目录", async () =>
                locate(await window.desktop.invoke<Location[]>("pick.folder")),
              )
            }
          >
            <FolderOpen size={16} />
            手动选择目录
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              run("寻找游戏资源", async () =>
                locate(
                  await window.desktop.invoke<Location[]>("discover.local"),
                ),
              )
            }
          >
            <Search size={16} />
            自动寻找
          </Button>
          <Help>
            选择游戏安装目录或包含 persistent_res_list.json 的 Bundles
            文件夹。若资源尚未下载，先进入游戏中的卫戍协议。
          </Help>
        </div>
      ) : (
        <div className="adb-setup">
          <div className="field-row">
            <label>
              模拟器
              <Help>
                启动模拟器并在其设置中开启本机 ADB
                调试。若出现授权弹窗，请在模拟器中确认。连接仅使用本机回环地址。
              </Help>
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                run("寻找模拟器", async () => {
                  const list =
                    await window.desktop.invoke<Device[]>("discover.devices");
                  setDevices(list);
                  setDevice(list[0]?.serial ?? "");
                  setNote(
                    list.length
                      ? ""
                      : "未发现开放的 ADB 端口，可按模拟器设置手动填写。",
                  );
                })
              }
            >
              <RefreshCw size={15} />
              扫描设备
            </Button>
          </div>
          <div className="form-grid">
            <label>
              设备
              <Select value={device} onValueChange={(e) => setDevice(e)}>
                <option value="">手动指定端口</option>
                {devices.map((d) => (
                  <option key={d.serial} value={d.serial}>
                    {d.label} · {d.state}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              本机 ADB 端口
              <input
                type="number"
                min="1"
                max="65535"
                disabled={!!device}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            资源目录
            <input
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="actions">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                run("定位模拟器资源", async () =>
                  locate(
                    await window.desktop.invoke<Location[]>(
                      "discover.adb",
                      adbLocation(),
                    ),
                  ),
                )
              }
            >
              <Search size={16} />
              自动定位资源
            </Button>
            <Button
              disabled={busy}
              onClick={() => run("连接指定目录", () => onSelect(adbLocation()))}
            >
              使用填写的目录
            </Button>
          </div>
        </div>
      )}
      {note && (
        <div className="inline-note" role="status">
          {note}
        </div>
      )}
      {candidates.length > 0 && (
        <div className="candidate-list">
          {candidates.map((c) => (
            <Button
              disabled={busy}
              className="candidate"
              key={c.id}
              onClick={() => run("读取游戏资源", () => onSelect(c))}
            >
              <span className="folder-mark">
                <FolderOpen size={20} />
              </span>
              <span>
                <strong>{c.label}</strong>
                <small className="mono">{c.root}</small>
              </span>
              <ArrowRight size={18} />
            </Button>
          ))}
        </div>
      )}
      {!compact && (
        <div className="setup-foot">
          <span>Wardtone</span>
          <span>配置保存在本机</span>
        </div>
      )}
    </div>
  );
}
