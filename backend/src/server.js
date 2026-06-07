const app = require('./app');
const { config } = require('./config/env');

app.listen(config.port, () => {
  const localUrl = config.nodeEnv === 'production'
    ? `port ${config.port}`
    : `http://localhost:${config.port}`;

  console.log(`AI卡路里识别后端已启动：${localUrl}`);
});
