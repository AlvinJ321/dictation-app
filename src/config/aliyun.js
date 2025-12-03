require('dotenv').config();

// DashScope / 百炼 相关配置，用于 Paraformer 调用
// 优先从更明确的变量名中读取，便于你在 .env 里按需配置
const dashscopeApiKey =
  process.env.ALIYUN_DASHSCOPE_API_KEY ||
  process.env.BAILIAN_API_KEY ||
  process.env.DASHSCOPE_API_KEY;

if (!dashscopeApiKey) {
  console.warn(
    '[Paraformer] DashScope / 百炼 API key 未配置，请在 .env 中设置 ALIYUN_DASHSCOPE_API_KEY 或 BAILIAN_API_KEY。'
  );
}

module.exports = {
  dashscopeApiKey,
};

