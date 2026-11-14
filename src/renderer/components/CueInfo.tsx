import { useState } from "react";
import { Info, AudioLines } from "lucide-react";
import {
  cueEvidenceVersion,
  getClipCue,
  playbackOverview,
} from "../../shared/cues";
import { Button, Disclosure, Modal } from "./ui";

export function CueInfo({ bundle, clip }: { bundle: string; clip: string }) {
  const [open, setOpen] = useState(false);
  const cue = getClipCue(bundle, clip);
  return (
    <>
      <Button
        variant="ghost"
        className="icon-button cue-info-button"
        aria-label={"播放时机 " + clip}
        onClick={() => setOpen(true)}
      >
        <Info />
      </Button>
      {open && (
        <Modal
          title={cue?.title ?? "用途待核对"}
          open
          onClose={() => setOpen(false)}
        >
          <div className="dialog-body cue-detail">
            <div className="cue-identity">
              <span
                className={
                  "tag " + (cue?.status !== "configured" ? "warning" : "")
                }
              >
                {cue?.status === "trigger-unresolved"
                  ? "触发点待核对"
                  : (cue?.kind ?? "未核对")}
              </span>
              <span className="mono">{clip}</span>
            </div>
            {cue ? (
              <>
                <section>
                  <h3>什么时候播放</h3>
                  <p>{cue.trigger}</p>
                </section>
                {cue.probability !== undefined && (
                  <dl className="cue-metrics">
                    <div>
                      <dt>触发概率</dt>
                      <dd>
                        {Math.round(cue.probability * 100)}
                        <small>%</small>
                      </dd>
                    </div>
                    <div>
                      <dt>当前路径冷却</dt>
                      <dd>
                        {cue.cooldown || "无"}
                        {!!cue.cooldown && <small>秒</small>}
                      </dd>
                    </div>
                    {cue.priority !== undefined && (
                      <div>
                        <dt>优先级</dt>
                        <dd>{cue.priority}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <section>
                  <h3>怎样播放</h3>
                  <ul>
                    {cue.playback.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </section>
                <Disclosure title="配置与代码依据">
                  <p className="cue-evidence-version">{cueEvidenceVersion}</p>
                  {cue.signals.length > 0 && (
                    <div className="cue-signals mono">
                      {cue.signals.map((signal) => (
                        <code key={signal}>{signal}</code>
                      ))}
                    </div>
                  )}
                  <ul className="cue-sources">
                    {cue.sources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                  <p className="muted">
                    用途由本机资源配置、界面动画与客户端代码核对。
                  </p>
                </Disclosure>
              </>
            ) : (
              <p>
                这条资源尚未收入当前版本的用途目录。扫描日志已记录资源包与编号，需要核对对应版本的播放配置。
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export function PlaybackGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <AudioLines />
        播放规则
      </Button>
      {open && (
        <Modal title="音频播放规则" open onClose={() => setOpen(false)}>
          <div className="dialog-body cue-detail">
            <ul className="playback-guide">
              {playbackOverview.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="cue-evidence-version">
              核对版本 · {cueEvidenceVersion}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
