# 无后台静态发布方案

宇少，这套方式的核心是：服务器只负责展示网页，不在服务器上跑后台。

你在自己电脑上改内容、构建网站，然后把生成好的 `dist/` 成品上传到 VPS。这样最稳，也最适合小白使用，因为 VPS 上不用长期跑 Node、pnpm 和后台服务。

## 什么时候用这个方案

如果你只是偶尔改文章、日记、动漫/小说记录、相册内容，优先用这个方案。

不要线上后台后，会少掉这些麻烦：

- 后台域名解析
- Caddy 反向代理
- Basic Auth 密码
- Astro dev 常驻进程
- 服务器内存不够导致后台卡死
- 后台服务暴露到公网的安全风险

## 本地改内容

常用内容位置：

| 内容 | 文件位置 |
| --- | --- |
| 文章 | `src/content/posts/` |
| 日记 | `src/content/diary/` |
| 小说记录 | `src/content/novels/` |
| 动漫记录 | `src/content/anime/` |
| 相册 | `src/content/album/` |
| 关于页 | `src/content/spec/about.md` |

新建文章可以用：

```sh
corepack pnpm@9.14.4 new-post my-new-post
```

也可以继续在本地打开新的轻量后台：

```sh
corepack pnpm@9.14.4 admin:start
```

然后访问：

```text
http://127.0.0.1:4310/admin
```

注意：这个后台只在你电脑本地用，不放到公网服务器上。

## 本地生成发布包

在项目目录运行：

```sh
corepack pnpm@9.14.4 release:static
```

成功后会在 `release/` 目录生成类似这样的文件：

```text
homepage-dist-20260607-142000.tgz
```

这个压缩包里面就是可以上线的静态网页成品。

## 上传到服务器

假设服务器网站目录是：

```text
/var/www/homepage/dist
```

先把压缩包上传到服务器：

```sh
scp release/homepage-dist-时间.tgz root@你的服务器IP:/tmp/homepage-dist.tgz
```

然后 SSH 登录服务器：

```sh
ssh root@你的服务器IP
```

在服务器上执行：

```sh
sudo mkdir -p /var/www/homepage/dist
sudo rm -rf /var/www/homepage/dist/*
sudo tar -xzf /tmp/homepage-dist.tgz -C /var/www/homepage/dist
sudo systemctl reload caddy
```

然后访问：

```text
https://blog.yugold.top
```

## Caddy 只保留公开站点

服务器上的 Caddy 配置只需要公开站点这一段：

```caddy
blog.yugold.top {
	root * /var/www/homepage/dist
	encode zstd gzip
	file_server

	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}
}
```

不需要配置 `admin.yugold.top`。

## 如果已经折腾过后台

可以在服务器上关闭新的轻量后台服务：

```sh
sudo systemctl stop homepage-lite-admin
sudo systemctl disable homepage-lite-admin
```

然后 Caddy 用 `deploy/Caddyfile.public.example` 这份公开站配置即可。

## 这不是退步

对个人主页来说，静态发布是更稳的路线。后台适合每天多人协作更新内容的网站；你这个站更像自己的作品集和记录空间，少一个后台，反而少很多服务器维护成本。
