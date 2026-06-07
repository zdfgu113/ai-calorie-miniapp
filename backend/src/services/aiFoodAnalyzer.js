const { config } = require('../config/env');
const { ApiError } = require('../utils/apiError');
const { FOOD_ANALYSIS_SCHEMA, normalizeFoodAnalysis } = require('../utils/foodSchema');

const SYSTEM_PROMPT = [
  '你是一个谨慎的食物图片营养估算助手。',
  '你只能根据用户上传的图片做粗略估算，不要编造看不见的食物。',
  '你必须只返回一个 JSON 对象，不要输出 Markdown、解释文本、代码块或多余字段。'
].join('\n');

const USER_PROMPT = [
  '请识别图片中的主要可食用内容，并估算整张图片中这份食物的总营养。',
  '如果有多种食物，请合并成一个食物名称，例如“米饭和番茄炒蛋”，热量和三大营养素按整份估算。',
  '只允许返回这些字段：foodName、estimatedWeight、calories、protein、fat、carbs、dietAdvice。',
  '字段要求：foodName 为中文食物名；estimatedWeight 为类似“300g”的字符串；calories 为 kcal 数字；protein/fat/carbs 为克数数字；dietAdvice 为一句 40 字以内的中文建议。',
  '如果图片不是食物、图片太暗、食物太远、被遮挡严重或无法判断，请不要猜测；仍返回 JSON：foodName 为“无法识别”，estimatedWeight 为“0g”，calories/protein/fat/carbs 均为 0，dietAdvice 写明用户应该如何重拍。',
  '返回格式示例：{"foodName":"鸡胸肉沙拉","estimatedWeight":"300g","calories":420,"protein":35,"fat":12,"carbs":28,"dietAdvice":"适合减脂期食用，但注意沙拉酱用量。"}'
].join('\n');

async function analyzeFoodImage(file) {
  if (!file) {
    throw new ApiError(400, '请上传一张食物图片', 'IMAGE_REQUIRED');
  }

  if (config.ai.mock) {
    return mockFoodAnalysis();
  }

  if (!config.ai.apiKey) {
    throw new ApiError(500, '后端未配置 AI_API_KEY', 'AI_KEY_MISSING');
  }

  const dataUrl = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
  const rawResult = await callOpenAICompatibleModel(dataUrl);
  const normalized = normalizeFoodAnalysis(rawResult);

  if (isUnrecognizedFood(normalized)) {
    throw new ApiError(422, normalized.dietAdvice || '无法识别食物，请换一张更清晰的食物照片', 'FOOD_NOT_RECOGNIZED');
  }

  return normalized;
}

async function callOpenAICompatibleModel(dataUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const response = await fetch(`${trimEndSlash(config.ai.apiBaseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildChatCompletionsBody(dataUrl)),
      signal: controller.signal
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new ApiError(
        502,
        `大模型识别失败：${formatProviderError(response.status, responseText)}`,
        'AI_PROVIDER_ERROR'
      );
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new ApiError(502, '大模型返回内容不是有效 JSON', 'AI_RESPONSE_INVALID', responseText.slice(0, 300));
    }

    const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
      ? payload.choices[0].message.content
      : null;

    if (!content) {
      throw new ApiError(502, '大模型没有返回识别结果', 'AI_RESPONSE_EMPTY');
    }

    return parseModelJson(content);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(504, '大模型识别超时，请稍后重试', 'AI_TIMEOUT');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(502, `大模型服务调用失败：${error.message}`, 'AI_REQUEST_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

function buildChatCompletionsBody(dataUrl) {
  const body = {
    model: config.ai.model,
    temperature: 0.1,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: USER_PROMPT
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ]
  };

  if (config.ai.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  } else if (config.ai.responseFormat === 'json_schema') {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'food_calorie_analysis',
        strict: true,
        schema: FOOD_ANALYSIS_SCHEMA
      }
    };
  }

  if (config.ai.thinking) {
    body.thinking = {
      type: config.ai.thinking
    };
  }

  return body;
}

function parseModelJson(content) {
  if (Array.isArray(content)) {
    const text = content
      .map((item) => item && (item.text || item.content || ''))
      .join('')
      .trim();
    return parseModelJson(text);
  }

  if (typeof content === 'object') {
    return content;
  }

  if (typeof content !== 'string') {
    throw new ApiError(502, '大模型返回格式异常', 'AI_RESPONSE_INVALID');
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const extracted = extractFirstJsonObject(cleaned);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch (nestedError) {
        // Fall through to a friendly parse error below.
      }
    }

    throw new ApiError(
      502,
      '模型没有按 JSON 格式返回，请换一张更清晰的食物照片再试',
      'AI_JSON_PARSE_FAILED',
      cleaned.slice(0, 300)
    );
  }
}

function extractFirstJsonObject(text) {
  const start = text.indexOf('{');

  if (start === -1) {
    return '';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return '';
}

function formatProviderError(status, responseText) {
  try {
    const parsed = JSON.parse(responseText);
    if (parsed.error && parsed.error.message) {
      return `${status} ${parsed.error.message}`;
    }
    return `${status} ${JSON.stringify(parsed).slice(0, 240)}`;
  } catch (error) {
    return `${status} ${responseText.slice(0, 240)}`;
  }
}

function trimEndSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function mockFoodAnalysis() {
  return {
    foodName: '鸡胸肉沙拉',
    estimatedWeight: '300g',
    calories: 420,
    protein: 35,
    fat: 12,
    carbs: 28,
    dietAdvice: '适合减脂期食用，但注意沙拉酱用量。'
  };
}

function isUnrecognizedFood(result) {
  return result.foodName === '无法识别'
    || result.foodName.includes('无法判断')
    || result.foodName.includes('不确定')
    || result.calories === 0;
}

module.exports = { analyzeFoodImage };
