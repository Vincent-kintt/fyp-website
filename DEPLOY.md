# Vercel 部署指南

## 快速部署

### 方法一：GitHub 整合（推薦）

1. **Push 專案到 GitHub**
   ```bash
   git add .
   git commit -m "Add Vercel deployment config"
   git push origin main
   ```

2. **連接 Vercel**
   - 前往 [vercel.com](https://vercel.com)
   - 點擊 "Add New Project"
   - 選擇你的 GitHub repository
   - Vercel 會自動偵測 Next.js 專案

3. **設定環境變數**
   在 Vercel Dashboard > Project Settings > Environment Variables 添加：

   | Variable | Description | Required |
   |----------|-------------|----------|
   | `MONGODB_URI` | MongoDB 連接字串 | ✅ |
   | `MONGODB_DB` | 資料庫名稱 | ✅ |
   | `AUTH_SECRET` | 認證密鑰（使用 `openssl rand -base64 32` 生成） | ✅ |
   | `LLM_API_URL` | LLM API 端點 | ✅ |
   | `LLM_API_KEY` | LLM API 金鑰 | ✅ |
   | `LLM_MODEL` | LLM 模型名稱 | ✅ |
   | `PERPLEXITY_API_KEY` | Perplexity API 金鑰（searchWeb 功能） | ⚠️ 可選 |

   > **注意**: `AUTH_URL` 在 Vercel 上會自動設定，無需手動添加。

4. **部署**
   - 點擊 "Deploy"
   - 等待 build 完成
   - 取得你的 production URL

### 方法二：Vercel CLI

```bash
# 安裝 Vercel CLI
npm i -g vercel

# 登入
vercel login

# 部署（會引導你設定專案）
vercel

# 或直接部署到 production
vercel --prod
```

---

## 環境變數設定

### Production vs Preview vs Development

Vercel 支援三種環境：
- **Production**: 主要部署（main branch）
- **Preview**: PR 預覽部署
- **Development**: 本地開發（`vercel dev`）

建議為不同環境使用不同的資料庫和 API keys。

### 必要環境變數

```bash
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/reminder-app
MONGODB_DB=reminder-app

# Auth.js v5
AUTH_SECRET=<your-secret>

# LLM (OpenRouter 或 OpenAI)
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
LLM_API_KEY=<your-api-key>
LLM_MODEL=x-ai/grok-4.1-fast

# Perplexity (for web search)
PERPLEXITY_API_KEY=<your-api-key>
```

---

## 配置說明

### vercel.json

```json
{
  "functions": {
    "app/api/ai/**/*.js": {
      "maxDuration": 60
    }
  }
}
```

- AI API routes 設定為 60 秒 timeout（Hobby plan 最大值）
- Pro plan 可設定至 300 秒

### Build 設定

Vercel 自動偵測：
- **Framework**: Next.js
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

---

## 故障排除

### Build 失敗

1. **檢查 Node.js 版本**
   - Vercel 預設使用 Node.js 20.x
   - 可在 Project Settings > General > Node.js Version 調整

2. **檢查環境變數**
   - 確保所有必要變數已設定
   - 變數值不需要引號

3. **查看 Build Logs**
   - Vercel Dashboard > Deployments > 選擇部署 > 查看 logs

### Runtime 錯誤

1. **Function Timeout**
   - AI 操作可能需要較長時間
   - 確認 `vercel.json` 設定了 `maxDuration`
   - Hobby plan 最大 60 秒，Pro plan 最大 300 秒

2. **MongoDB 連接**
   - 確保 MongoDB Atlas 允許來自任何 IP 的連接（0.0.0.0/0）
   - 或添加 Vercel 的 IP 範圍到白名單

3. **CORS 問題**
   - Next.js API routes 預設處理 CORS
   - 如需自訂，在 `next.config.mjs` 添加 headers

---

## 效能優化

### 推薦設定

1. **Edge Runtime**（可選）
   ```javascript
   // 在 API route 添加
   export const runtime = 'edge';
   ```
   > 注意：Edge runtime 不支援某些 Node.js API

2. **Image Optimization**
   ```javascript
   // next.config.mjs
   const nextConfig = {
     images: {
       remotePatterns: [
         { protocol: 'https', hostname: 'example.com' }
       ]
     }
   };
   ```

3. **啟用 Analytics**
   - Vercel Dashboard > Analytics
   - 監控 Function 效能和錯誤

---

## 自訂網域

1. 前往 Project Settings > Domains
2. 添加你的網域
3. 設定 DNS 記錄：
   - **CNAME**: `your-domain.com` → `cname.vercel-dns.com`
   - 或使用 Vercel Nameservers

---

## 有用連結

- [Vercel Next.js 文件](https://vercel.com/docs/frameworks/nextjs)
- [環境變數](https://vercel.com/docs/environment-variables)
- [Serverless Functions](https://vercel.com/docs/functions)
- [自訂網域](https://vercel.com/docs/custom-domains)
