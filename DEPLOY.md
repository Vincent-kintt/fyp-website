# Deployment Guide (Vercel)

This project is optimized for deployment on [Vercel](https://vercel.com).

## Prerequisites

- A GitHub repository with this code.
- A [Vercel](https://vercel.com) account.
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or any MongoDB instance).

## Environment Variables

You need to configure the following Environment Variables in your Vercel Project Settings:

### Database
- \`MONGODB_URI\`: Your MongoDB connection string.
  - Format: \`mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority\`
  - **Important**: Ensure your MongoDB Atlas Network Access whitelist includes \`0.0.0.0/0\` (allow access from anywhere) because Vercel Serverless Functions have dynamic IPs.
- \`MONGODB_DB\`: The name of your database (e.g., \`reminder-app\`).

### Authentication (NextAuth.js)
- \`NEXTAUTH_SECRET\`: A random string used to hash tokens.
  - You can generate one using: \`openssl rand -base64 32\`
- \`NEXTAUTH_URL\`: The URL of your deployed site (e.g., \`https://your-project.vercel.app\`).
  - *Note*: Vercel automatically sets this for the main branch, but it's good practice to set it explicitly if you have custom domains.

### AI Integration (Optional but recommended)
- \`PERPLEXITY_API_KEY\`: For the web search and AI features.
- \`OPENAI_API_KEY\`: If you are using OpenAI models.

## Deployment Steps

1. **Push to GitHub**: Ensure your latest code is pushed to your GitHub repository.
2. **Import to Vercel**:
   - Go to your Vercel Dashboard.
   - Click "Add New..." -> "Project".
   - Select your GitHub repository.
3. **Configure Project**:
   - Framework Preset: **Next.js** (should be auto-detected).
   - Root Directory: \`./\` (default).
4. **Add Environment Variables**:
   - Copy the values from your local \`.env.local\` (excluding comments) to the Vercel Environment Variables section.
5. **Deploy**:
   - Click "Deploy".
   - Vercel will build your application and assign a URL.

## Configuration Files Added

- \`vercel.json\`: Configures serverless function timeouts.
  - AI routes (\`app/api/ai/**/*\`) are set to 60s (max for Hobby plan is 10s, Pro is 300s. If you are on Hobby, long AI tasks might timeout).
- \`package.json\`: Added \`engines\` to ensure correct Node.js version.

## Troubleshooting

- **Database Connection Error**: Check if your MongoDB Atlas IP Whitelist allows \`0.0.0.0/0\`.
- **Timeout**: If AI tasks fail with 504 Gateway Timeout, the operation took too long. On Vercel Hobby tier, functions are limited to 10 seconds. You may need to optimize the prompt or upgrade to Pro.
