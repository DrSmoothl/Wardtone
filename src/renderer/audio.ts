export type AudioFile = { name: string; bytes: Uint8Array };
export type Processing = {
  start: number;
  end: number;
  rate: number;
  gain: number;
  channels?: 1 | 2;
};
export async function decode(file: AudioFile) {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(
      new Uint8Array(file.bytes).buffer,
    );
    if (buffer.length * buffer.numberOfChannels * 4 > 128 * 1024 * 1024)
      throw new Error("解码后的音频超过 128 MiB，请选择较小的音频");
    return buffer;
  } finally {
    await context.close();
  }
}
export async function processAudio(buffer: AudioBuffer, options: Processing) {
  if (
    !Number.isFinite(options.start) ||
    !Number.isFinite(options.end) ||
    options.start < 0 ||
    options.end > buffer.duration + 0.001 ||
    options.end <= options.start
  )
    throw new Error("裁剪起止时间无效");
  const length = Math.ceil((options.end - options.start) * options.rate),
    channels = options.channels ?? 1;
  if (length * channels * 2 > 64 * 1024 * 1024)
    throw new Error("处理后的音频超过 64 MiB，请缩短裁剪范围或降低采样率");
  const context = new OfflineAudioContext(channels, length, options.rate),
    source = context.createBufferSource(),
    gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = options.gain;
  source.connect(gain).connect(context.destination);
  source.start(0, options.start, options.end - options.start);
  const rendered = await context.startRendering(),
    samples = Array.from({ length: channels }, (_, channel) =>
      rendered.getChannelData(channel),
    ),
    pcm = new Uint8Array(length * channels * 2),
    view = new DataView(pcm.buffer);
  for (let i = 0; i < length; i++)
    for (let channel = 0; channel < channels; channel++)
      view.setInt16(
        (i * channels + channel) * 2,
        Math.round(Math.max(-1, Math.min(1, samples[channel][i])) * 32767),
        true,
      );
  return pcm;
}
