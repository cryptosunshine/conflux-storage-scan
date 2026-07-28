# Cloudflare Workers 部署配置设计

## 背景

Cloudflare Workers Builds 已能执行 `pnpm run build` 并生成 `dist`，但仓库没有
Wrangler 配置，也没有固定 Wrangler 依赖。部署命令因此触发 Wrangler 自动配置，并在
临时安装 Wrangler 时被 pnpm 11 以 `ERR_PNPM_IGNORED_BUILDS` 拒绝执行 `workerd`
安装脚本。

## 方案选择

采用仓库内显式配置：

- 将 Wrangler 固定为开发依赖并写入锁文件；
- 在 `pnpm-workspace.yaml` 中只批准 `workerd` 执行依赖构建脚本；
- 提交 `wrangler.jsonc`，把 Vite 的 `dist` 目录作为静态资源；
- 对 TanStack Router 使用 `single-page-application` 回退，保证公开详情路由直接访问和
  刷新时仍返回 `index.html`。

没有选择仅依赖 Cloudflare 控制台命令行参数，因为该方式仍让部署语义分散在控制台，且本地
无法使用同一份配置做 dry-run。也不迁移到 Cloudflare Pages，因为当前 Workers Builds 已
满足纯静态 SPA 的部署需求，迁移会扩大范围。

## 配置边界

`wrangler.jsonc` 只声明 Worker 名称、兼容日期和静态资源路由，不增加 Worker
服务端入口、运行时变量或写链行为。`VITE_CONFLUX_ESPACE_RPC_URL` 继续作为 Vite
构建变量注入浏览器代码，不写入 Wrangler 的运行时 `vars`。

`pnpm-workspace.yaml` 只允许 `workerd` 的安装脚本，不启用允许所有依赖构建脚本的宽泛
选项。

## 验证

1. 用静态断言复现仓库缺少 Wrangler 配置和固定依赖的失败。
2. 安装固定版本并确认锁文件可在 `--frozen-lockfile` 模式下安装。
3. 运行 Wrangler dry-run，确认 `dist` 被识别为 SPA 静态资源且不会触发自动配置。
4. 运行 `corepack pnpm verify`。
5. 由于 SPA 路由配置会影响公开路由交付，运行 `corepack pnpm test:e2e`。

