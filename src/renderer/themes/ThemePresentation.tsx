import { Check, AudioLines, ArrowUpRight, Plus } from "lucide-react";
import {
  themeCatalog,
  themeIds,
  defaultTheme,
  type ThemeId,
} from "../../shared/themes";
import { Button } from "../components/ui";
import type { Config } from "../../shared/model";
import { themeSpecs, resolveTheme } from "./index";
import { useSystemDark } from "./useTheme";

export function TerminalIdentity({ theme }: { theme: ThemeId }) {
  const meta = themeCatalog[theme],
    spec = themeSpecs[theme];
  if (spec.chrome === "quiet") return null;
  return (
    <div className="terminal-identity">
      <span className="terminal-identity-code">WT—{meta.code}</span>
      <span className="terminal-identity-name">{meta.name}</span>
      <span className="terminal-identity-signal" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="terminal-identity-art" aria-hidden="true" />
    </div>
  );
}
export function TerminalConsole({
  theme,
  onLibrary,
  onNew,
  busy,
}: {
  theme: ThemeId;
  onLibrary: () => void;
  onNew: () => void;
  busy: boolean;
}) {
  const meta = themeCatalog[theme],
    spec = themeSpecs[theme];
  if (spec.chrome === "quiet") return null;
  return (
    <section className="terminal-console" aria-label={meta.name + "播控台"}>
      <div className="module-caption">
        <AudioLines />
        <span>VOICE CONSOLE</span>
        <span className="module-code">WT / {meta.code}</span>
        <span className="window-controls" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="console-display">
        <div className="console-copy">
          <span className="console-edition">{meta.name}</span>
          <h2>
            <span>{spec.headline[0]}</span>
            <span>{spec.headline[1]}</span>
          </h2>
        </div>
        <div className="console-object" aria-hidden="true" />
        <div className="console-sticker" aria-hidden="true" />
        <span className="console-registration" aria-hidden="true">
          {meta.edition}
        </span>
      </div>
      <div className="console-actions">
        <Button
          className="console-launch"
          variant="primary"
          onClick={onLibrary}
        >
          进入语音库 <ArrowUpRight />
        </Button>
        <Button className="console-new" disabled={busy} onClick={onNew}>
          <Plus /> 新建语音包
        </Button>
      </div>
    </section>
  );
}
export function ThemePicker({
  config,
  busy,
  onChange,
}: {
  config: Config;
  busy: boolean;
  onChange: (theme: ThemeId) => void;
}) {
  const dark = useSystemDark();
  return (
    <div className="theme-grid" role="radiogroup" aria-label="终端主题">
      {themeIds.map((id, index) => {
        const theme = resolveTheme(id, config.accent, dark),
          selected = config.theme === id;
        return (
          <button
            type="button"
            className="theme-card"
            role="radio"
            key={id}
            aria-label={theme.name}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onChange(id);
            }}
            onKeyDown={(event) => {
              if (
                busy ||
                ![
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Home",
                  "End",
                ].includes(event.key)
              )
                return;
              event.preventDefault();
              const step = ["ArrowLeft", "ArrowUp"].includes(event.key)
                ? -1
                : 1;
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? themeIds.length - 1
                    : (index + step + themeIds.length) % themeIds.length;
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                [next]?.focus();
              onChange(themeIds[next]);
            }}
          >
            <span
              className="theme-preview"
              style={theme.style}
              data-chrome={theme.chrome}
              aria-hidden="true"
            >
              <span className="theme-preview-bar">
                <span>WARDTONE</span>
                <span>— □ ×</span>
              </span>
              <span className="theme-preview-body">
                <span className="theme-preview-sidebar">
                  <AudioLines />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="theme-preview-console">
                  <span className="theme-preview-edition">
                    {theme.edition.split(" / ")[0]}
                  </span>
                  <span className="theme-preview-number">
                    {theme.code}
                    <small> / AUDIO</small>
                  </span>
                  <span className="theme-preview-lines">
                    <i />
                    <i />
                  </span>
                  <span className="theme-preview-button">▶</span>
                </span>
                <span className="theme-preview-art" />
              </span>
            </span>
            <span className="theme-card-footer">
              <span className="theme-card-title">{theme.name}</span>
              {id === defaultTheme && (
                <span className="theme-default">默认</span>
              )}
              <span className="theme-radio">{selected && <Check />}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
