import apiFetch, { apiPostBinary } from '../api';

export interface ParaformerTranscribeResult {
  transcript: string;
  // 保留原始响应，便于调试 / 观察模型返回结构
  raw?: unknown;
}

export async function transcribeAudio(blob: Blob): Promise<ParaformerTranscribeResult> {
  const response = await apiPostBinary(
    '/api/paraformer/realtime-poc',
    blob,
    'application/octet-stream'
  );

  if (!response.ok) {
    let detail: unknown;
    try {
      const data = await response.json();
      detail = data?.detail || data?.error;
    } catch {
      // ignore JSON parse error
    }
    let message = `Transcription failed with status ${response.status}`;
    if (typeof detail === 'string') {
      message = detail;
    } else if (detail && typeof detail === 'object') {
      const anyDetail = detail as { code?: string; message?: string };
      if (anyDetail.message || anyDetail.code) {
        message = `${anyDetail.code ?? 'Error'}: ${anyDetail.message ?? ''}`;
      }
    }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    transcript: data.transcript || '',
    raw: data.raw,
  };
}

// --- 流式 WebSocket POC 所需的 HTTP 封装 ---

export async function startRealtimeSession(): Promise<string> {
  const response = await apiFetch('/api/paraformer/realtime-session/start', {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data?.error || `Failed to start realtime session (status ${response.status})`
    );
  }

  const data = await response.json();
  return data.sessionId as string;
}

export async function sendRealtimeChunk(
  sessionId: string,
  buffer: ArrayBuffer
): Promise<void> {
  const response = await apiPostBinary(
    `/api/paraformer/realtime-session/${sessionId}/chunk`,
    buffer,
    'application/octet-stream'
  );

  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data?.error ||
        `Failed to send realtime chunk (session ${sessionId}, status ${response.status})`
    );
  }
}

export async function finishRealtimeSession(
  sessionId: string
): Promise<ParaformerTranscribeResult> {
  const response = await apiFetch(`/api/paraformer/realtime-session/${sessionId}/finish`, {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data?.error ||
        `Failed to finish realtime session (status ${response.status})`
    );
  }

  const data = await response.json();
  return {
    transcript: data.transcript || '',
    raw: data,
  };
}


