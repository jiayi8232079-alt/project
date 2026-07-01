---
name: svelte-sveltekit-development
description: Svelte 5 / SvelteKit 全栈开发。Runes / load / form actions / hooks / adapter / SSR / 编译时框架。配合 ts / jsts 用。
---

# Svelte / SvelteKit 开发

## 适用场景
- Svelte 5 组件开发。
- SvelteKit 全栈应用。
- 从 Svelte 4 stores 迁移到 runes。
- SSR / 预渲染 / CSR 配置。

## 不适用
- React → `react-development` / `nextdev`。
- Vue → `vue`。

---

## Svelte 5 Runes

```svelte
<script lang="ts">
  // $state: 响应式状态
  let count = $state(0);
  let user = $state({ name: 'Alice', age: 30 });

  // $derived: 计算值 (替代 $: reactive statements)
  let doubled = $derived(count * 2);
  let fullName = $derived.by(() => {
    return `${user.name} (${user.age})`;
  });

  // $effect: 副作用 (替代 onMount + reactive)
  $effect(() => {
    console.log(`count changed to ${count}`);
    // cleanup (可选):
    return () => console.log('cleanup');
  });

  // $props: 组件 props (替代 export let)
  let { title, description = 'default' } = $props();

  // $bindable: 可双向绑定的 prop
  let { value = $bindable(0) } = $props();

  function increment() { count++; }
</script>

<button onclick={increment}>{count} (doubled: {doubled})</button>
```

## SvelteKit 路由

```text
src/
├── routes/
│   ├── +layout.svelte           根 Layout
│   ├── +layout.server.ts        根 Layout 数据
│   ├── +page.svelte             首页 (/)
│   ├── +page.server.ts          首页数据 + actions
│   ├── +error.svelte            错误页
│   ├── about/
│   │   └── +page.svelte         /about
│   ├── blog/
│   │   ├── +page.svelte         /blog
│   │   ├── +page.server.ts      load function
│   │   └── [slug]/
│   │       ├── +page.svelte     /blog/:slug
│   │       └── +page.server.ts
│   └── api/
│       └── posts/
│           └── +server.ts       API endpoint
├── lib/                         $lib 别名
├── app.html                     HTML 模板
└── hooks.server.ts              Server hooks
```

## Load Functions

```ts
// src/routes/blog/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, cookies, locals }) => {
  const res = await fetch('/api/posts');
  const posts = await res.json();
  return { posts };  // 传给 +page.svelte 的 data prop
};

// 在 +page.svelte 中使用:
// <script lang="ts">
//   let { data } = $props();  // Svelte 5
//   // data.posts 可用
// </script>

// +page.ts (通用 load, 同时运行在 server 和 client)
import type { PageLoad } from './$types';
export const load: PageLoad = async ({ fetch, data }) => {
  // data = 来自 +page.server.ts 的数据
  return { ...data, extra: 'client-side' };
};
```

## Form Actions

```ts
// src/routes/login/+page.server.ts
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return fail(400, { email, missing: true });
    }

    const user = await authenticate(email, password);
    if (!user) {
      return fail(401, { email, incorrect: true });
    }

    cookies.set('session', user.token, { path: '/' });
    throw redirect(303, '/dashboard');
  },

  // 命名 action:
  register: async ({ request }) => {
    // ...
  }
};
```

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();  // action 返回的数据
</script>

<form method="POST" use:enhance>
  <input name="email" value={form?.email ?? ''} />
  <input name="password" type="password" />
  {#if form?.missing}<p>Fill all fields</p>{/if}
  {#if form?.incorrect}<p>Wrong credentials</p>{/if}
  <button>Login</button>
</form>

<!-- 命名 action: -->
<form method="POST" action="?/register" use:enhance>
```

## Hooks

```ts
// src/hooks.server.ts
import type { Handle, HandleFetch } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // 每个请求都经过这里
  const session = event.cookies.get('session');
  if (session) {
    event.locals.user = await getUserFromSession(session);
  }

  const response = await resolve(event);
  response.headers.set('x-custom', 'value');
  return response;
};

export const handleFetch: HandleFetch = async ({ request, fetch }) => {
  // 修改 server-side fetch
  if (request.url.startsWith('https://api.internal/')) {
    request.headers.set('Authorization', `Bearer ${API_KEY}`);
  }
  return fetch(request);
};
```

## Adapters & 部署

```text
adapter-auto:       自动检测平台 (Vercel/Netlify/Cloudflare)
adapter-node:       Node.js server (Docker/VPS)
adapter-static:     纯静态生成
adapter-vercel:     Vercel (Edge/Serverless)
adapter-cloudflare: Cloudflare Pages/Workers

// svelte.config.js
import adapter from '@sveltejs/adapter-node';
export default {
  kit: {
    adapter: adapter({ out: 'build' })
  }
};

// 预渲染 (SSG per page)
// +page.ts
export const prerender = true;

// 关闭 SSR (SPA mode per page)
// +page.ts
export const ssr = false;
```

## Svelte 4 → 5 迁移

```text
旧 (Svelte 4)          →  新 (Svelte 5)
─────────────────────────────────────────
export let prop         →  let { prop } = $props()
$: derived = x * 2     →  let derived = $derived(x * 2)
$: { sideEffect() }    →  $effect(() => { sideEffect() })
writable(0)            →  $state(0)  (组件内)
                           可保留 stores 跨组件共享
on:click={handler}      →  onclick={handler}
<slot />               →  {@render children()}
```

## 实战入口
- **svelte.dev / kit.svelte.dev** — 官方文档。
- **learn.svelte.dev** — 交互教程。
- **Superforms** — 表单增强。
- **Lucia** — 认证。
- **Paraglide** — i18n。

## 自检
1. Svelte 5 还是 4？
2. SvelteKit 还是纯 Svelte？
3. 渲染策略？(SSR / prerender / CSR)
4. 部署目标？(adapter)
5. 需要表单/认证？

## 相邻技能
- `ts` — TypeScript。
- `react-development` / `nextdev` — 替代方案。
- `vue` — 替代方案。