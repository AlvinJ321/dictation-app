const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { dashscopeApiKey } = require('./config/aliyun');

/**
 * 注册 Paraformer Realtime v2 POC 路由。
 * 该模块独立于现有业务逻辑，仅在开发环境用于 POC。
 *
 * @param {import('express').Express} app
 * @param {Function} authenticateToken
 */
function registerParaformerRealtimePoc(app, authenticateToken) {
  if (!dashscopeApiKey) {
    console.warn(
      '[Paraformer-POC] DashScope API key 未配置，/api/paraformer/realtime-poc 将不可用。'
    );
  }

  // POC 专用接口：前端录音结束后，将整段音频（二进制）POST 到这里
  app.post('/api/paraformer/realtime-poc', authenticateToken, async (req, res) => {
    if (!dashscopeApiKey) {
      return res
        .status(500)
        .json({ error: 'DashScope API key not configured on server.' });
    }

    const audioBuffer = req.body;
    if (!audioBuffer || !audioBuffer.length) {
      return res.status(400).json({ error: 'No audio data found in request body.' });
    }

    try {
      const transcript = await transcribeWithParaformerRealtime(audioBuffer);
      console.log('[Paraformer-POC] Final transcript:\n', transcript || '<EMPTY>');
      return res.json({ transcript });
    } catch (error) {
      console.error(
        '[Paraformer-POC] Error during realtime transcription:',
        error && error.message ? error.message : error
      );
      return res.status(500).json({
        error: 'Paraformer realtime transcription failed',
        detail: error && error.message ? error.message : String(error),
      });
    }
  });
}

/**
 * 使用 Paraformer Realtime v2 通过 WebSocket 转写一段整段音频。
 * 实现基本参考官方 Node.js 示例，但音频来源是内存中的 Buffer。
 *
 * @param {Buffer} audioBuffer
 * @returns {Promise<string>}
 */
function transcribeWithParaformerRealtime(audioBuffer) {
  return new Promise((resolve, reject) => {
    const apiKey = dashscopeApiKey;
    const url = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';

    const TASK_ID = uuidv4().replace(/-/g, '').slice(0, 32);

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `bearer ${apiKey}`,
      },
    });

    let taskStarted = false;
    let finalText = '';
    let finished = false;

    ws.on('open', () => {
      const runTaskMessage = {
        header: {
          action: 'run-task',
          task_id: TASK_ID,
          streaming: 'duplex',
        },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model: 'paraformer-realtime-v2',
          // 前端将音频转成 16kHz 单声道 PCM/WAV
          parameters: {
            sample_rate: 16000,
            format: 'wav',
          },
          input: {},
        },
      };
      ws.send(JSON.stringify(runTaskMessage));
    });

    ws.on('message', (data) => {
      // 调试用：观察 Paraformer 返回的完整消息结构
      try {
        console.log('[Paraformer-POC] WS message:', data.toString());
      } catch {
        // ignore logging error
      }

      let message;
      try {
        message = JSON.parse(data);
      } catch {
        // 非 JSON 消息忽略
        return;
      }

      const event = message?.header?.event;
      const output = message?.payload?.output;

      switch (event) {
        case 'task-started':
          taskStarted = true;
          sendAudioStream(ws, audioBuffer, TASK_ID);
          break;
        case 'result-generated': {
          // 只保留最新一句作为“最终结果候选”，中间过程不累积
          let sentenceText =
            output?.sentence?.text || output?.text || output?.result || '';

          if (!sentenceText && Array.isArray(output?.sentences)) {
            const last = output.sentences
              .map((s) => s.text || s.result || '')
              .filter(Boolean)
              .at(-1);
            sentenceText = last || '';
          }

          if (sentenceText) {
            finalText = sentenceText;
          }
          break;
        }
        case 'task-finished': {
          // 有些实现会在 task-finished 时再给一次最终结果，这里再兜底取一次
          let sentenceText =
            output?.sentence?.text || output?.text || output?.result || '';

          if (!sentenceText && Array.isArray(output?.sentences)) {
            const last = output.sentences
              .map((s) => s.text || s.result || '')
              .filter(Boolean)
              .at(-1);
            sentenceText = last || '';
          }

          if (sentenceText && !finalText) {
            finalText = sentenceText;
          }

          finished = true;
          ws.close();
          resolve(finalText.trim());
          break;
        }
        case 'task-failed': {
          finished = true;
          const errMsg =
            message?.header?.error_message || 'Paraformer realtime task failed';
          ws.close();
          reject(new Error(errMsg));
          break;
        }
        default:
          // 其他事件暂不处理
          break;
      }
    });

    ws.on('error', (error) => {
      if (!finished) {
        finished = true;
        reject(error);
      }
    });

    ws.on('close', () => {
      if (!taskStarted && !finished) {
        reject(new Error('Paraformer realtime task did not start before connection close.'));
      }
    });
  });
}

/**
 * 将整段音频一次性通过 WebSocket 发送给阿里云，然后立刻发送 finish-task。
 * 这样在保证录音完整性的前提下，将发送阶段的额外延迟压到最小。
 *
 * @param {WebSocket} ws
 * @param {Buffer} audioBuffer
 * @param {string} taskId
 */
function sendAudioStream(ws, audioBuffer, taskId) {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  // 一次性发送整段 16k PCM/WAV 音频
  ws.send(audioBuffer);

  // 立刻告知服务端任务已结束，开始出最终结果
  const finishTaskMessage = {
    header: {
      action: 'finish-task',
      task_id: taskId,
      streaming: 'duplex',
    },
    payload: {
      input: {},
    },
  };
  ws.send(JSON.stringify(finishTaskMessage));
}

module.exports = {
  registerParaformerRealtimePoc,
};


