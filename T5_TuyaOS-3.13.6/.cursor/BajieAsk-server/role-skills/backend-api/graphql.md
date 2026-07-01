---
name: graphql-development
description: GraphQL API 开发。Schema / Resolver / DataLoader / Federation / Subscription / Pagination / 客户端。配合 api-design / ts / be 用。
---

# GraphQL 开发

## 适用场景
- GraphQL schema 设计与实现。
- Resolver 编写 / N+1 解决。
- Apollo Federation / Supergraph 架构。
- 实时订阅 (Subscription)。
- 客户端集成 (Apollo Client / urql)。

## 不适用
- REST API → `api` / `api-design`。
- API 安全测试 → `apipentest`。
- gRPC → `protrev`。

---

## Schema 设计

```graphql
# Schema-first (SDL)
type Query {
  user(id: ID!): User
  users(first: Int, after: String): UserConnection!
  posts(filter: PostFilter): [Post!]!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updatePost(id: ID!, input: UpdatePostInput!): UpdatePostPayload!
  deletePost(id: ID!): DeletePostPayload!
}

type Subscription {
  postCreated: Post!
  messageReceived(channelId: ID!): Message!
}

type User {
  id: ID!
  name: String!
  email: String!
  posts(first: Int, after: String): PostConnection!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  tags: [Tag!]!
  publishedAt: DateTime
}

# Input types
input CreateUserInput {
  name: String!
  email: String!
  password: String!
}

# Payload pattern (错误处理)
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UserError {
  field: String
  message: String!
  code: ErrorCode!
}

# Relay-style pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Custom scalars
scalar DateTime
scalar JSON
scalar Upload
```

## Resolver & DataLoader

```ts
// Apollo Server / Yoga resolver
const resolvers = {
  Query: {
    user: async (_, { id }, ctx) => {
      return ctx.dataloaders.user.load(id);
    },
    users: async (_, { first, after }, ctx) => {
      return ctx.db.user.paginate({ first, after });
    },
  },
  User: {
    // Field resolver: 解决 N+1
    posts: async (user, { first, after }, ctx) => {
      return ctx.dataloaders.userPosts.load({ userId: user.id, first, after });
    },
  },
  Mutation: {
    createUser: async (_, { input }, ctx) => {
      try {
        const user = await ctx.db.user.create(input);
        return { user, errors: [] };
      } catch (e) {
        return { user: null, errors: [{ message: e.message, code: 'INVALID_INPUT' }] };
      }
    },
  },
};

// DataLoader (批量加载, 解决 N+1)
import DataLoader from 'dataloader';

function createLoaders(db) {
  return {
    user: new DataLoader(async (ids: string[]) => {
      const users = await db.user.findMany({ where: { id: { in: ids } } });
      // 必须按 ids 顺序返回!
      return ids.map(id => users.find(u => u.id === id) || null);
    }),
    userPosts: new DataLoader(async (keys) => {
      const userIds = keys.map(k => k.userId);
      const posts = await db.post.findMany({ where: { authorId: { in: userIds } } });
      return keys.map(k => posts.filter(p => p.authorId === k.userId));
    }),
  };
}
```

## Apollo Federation

```graphql
# Users subgraph
type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
}

type Query {
  user(id: ID!): User
}

# Posts subgraph
type Post @key(fields: "id") {
  id: ID!
  title: String!
  author: User!  # 引用外部类型
}

extend type User @key(fields: "id") {
  id: ID! @external
  posts: [Post!]!  # 扩展 User 类型
}

# Router (Apollo Router / Apollo Gateway)
# 自动组合多个 subgraph → 统一 schema
```

## 认证 / 授权

```ts
// Context 注入用户
const server = new ApolloServer({
  typeDefs, resolvers,
  context: async ({ req }) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? await verifyToken(token) : null;
    return { user, db, dataloaders: createLoaders(db) };
  },
});

// Directive-based 授权
// schema:
// directive @auth(requires: Role!) on FIELD_DEFINITION
// type Query { adminData: String @auth(requires: ADMIN) }

// 或 middleware pattern (graphql-shield):
import { shield, rule, allow } from 'graphql-shield';
const isAuthenticated = rule()(async (parent, args, ctx) => !!ctx.user);
const isAdmin = rule()(async (parent, args, ctx) => ctx.user?.role === 'ADMIN');
const permissions = shield({
  Query: { '*': isAuthenticated, publicData: allow },
  Mutation: { deleteUser: isAdmin },
});
```

## 客户端

```ts
// Apollo Client (React)
import { ApolloClient, InMemoryCache, gql, useQuery, useMutation } from '@apollo/client';

const client = new ApolloClient({
  uri: '/graphql',
  cache: new InMemoryCache(),
});

// Hook
const GET_POSTS = gql`query GetPosts($first: Int!) { posts(first: $first) { id title } }`;
function Posts() {
  const { data, loading, error } = useQuery(GET_POSTS, { variables: { first: 10 } });
  if (loading) return <p>Loading...</p>;
  return data.posts.map(p => <div key={p.id}>{p.title}</div>);
}

// Mutation
const CREATE_POST = gql`mutation($input: CreatePostInput!) { createPost(input: $input) { post { id } errors { message } } }`;
const [createPost, { loading }] = useMutation(CREATE_POST, {
  refetchQueries: ['GetPosts'],  // 或 update cache
});

// codegen (自动生成类型)
// graphql-codegen → 从 schema + operations 生成 TypeScript types + hooks
```

## 常见陷阱

```text
- N+1: 必须用 DataLoader，否则嵌套查询性能灾难
- Query depth: 不限制深度 → DoS (用 graphql-depth-limit)
- Introspection: 生产环境关闭 (防信息泄漏)
- Over-fetching mutation: 返回整个对象而不是只改变的字段
- Circular references: A→B→A 可能无限递归 → DataLoader + 深度限制
- 缓存: GraphQL POST 不走 HTTP cache → 用 persisted queries (APQ)
- File upload: 标准 GraphQL 不支持 → graphql-upload 或 presigned URL
```

## 实战入口
- **Apollo docs** — apollographql.com/docs。
- **GraphQL Yoga (The Guild)** — 轻量 server。
- **Pothos / Nexus** — code-first schema。
- **graphql-codegen** — 类型生成。
- **Relay** — Facebook 客户端规范。

## 自检
1. Schema-first 还是 code-first？
2. 需要 Federation？(多服务)
3. 实时？(Subscription)
4. N+1 解决？(DataLoader)
5. 客户端？(Apollo / urql / Relay)
6. 认证方案？

## 相邻技能
- `api-design` — API 设计原则。
- `ts` — TypeScript。
- `be` — 后端。
- `react-development` / `nextdev` — 前端集成。