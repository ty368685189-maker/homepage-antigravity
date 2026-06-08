# Homepage Antigravity

基于 Astro、Svelte、Tailwind CSS 和 Fuwari 改造的个人主页/博客站点。项目以静态构建为主，支持文章归档、RSS、站点地图、Pagefind 搜索、暗色模式，以及新的轻量内容后台。

## 本地开发

建议使用 Node.js 20 或更新版本，并通过 Corepack 使用项目锁定的 pnpm 版本。

```sh
corepack pnpm@9.14.4 install
corepack pnpm@9.14.4 dev
```

开发服务器默认运行在 `http://127.0.0.1:4322`。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `corepack pnpm@9.14.4 dev` | 启动本地开发服务器 |
| `corepack pnpm@9.14.4 build` | 构建静态站点并生成 Pagefind 索引 |
| `corepack pnpm@9.14.4 deploy:static` | 本地构建并演练安全静态部署，不上传服务器 |
| `corepack pnpm@9.14.4 deploy:static -- --apply` | 本地构建后上传静态包，备份线上 `dist/` 再覆盖 |
| `corepack pnpm@9.14.4 release:static` | 构建并打包可上传到 VPS 的静态站点 |
| `corepack pnpm@9.14.4 release:server` | 打包可上传到 VPS 的整套服务器源码 |
| `corepack pnpm@9.14.4 preview` | 预览 `dist/` 构建结果 |
| `corepack pnpm@9.14.4 check` | 运行 Astro 诊断 |
| `corepack pnpm@9.14.4 type-check` | 运行 TypeScript 检查 |
| `corepack pnpm@9.14.4 lint` | 运行 Biome 检查 |
| `corepack pnpm@9.14.4 lint:fix` | 自动修复 Biome 可修复问题 |
| `corepack pnpm@9.14.4 format` | 格式化 `src/` |
| `corepack pnpm@9.14.4 new-post <filename>` | 创建新文章 |

## 内容编辑

文章位于 `src/content/posts/`。可以直接编辑 Markdown，也可以启动轻量后台管理内容。

如果你想要长期稳定的线上后台，推荐使用仓库里的轻量后台服务：

```sh
corepack pnpm@9.14.4 admin:start
```

默认访问地址：

```text
http://127.0.0.1:4310/admin
```

它会提供登录、内容编辑、图片上传和一键发布能力，直接操作当前仓库里的 Markdown / YAML 文件。

## 部署

项目输出目录为 `dist/`，适合部署到 Cloudflare Pages、Vercel、Netlify 或静态服务器。

日常改首页、导航、样式和文章时，优先使用安全静态部署脚本。它只在本地构建，把 `dist/` 打包上传到服务器；服务器只会备份并覆盖 Caddy 指向的静态目录，不会在 VPS 上安装依赖、构建项目或重启服务。

先演练，不上传：

```sh
HOMEPAGE_DEPLOY_HOST=your-server-ip corepack pnpm@9.14.4 deploy:static
```

Windows PowerShell 写法：

```powershell
$env:HOMEPAGE_DEPLOY_HOST = "your-server-ip"
corepack pnpm@9.14.4 deploy:static
```

确认没问题再真正上线：

```sh
HOMEPAGE_DEPLOY_HOST=your-server-ip corepack pnpm@9.14.4 deploy:static -- --apply
```

Windows PowerShell 写法：

```powershell
$env:HOMEPAGE_DEPLOY_HOST = "your-server-ip"
corepack pnpm@9.14.4 deploy:static -- --apply
```

脚本不会保存服务器密码；真正上传时由系统 SSH / SCP 提示输入密码或使用你本机已有的 SSH key。

部署前建议设置真实站点地址：

```sh
SITE_URL=https://your-domain.com/ corepack pnpm@9.14.4 build
```

也可以在部署平台的环境变量中设置 `SITE_URL`。如果没有设置，开发 fallback 为 `http://localhost:4322/`。

中文部署说明见 [DEPLOY_CN.md](./DEPLOY_CN.md)。

如果你想先把项目传到 GitHub，再让阿里云服务器拉代码，见 [docs/GITHUB_UPLOAD_CN.md](./docs/GITHUB_UPLOAD_CN.md)。

如果不想折腾线上后台，推荐使用无后台静态发布方案，见 [docs/STATIC_PUBLISH_CN.md](./docs/STATIC_PUBLISH_CN.md)。

如果要把轻量后台上线到阿里云 VPS，直接看 [DEPLOY_CN.md](./DEPLOY_CN.md)。


## 质量检查

提交或部署前建议至少运行：

```sh
corepack pnpm@9.14.4 check
corepack pnpm@9.14.4 type-check
corepack pnpm@9.14.4 lint
corepack pnpm@9.14.4 build
```

## License

MIT
