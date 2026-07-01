---
name: nextjs-development
description: Next.js 全栈开发。App Router / RSC / Server Actions / ISR / Middleware / Edge / 部署优化。配合 react-development / ts 用。
---

# Next.js 开发

## 适用场景
- Next.js App Router 全栈项目。
- React Server Components 数据获取。
- ISR / SSR / SSG 渲染策略选择。
- Server Actions 表单处理。
- Vercel / Docker / standalone 部署。

## 不适用
- 纯 React SPA → `react-development`。
- Vue/Nuxt → `vue`。
- Svelte → `svelte`。

---

## App Router 核心

```text
app/
├── layout.tsx           Root Layout (必须, 包含 <html><body>)
├── page.tsx             首页 (/)
├── loading.tsx          Streaming loading UI
├── error.tsx            Error boundary
├── not-found.tsx        404 页面
├── globals.css
├── (group)/             Route Group (不影响 URL)
│   └── dashboard/
│       ├── layout.tsx   Nested layout
│       └── page.tsx     /dashboard
├── blog/
│   ├── page.tsx         /blog
│   └── [slug]/
│       └── page.tsx     /blog/:slug (动态路由)
├── api/
│   └── route.ts         Route Handler (API endpoint)
└── @modal/              Parallel Route (slot)
    └── default.tsx
```

## Server Components vs Client Components

```tsx
// 默认是 Server Component (不能用 hooks/事件/browser API)
// app/page.tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }  // ISR: 1小时重验证
  });
  const posts = await data.json();
  return <PostList posts={posts} />;
}

// Client Component (需要交互时)
// components/Counter.tsx
'use client';
import { useState } from 'react';
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## 数据获取

```tsx
// Server Component 直接 async/await
async function Page() {
  // fetch 自动去重 + 缓存
  const res = await fetch('https://api.example.com/data', {
    cache: 'force-cache',        // 默认: 静态 (SSG)
    // cache: 'no-store',        // 每次请求 (SSR)
    // next: { revalidate: 60 }, // ISR: 60秒
    // next: { tags: ['posts'] } // 按需重验证
  });
  return <div>{/* ... */}</div>;
}

// 按需重验证 (Server Action / Route Handler)
import { revalidateTag, revalidatePath } from 'next/cache';
revalidateTag('posts');          // 重验证带该 tag 的所有 fetch
revalidatePath('/blog');         // 重验证该路径

// unstable_cache (缓存非 fetch 操作)
import { unstable_cache } from 'next/cache';
const getCachedUser = unstable_cache(
  async (id: string) => db.user.findUnique({ where: { id } }),
  ['user'],                      // cache key
  { revalidate: 3600, tags: ['user'] }
);
```

## Server Actions

```tsx
// app/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  // 验证
  if (!title) throw new Error('Title required');

  // 写入数据库
  await db.post.create({ data: { title, content } });

  // 重验证 + 重定向
  revalidatePath('/blog');
  redirect('/blog');
}

// 使用 (表单)
// app/new-post/page.tsx
import { createPost } from '../actions';
export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" />
      <button type="submit">Create</button>
    </form>
  );
}

// 使用 (useActionState, React 19+)
'use client';
import { useActionState } from 'react';
import { createPost } from '../actions';
function Form() {
  const [state, action, pending] = useActionState(createPost, null);
  return (
    <form action={action}>
      <button disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>
    </form>
  );
}
```

## Middleware

```ts
// middleware.ts (项目根目录)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 认证检查
  const token = request.cookies.get('session');
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 国际化重定向
  const locale = request.headers.get('accept-language')?.split(',')[0];
  // ...

  // 添加 header
  const response = NextResponse.next();
  response.headers.set('x-custom', 'value');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

## Route Handlers (API)

```ts
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';
  const posts = await db.post.findMany({ skip: (+page - 1) * 10, take: 10 });
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const post = await db.post.create({ data: body });
  return NextResponse.json(post, { status: 201 });
}

// 动态路由: app/api/posts/[id]/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const post = await db.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}
```

## 部署

```text
Vercel (推荐):
  git push → 自动部署
  Edge Functions / Serverless
  ISR 原生支持

Docker / standalone:
  // next.config.ts
  output: 'standalone'

  // Dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY . .
  RUN npm ci && npm run build

  FROM node:20-alpine AS runner
  WORKDIR /app
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  COPY --from=builder /app/public ./public
  EXPOSE 3000
  CMD ["node", "server.js"]

静态导出:
  // next.config.ts
  output: 'export'
  → 纯静态 HTML (无 SSR/ISR/API Routes)
```

## 常见陷阱

```text
- 'use client' 传染: Client Component 的子组件也是 client → 尽量叶子节点 'use client'
- fetch 缓存默认行为: Next 15 改为 no-store 默认 (之前是 force-cache)
- Server Action 不能返回非序列化对象 (Date/Map/Set → 转换)
- Middleware 运行在 Edge: 不能用 Node.js API (fs/path/crypto 部分)
- 动态路由 + generateStaticParams: 不列出的 slug → 404 (除非 dynamicParams: true)
- next/image: 远程图片需要 remotePatterns 配置
- Parallel Routes: 每个 slot 需要 default.tsx
```

## 实战入口
- **Next.js docs (nextjs.org/docs)** — 官方。
- **Vercel templates** — 起始模板。
- **Lee Robinson blog** — 最佳实践。
- **next-auth (Auth.js)** — 认证。
- **Prisma + Next.js** — 数据库。

## 自检
1. App Router 还是 Pages Router？
2. 渲染策略？(SSR / SSG / ISR / streaming)
3. 需要 Server Actions？
4. 部署目标？(Vercel / Docker / static)
5. 认证方案？
6. 数据库/ORM？

## 相邻技能
- `react-development` — React 基础。
- `ts` — TypeScript。
- `vue` — Vue/Nuxt 替代方案。
- `api-design` — API 设计。