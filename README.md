# Telegram Private Chatbot

一个运行在 Cloudflare Workers 上的 Telegram 私聊转发机器人。用户私聊机器人后，机器人会先做人机验证，验证通过后再把消息转发到管理员群组中对应的 Topic；管理员在 Topic 内回复，机器人会转发回用户私聊。

## ✨ 功能

- 私聊消息与群组话题双向转发
- 群组话题管理：每位访客自动创建独立话题
- 动态数学验证，避免固定题库被批量绕过
- 验证失败冷却，降低暴力尝试
- 验证期间暂存用户消息，验证通过后自动补发
- 支持文本、图片、视频、文件等 Telegram 消息类型
- 管理员指令

## 🚀 部署步骤

### 前置准备
1. 在 [@BotFather](https://t.me/BotFather) 创建 Telegram Bot，拿到 `BOT_TOKEN`
2. 在 BotFather 里关闭机器人的 Group Privacy：`/mybots` -> 选择机器人 -> `Bot Settings` -> `Group Privacy` -> `Turn off`
3. 创建 Telegram **群组**，开启**话题功能**（Forum Topics）
4. 把机器人拉入群组，设为**管理员**（需要管理话题权限）
5. 获取群组 ID，格式通常是 `-100xxxxxxxxxx`

获取 `SUPERGROUP_ID` 的简单方式：在 Telegram 桌面端右键群内任意消息，复制消息链接。如果链接里只有 `xxxxxxxxxx`，在前面补上 `-100`

### 部署

#### GitHub 连接 Cloudflare 部署
1. Fork本仓库(默认即可)
2. 在 Cloudflare Dashboard 打开 `Workers & Pages`
3. 点击 `Create application`，选择 `Connect to Git`
4. 选择你的仓库和生产分支(默认为main)
5. 构建命令填写：

```bash
npm install
```

6. 部署命令填写：

```bash
npm run deploy
```

7. 部署完成后，在 Worker 的 `Settings` -> `Variables` 里添加：
   - `BOT_TOKEN`
   - `SUPERGROUP_ID`
   - 可选：`ADMIN_IDS`
8. 变量保存后**重新部署**一次，让变量生效。

`wrangler.toml` 里开启了 `keep_vars = true`，后续通过 Wrangler 或 Git 部署时会保留 Dashboard 上设置的环境变量。


#### 环境变量

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `BOT_TOKEN` | 是 | Telegram Bot Token |
| `SUPERGROUP_ID` | 是 | 开启 Topics 的管理员群组 ID，必须以 `-100` 开头 |
| `ADMIN_IDS` | 否 | 管理员 Telegram 用户 ID 白名单，多个 ID 用英文逗号分隔 |

KV 绑定名固定为 `TOPIC_MAP`。使用本仓库的 `npm run deploy` 时，脚本会自动查找或创建名为 `telegram-private-chatbot` 的 KV namespace，并生成部署用 Wrangler 配置。



#### 本地命令行部署

安装依赖：

```bash
npm install
```

登录 Cloudflare：

```bash
npx wrangler login
```

部署：

```bash
npm run deploy
```

如果你不想使用自动 KV 脚本，也可以手动创建 KV，并在 `wrangler.toml` 里绑定：

```toml
[[kv_namespaces]]
binding = "TOPIC_MAP"
id = "你的 KV namespace id"
```

### 设置 Webhook

部署完成后，用浏览器访问：

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>
```

把 `<BOT_TOKEN>` 替换成 BotFather 给你的 Token，把 `<WORKER_URL>` 替换成 Worker 地址，例如：

```text
https://api.telegram.org/bot123456:ABC/setWebhook?url=https://example.workers.dev
```

返回 `{"ok":true,"result":true}` 表示 Webhook 设置成功。

如需重置 Webhook：

```text
https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook?drop_pending_updates=true
```

## 🛠 管理员指令

以下指令在管理员群组的用户 Topic 内使用。

| 指令 | 说明 |
| --- | --- |
| `/close` | 关闭当前用户对话 |
| `/open` | 重新打开当前用户对话 |
| `/ban` | 封禁当前用户 |
| `/unban` | 解封当前用户 |
| `/trust` | 永久信任当前用户，跳过验证 |
| `/reset` | 清除当前用户验证状态 |
| `/info` | 查看当前 Topic 对应的用户信息 |
| `/cleanup` | 扫描并清理已删除 Topic 对应的用户数据 |

## 常见问题

### 点击验证按钮没有反应

通常是 Webhook 没有正确设置，或 Worker 地址不对。重新执行设置 Webhook 的 URL 后再测试

### 机器人不能创建 Topic

检查三件事：

- `SUPERGROUP_ID` 是否以 `-100` 开头
- 群组是否开启 Topics
- 机器人是否是管理员，并拥有管理话题权限
