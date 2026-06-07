# 小小鱿鱼 MVP

这是一个微信小程序原生前端 + Node.js/Express 后端的 MVP。用户选择或拍摄食物图片，小程序上传到后端，后端调用多模态大模型并返回结构化营养估算；用户可以保存到今日记录并查看今日总热量和剩余热量。

## 项目结构

```text
ai-calorie-miniapp/
  backend/                 Node.js + Express 后端
    src/
      config/              环境变量配置
      controllers/         接口控制器
      middleware/          错误处理中间件
      routes/              API 路由
      services/            AI 调用与本地记录存储
      utils/               通用工具与结果校验
    data/                  SQLite 数据目录
    .env.example
    package.json
  miniprogram/             微信小程序原生代码
    pages/index/           拍照识别页
    pages/records/         今日记录页
    pages/history/         历史与趋势页
    pages/settings/        个人设置页
    custom-tab-bar/        自定义底部导航
    assets/tabbar/         底部导航图标素材
    assets/brand/          小程序头像/品牌图标素材
    utils/                 请求封装
  project.config.json      微信开发者工具项目配置
```

## 后端运行

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

把 `backend/.env` 里的 `AI_API_KEY` 改成你的后端大模型 API Key。不要把 Key 写到小程序代码里。

默认使用 OpenAI 兼容的 Chat Completions 多模态接口：

```env
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_RESPONSE_FORMAT=json_schema
```

如果使用豆包/火山方舟，可参考：

```env
AI_MOCK=false
AI_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_API_KEY=你的方舟 API Key
AI_MODEL=doubao-seed-2-0-lite-260428
AI_RESPONSE_FORMAT=none
AI_THINKING=disabled
```

如果你的兼容服务不支持 JSON Schema，可临时设置：

```env
AI_RESPONSE_FORMAT=json_object
```

如果模型连 JSON 模式也不支持，就设置：

```env
AI_RESPONSE_FORMAT=none
```

这种模式下后端不会传 `response_format` 参数，但仍会要求模型输出 JSON，并继续在服务端解析和校验字段。

后端仍会解析并校验返回字段，识别失败会返回明确错误。没有真实 Key 时，也可以用 `AI_MOCK=true` 跑通前后端流程。

## 小程序运行

1. 打开微信开发者工具。
2. 导入本项目根目录 `ai-calorie-miniapp`。
3. 如果只是本机调试，保持 `miniprogram/utils/config.js` 的 `API_BASE_URL = 'http://127.0.0.1:3000'`。
4. 如果用手机预览，把 `API_BASE_URL` 改成电脑局域网 IP，例如 `http://192.168.1.10:3000`。
5. 微信开发者工具本地调试时，可勾选“不校验合法域名”。真实发布时需要把后端部署到 HTTPS，并在小程序后台配置 `request` 和 `uploadFile` 合法域名。

## HTTPS 部署建议

当前后端是 Express + SQLite，更适合部署到 Render、Railway 这类 Web Service 平台。项目根目录已经提供 `render.yaml`，可用于 Render Blueprint 部署。

Render 部署时需要在环境变量里填写：

```env
AI_API_KEY=你的豆包/火山方舟 API Key
```

`render.yaml` 已经配置：

```env
AI_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=doubao-seed-2-0-lite-260428
AI_RESPONSE_FORMAT=none
AI_THINKING=disabled
SQLITE_DB_PATH=/var/data/app.sqlite
```

部署成功后，把 `miniprogram/utils/config.js` 里的：

```js
const PROD_API_BASE_URL = 'https://your-api-domain.example.com';
```

改成你的线上 HTTPS 地址，例如：

```js
const PROD_API_BASE_URL = 'https://api.example.com';
```

然后去微信公众平台配置服务器域名：

- `request 合法域名`：填写你的 HTTPS 后端域名
- `uploadFile 合法域名`：填写同一个 HTTPS 后端域名

注意：小程序正式发布不要使用 `localhost`、局域网 IP 或 HTTP 地址。

## API

### POST `/api/analyze-food`

表单上传字段名：`image`

返回：

```json
{
  "success": true,
  "data": {
    "foodName": "鸡胸肉沙拉",
    "estimatedWeight": "300g",
    "calories": 420,
    "protein": 35,
    "fat": 12,
    "carbs": 28,
    "dietAdvice": "适合减脂期食用，但注意沙拉酱用量。"
  }
}
```

### POST `/api/records`

保存一条饮食记录，请求体就是识别结果 JSON。

### PATCH `/api/records/:id`

编辑一条饮食记录，请求体就是更新后的识别结果 JSON。

### DELETE `/api/records/:id`

删除一条饮食记录。

### GET `/api/records/today`

返回今日记录、目标热量、总热量和剩余热量。

### GET `/api/records/history?range=yesterday|week|month`

返回昨天、本周或本月的饮食记录和汇总。

### GET `/api/records/trend?days=7`

返回最近 7 天热量趋势，用于前端柱状图。

### GET `/api/settings/daily-goal`

返回当前每日目标热量。

### PUT `/api/settings/daily-goal`

更新每日目标热量，请求体：

```json
{
  "dailyGoalCalories": 1800
}
```

### GET `/api/settings`

返回完整设置：目标热量、身高、体重、减脂目标。

### PUT `/api/settings`

更新完整设置：

```json
{
  "dailyGoalCalories": 1800,
  "heightCm": 170,
  "weightKg": 65,
  "fatLossGoal": "steady"
}
```

## MVP 边界

- 不包含登录系统。
- 不包含支付。
- 本地 SQLite 适合 MVP 和本地开发，后续可以替换为正式云数据库。
- 热量和营养值来自图片估算，只适合作为饮食记录参考。

## 开源素材

底部导航图标来自 [Lucide Icons](https://github.com/lucide-icons/lucide)，开源许可证说明保存在：

```text
miniprogram/assets/tabbar/LUCIDE_LICENSE.txt
```

小程序头像素材保存在：

```text
miniprogram/assets/brand/app-icon-1024.png
```

## 数据存储

后端现在使用 SQLite，数据库文件会自动生成在：

```text
backend/data/app.sqlite
```

如果之前已经有 `backend/data/records.json` 或 `backend/data/settings.json`，后端首次启动 SQLite 时会自动导入一次。
