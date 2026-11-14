import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  AudioLines,
  Repeat2,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Button, Slider } from "./ui";
const clock = (seconds: number) => {
  const n = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(n / 60)}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
};
export function AudioPlayer({
  source,
  onClose,
  onError,
}: {
  source: { label: string; url: string };
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(0),
    [loop, setLoop] = useState(false),
    [volume, setVolume] = useState(1);
  useEffect(() => {
    setTime(0);
    setDuration(0);
    const audio = ref.current!;
    audio.play().catch((error) => onError("试听播放失败：" + String(error)));
  }, [source.url]);
  const toggle = () => {
    const audio = ref.current!;
    if (audio.paused)
      audio.play().catch((error) => onError("试听播放失败：" + String(error)));
    else audio.pause();
  };
  return (
    <section className="audio-player" aria-label="音频试听">
      <audio
        ref={ref}
        src={source.url}
        loop={loop}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setTime(ref.current!.currentTime)}
        onLoadedMetadata={() => setDuration(ref.current!.duration)}
        onError={() => onError("无法解码此音频，请查看诊断记录。")}
      />
      <span className="player-symbol">
        <AudioLines />
      </span>
      <div className="player-label">
        <strong>{source.label}</strong>
        <span>试听</span>
      </div>
      <Button
        className="icon-button player-toggle"
        variant="ghost"
        aria-label={playing ? "暂停试听" : "播放试听"}
        onClick={toggle}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <span className="player-time mono">{clock(time)}</span>
      <Slider
        className="player-progress"
        value={Math.min(time, duration || 0)}
        max={duration || 1}
        step={0.01}
        disabled={!duration}
        label="试听进度"
        onValueChange={(value) => {
          ref.current!.currentTime = value;
          setTime(value);
        }}
      />
      <span className="player-time mono">{clock(duration)}</span>
      <Button
        variant="ghost"
        className="icon-button player-loop"
        aria-label="循环试听"
        aria-pressed={loop}
        onClick={() => setLoop(!loop)}
      >
        <Repeat2 />
      </Button>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="ghost" className="icon-button" aria-label="试听音量">
            {volume === 0 ? <VolumeX /> : <Volume2 />}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="volume-menu" side="top" sideOffset={12}>
            <span>
              音量 <span className="mono">{Math.round(volume * 100)}%</span>
            </span>
            <Slider
              value={volume}
              max={1}
              step={0.01}
              label="试听音量"
              onValueChange={(value) => {
                ref.current!.volume = value;
                setVolume(value);
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Button
        variant="ghost"
        className="icon-button"
        aria-label="关闭播放器"
        onClick={onClose}
      >
        <X />
      </Button>
    </section>
  );
}
