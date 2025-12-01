import { useEffect, useRef, useState } from 'react';
import {
  finishRealtimeSession,
  sendRealtimeChunk,
  startRealtimeSession,
} from '../services/paraformerClient';

type RecorderStatus = 'idle' | 'recording' | 'processing';

const TARGET_SAMPLE_RATE = 16000;

function concatFloat32(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function downsampleBuffer(
  buffer: Float32Array,
  sampleRate: number,
  outSampleRate: number
): Float32Array {
  if (outSampleRate === sampleRate) {
    return buffer;
  }
  const ratio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

const ParaformerPoc = () => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestDurationMs, setRequestDurationMs] = useState<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopRecording = async () => {
    if (!audioContextRef.current) return;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const existedChunks = concatFloat32(chunksRef.current);
    chunksRef.current = [];

    if (existedChunks.length === 0) {
      setError('录音数据为空，请重试。');
      setStatus('idle');
      return;
    }

    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setError('内部错误：未找到识别会话。');
      setStatus('idle');
      return;
    }

    try {
      setStatus('processing');
      setError(null);
      const tStart = performance.now();
      const result = await finishRealtimeSession(sessionId);
      const tEnd = performance.now();
      setTranscript(result.transcript || '');
      setRequestDurationMs(tEnd - tStart);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '转写失败，请稍后重试。';
      setError(message);
    } finally {
      sessionIdRef.current = null;
      setStatus('idle');
    }
  };

  const handleToggleRecording = async () => {
    if (status === 'processing') {
      return;
    }

    if (status === 'idle') {
      try {
        setError(null);
        setTranscript('');
        setRequestDurationMs(null);
        chunksRef.current = [];

        // 1) 先在后端创建一个新的流式识别会话
        const sessionId = await startRealtimeSession();
        sessionIdRef.current = sessionId;

        // 2) 再获取麦克风并开始采集音频
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          const inputCopy = new Float32Array(input.length);
          inputCopy.set(input);
          chunksRef.current.push(inputCopy);

          const sampleRate = audioContext.sampleRate;
          const downsampled = downsampleBuffer(inputCopy, sampleRate, TARGET_SAMPLE_RATE);
          const pcm16 = new Int16Array(downsampled.length);
          for (let i = 0; i < downsampled.length; i++) {
            let s = Math.max(-1, Math.min(1, downsampled[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const buffer = pcm16.buffer;

          const sid = sessionIdRef.current;
          if (sid) {
            // fire-and-forget，避免阻塞音频回调
            sendRealtimeChunk(sid, buffer).catch((e) => {
              console.error('Failed to send realtime chunk:', e);
            });
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        audioContextRef.current = audioContext;
        sourceRef.current = source;
        processorRef.current = processor;
        streamRef.current = stream;

        setStatus('recording');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '无法访问麦克风，请检查浏览器权限设置。';
        setError(message);
        setStatus('idle');
      }
      return;
    }

    if (status === 'recording') {
      await stopRecording();
    }
  };

  const buttonLabel =
    status === 'idle'
      ? '开始录音'
      : status === 'recording'
      ? '停止录音并开始转写'
      : '处理中...';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-xl mx-auto px-6 py-10 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Paraformer Realtime v2 POC
        </h1>
        <p className="text-sm text-slate-300 mb-8 text-center">
          点击按钮开始录音，再次点击结束录音。结束后会将整段音频发送到阿里云进行转写，并在下方显示结果。
        </p>

        <div className="flex flex-col items-center gap-6">
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={status === 'processing'}
            className={`w-full max-w-xs py-3 rounded-full text-base font-semibold transition-colors ${
              status === 'recording'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-emerald-500 hover:bg-emerald-600'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {buttonLabel}
          </button>

          {status === 'recording' && (
            <p className="text-sm text-amber-300">
              正在录音中... 再次点击按钮结束录音。
            </p>
          )}

          {requestDurationMs != null && (
            <p className="text-xs text-slate-400">
              本次转写耗时约{' '}
              <span className="font-mono">
                {Math.round(requestDurationMs)} ms
              </span>
              （从结束录音到收到结果）
            </p>
          )}

          {error && (
            <div className="w-full text-sm text-red-400 bg-red-950/40 border border-red-700/60 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="w-full">
            <label className="block text-xs font-medium text-slate-400 mb-2">
              转写结果
            </label>
            <div className="min-h-[120px] max-h-64 overflow-auto rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm leading-relaxed">
              {transcript ? (
                <p className="whitespace-pre-wrap">{transcript}</p>
              ) : (
                <span className="text-slate-500">
                  还没有结果。录音结束并完成转写后会在这里显示文本。
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParaformerPoc;


