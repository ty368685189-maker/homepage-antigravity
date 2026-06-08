# 阿里云迁移教程

宇少，这一版教程专门按你现在的真实情况写：

- 你以前已经在阿里云上成功上线过网站
- 现在不是从零装一台新服务器
- 而是把这套新项目和新后台迁移上去
- 域名还在备案中，但你自己的电脑已经可以测试

这次我们只做和这个项目有关的替换，不去瞎动整台服务器。

## 零、现在日常更新先看这里

如果网站已经能正常访问，只是改首页、导航、样式、文章、图片这些内容，**不要在服务器上构建项目**，也不要重新安装依赖。

日常更新只走安全静态部署：

```powershell
cd E:\homepage-antigravity
$env:HOMEPAGE_DEPLOY_HOST = "your-server-ip"
corepack pnpm@9.14.4 deploy:static
```

上面这条只是演练，不上传服务器。确认输出没问题后，再真正上线：

```powershell
corepack pnpm@9.14.4 deploy:static -- --apply
```

这个脚本只做这几件事：

- 本地构建并打包 `dist/`
- 服务器上自动读取 Caddy 当前指向的静态目录
- 先备份线上 `dist/`
- 清空旧静态文件并解压新静态文件，避免旧哈希资源残留
- 做一次线上访问检查

它不会在 VPS 上执行 `pnpm install`，不会在 VPS 上执行 `pnpm build`，也不会重启 Caddy 或后台服务。

下面从第一节开始，是“首次迁移、重装后台、重配服务器”才需要看的完整教程。日常小改优先不要走下面的源码部署流程。

## 一、这次最终要跑成什么样

迁移完成后，服务器会是这个结构：

```text
blog.yugold.top   -> 公开博客前台 -> /var/www/homepage/dist
admin.yugold.top  -> 轻量后台     -> 127.0.0.1:4310
```

也就是说：

- 前台是静态站点
- 后台是一个很轻的 Node 服务
- 不再使用最开始那个容易把服务器拖慢的旧开发模式后台

## 二、这次不要做的事

你这次不要上来就做这些：

- 不要重装系统
- 不要重配整台服务器
- 不要把以前能用的东西全删掉
- 不要先急着重装 Nginx / Caddy / Node

先检查，先备份，再替换项目。

## 三、先确认服务器现在是谁在管网站

SSH 登录你的阿里云服务器后，先执行：

```sh
sudo systemctl status caddy --no-pager
sudo systemctl status nginx --no-pager
node -v
```

你只需要看三件事：

1. `caddy` 是不是正在运行
2. `nginx` 是不是正在运行
3. 服务器上有没有 Node.js

### 你怎么判断

- 如果 `caddy` 是 `active (running)`，说明你现在大概率在用 Caddy
- 如果 `nginx` 是 `active (running)`，说明你现在大概率在用 Nginx
- 如果两个都不是运行中，那就说明以前的网站可能不是靠 systemd 这套在跑

这份仓库已经给你准备好了 **Caddy 配置示例**，所以最顺手的情况是你现在就在用 Caddy。

## 四、先做备份，别硬改

先备份你现在服务器上和网站有关的东西。

### 1. 备份当前站点目录

如果你当前旧项目目录正好也叫 `/var/www/homepage`，先备份：

```sh
sudo mv /var/www/homepage /var/www/homepage.backup-$(date +%Y%m%d-%H%M%S)
sudo mkdir -p /var/www/homepage
sudo chown -R $USER:$USER /var/www/homepage
```

如果你原来的网站不在这个目录，就不用动原目录，只需要记住旧目录位置。

### 2. 备份 Caddy 配置

如果你正在用 Caddy：

```sh
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
```

### 3. 备份后台环境变量

如果你之前已经折腾过这个项目，顺手备份一下：

```sh
sudo cp /etc/homepage-admin.env /etc/homepage-admin.env.backup-$(date +%Y%m%d-%H%M%S)
```

如果这条命令提示文件不存在，可以直接跳过。

## 五、首次迁移时，上传到服务器推荐你用哪种方式

注意：这一节只适合首次迁移、服务器目录损坏、后台服务需要重装这些情况。  
如果只是日常改网页内容，用最上面的 `deploy:static`。

你现在有两种上传方式：

### 方式 A：直接上传打包好的服务器源码

这是首次迁移时比较省脑子的方式，我也已经把命令给你准备好了。

你在本地 PowerShell 执行：

```powershell
cd E:\homepage-antigravity
corepack pnpm@9.14.4 release:server
```

成功后，会在本地 `release/` 目录生成一个压缩包，名字类似：

```text
homepage-server-src-20260607-180000.tgz
```

这个压缩包里已经是我帮你筛好的“该上传到服务器的文件”：

- `src`
- `public`
- `admin-server`
- `deploy`
- `scripts`
- `docs`
- `package.json`
- `pnpm-lock.yaml`
- `astro.config.mjs`
- 其他项目必需配置文件

里面不会包含这些本地垃圾：

- `node_modules`
- `dist`
- `.astro`
- `scratch`
- 本地日志
- `.env`

### 方式 B：先上传到 GitHub，再让服务器拉代码

如果你想以后维护轻松一些，这条路更适合长期使用。

对应教程在这里：

- [docs/GITHUB_UPLOAD_CN.md](./docs/GITHUB_UPLOAD_CN.md)

如果你现在只是想先尽快把网站迁上去，建议先用 **方式 A**。

## 六、方式 A：直接把源码压缩包上传到服务器

先在服务器确保目标目录存在：

```sh
sudo mkdir -p /var/www/homepage
sudo chown -R $USER:$USER /var/www/homepage
```

然后把你本地 `release/` 目录里的 `homepage-server-src-时间.tgz` 上传到服务器，比如传到：

```text
/tmp/homepage-server-src.tgz
```

上传完成后，SSH 登录服务器执行：

```sh
cd /var/www/homepage
tar -xzf /tmp/homepage-server-src.tgz -C /var/www/homepage
ls
```

你至少应该能看到这些：

```text
package.json
pnpm-lock.yaml
src
public
admin-server
deploy
```

## 七、方式 B：如果你要走 GitHub

如果你决定走 GitHub，不需要手动拖文件到服务器。  
你直接看这份教程：

- [docs/GITHUB_UPLOAD_CN.md](./docs/GITHUB_UPLOAD_CN.md)

核心流程是：

```text
本地项目 -> push 到 GitHub -> 阿里云服务器 git clone / git pull
```

## 八、如果服务器早就装过 Node，就别重复折腾

先检查版本：

```sh
node -v
corepack --version
```

### 可以直接继续的情况

如果：

- `node -v` 能正常输出
- Node 版本是 20 或更高
- `corepack --version` 也能输出

那你就不用重装 Node。

### 只有缺了才安装

如果服务器没有 Node，或者版本太老，再执行：

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
node -v
corepack --version
```

## 九、安装项目依赖

进入项目目录：

```sh
cd /var/www/homepage
```

执行：

```sh
corepack pnpm@9.14.4 install --frozen-lockfile
```

## 十、首次迁移时先构建前台

这一节只适合首次迁移或服务器目录重建。日常更新不要在这里构建，回到最上面的 `deploy:static`。  
首次迁移时执行：

```sh
cd /var/www/homepage
SITE_URL=https://blog.yugold.top/ corepack pnpm@9.14.4 build
```

构建成功后，前台成品会在：

```text
/var/www/homepage/dist
```

## 十一、配置新的轻量后台

这一步是关键。

复制环境变量模板：

```sh
sudo cp /var/www/homepage/deploy/homepage-admin.env.example /etc/homepage-admin.env
sudo nano /etc/homepage-admin.env
```

改成这样：

```ini
ADMIN_HOST=127.0.0.1
ADMIN_PORT=4310
ADMIN_BASE_PATH=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你自己的强密码
ADMIN_SECURE_COOKIE=true
SITE_URL=https://blog.yugold.top/
```

注意两点：

1. `ADMIN_BASE_PATH=` 这里必须留空  
   因为你现在后台是 `admin.yugold.top`，不是 `blog.yugold.top/admin`

2. `SITE_URL=https://blog.yugold.top/`  
   这里要写你的前台正式地址

## 十二、把后台注册成系统服务

执行：

```sh
sudo cp /var/www/homepage/deploy/homepage-lite-admin.service.example /etc/systemd/system/homepage-lite-admin.service
sudo systemctl daemon-reload
sudo systemctl enable --now homepage-lite-admin
```

查看状态：

```sh
sudo systemctl status homepage-lite-admin --no-pager
```

看日志：

```sh
sudo journalctl -u homepage-lite-admin -n 100 --no-pager
```

如果这里是正常运行，说明后台已经在本机 `127.0.0.1:4310` 跑起来了。

## 十三、如果你原来就在用 Caddy，直接改 Caddy 就行

这套项目已经给你准备好了配置示例：

```text
deploy/Caddyfile.aliyun-blog-admin.example
```

先打开看看：

```sh
cat /var/www/homepage/deploy/Caddyfile.aliyun-blog-admin.example
```

### 最稳的改法

如果你的 `/etc/caddy/Caddyfile` 里还有别的网站，不要直接整份覆盖。  
你应该：

1. 打开现有 Caddyfile
2. 找到旧的 `blog.yugold.top` / `admin.yugold.top` 配置
3. 只替换这两个站点对应的配置块

打开现有配置：

```sh
sudo nano /etc/caddy/Caddyfile
```

把和这两个域名有关的内容改成下面这样：

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

admin.yugold.top {
	encode zstd gzip

	basic_auth {
		admin HASHED_PASSWORD
	}

	reverse_proxy 127.0.0.1:4310
}
```

### 后台外层密码怎么生成

执行：

```sh
caddy hash-password
```

把输出结果替换掉：

```text
HASHED_PASSWORD
```

### 检查并重载

```sh
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 十四、如果服务器上还没有 Caddy，再装

只有当你确认服务器上没有 Caddy，而且你决定这次用 Caddy 时，才执行下面这段：

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
sudo systemctl enable --now caddy
```

然后再回去做上一节的配置。

## 十五、备案中怎么自己先测试

因为你的域名还在备案中，所以这阶段目标不是“所有人都能访问”，而是：

- 服务器先部署好
- 你自己的电脑先能正常访问

你先测这两个地址：

```text
https://blog.yugold.top
https://admin.yugold.top
```

如果你自己电脑已经能访问域名，那直接测试就行。

如果后面访问不稳定，可以在你自己电脑临时加 `hosts`：

Windows 路径一般是：

```text
C:\Windows\System32\drivers\etc\hosts
```

加入：

```text
你的阿里云公网IP blog.yugold.top
你的阿里云公网IP admin.yugold.top
```

这样只有你自己电脑会强制走这个 IP，适合备案期间自测。

## 十六、后台为什么会有两层登录

你打开：

```text
https://admin.yugold.top
```

会先后经过：

1. Caddy Basic Auth
2. 后台自己的登录页

这不是多余，是故意这样做的。  
因为后台是公网入口，两层保护更稳。

## 十七、以后更新内容怎么做

以后你改内容，不需要再手动改服务器文件。

你的日常流程会是：

1. 打开 `https://admin.yugold.top`
2. 登录
3. 编辑文章、日记、小说、动漫、相册、关于页
4. 上传图片
5. 点发布

发布成功后，前台 `blog.yugold.top` 就会更新。

## 十八、以后如果是改代码，不是改内容

如果你改的是前台页面、导航、样式、文章结构这些代码，也优先走本地安全静态部署。  
不要在 VPS 上构建项目。

本地 PowerShell：

```powershell
cd E:\homepage-antigravity
$env:HOMEPAGE_DEPLOY_HOST = "your-server-ip"
corepack pnpm@9.14.4 deploy:static
corepack pnpm@9.14.4 deploy:static -- --apply
```

只有当你改的是 `admin-server/` 后台服务代码、systemd 服务、Caddy 配置这些服务器组件时，才需要看首次迁移或服务维护流程。

## 十九、出问题先查哪里

### 1. 前台打不开

```sh
sudo systemctl status caddy --no-pager
sudo caddy validate --config /etc/caddy/Caddyfile
```

### 2. 后台打不开

```sh
sudo systemctl status homepage-lite-admin --no-pager
sudo journalctl -u homepage-lite-admin -n 100 --no-pager
```

### 3. 后台能打开，但点发布失败

先不要反复点发布，也不要在服务器上手动构建。先看后台日志：

```sh
sudo journalctl -u homepage-lite-admin -n 100 --no-pager
```

如果只是想尽快让前台更新，先回到本地执行 `deploy:static`，确认本地构建能过，再静态上线。

## 二十、日常更新最适合的执行顺序

你就照这个顺序走，最不容易乱：

1. 本地改代码或内容
2. 本地执行 `corepack pnpm@9.14.4 deploy:static`
3. 看输出确认只是演练，没有上传
4. 确认没问题后执行 `corepack pnpm@9.14.4 deploy:static -- --apply`
5. 打开 `blog.yugold.top` 检查页面

## 二十一、首次迁移或重装才用的执行顺序

只有服务器目录坏了、后台服务要重装、Caddy 要重配时，才照这个顺序走：

1. SSH 登录阿里云服务器
2. 看 `caddy` / `nginx` / `node` 当前状态
3. 备份旧站点目录和旧配置
4. 在本地执行 `corepack pnpm@9.14.4 release:server`
5. 把源码压缩包上传到服务器并解压到 `/var/www/homepage`
6. 执行 `pnpm install`
7. 执行 `pnpm build`
8. 配 `/etc/homepage-admin.env`
9. 启动 `homepage-lite-admin`
10. 修改 `/etc/caddy/Caddyfile`
11. 在你自己电脑先测试 `blog.yugold.top` 和 `admin.yugold.top`

## 二十二、你现在手里已经准备好的文件

这几个文件就是我已经给你备好的：

- 教程：`DEPLOY_CN.md`
- Caddy 配置示例：`deploy/Caddyfile.aliyun-blog-admin.example`
- 后台环境变量模板：`deploy/homepage-admin.env.example`
- 后台服务模板：`deploy/homepage-lite-admin.service.example`
- GitHub 上传教程：`docs/GITHUB_UPLOAD_CN.md`

你现在不用自己再猜配置，直接按这套做就行。
