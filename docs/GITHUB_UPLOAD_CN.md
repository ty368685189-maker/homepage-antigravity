# GitHub 上传教程

宇少，这份教程是给你这种情况准备的：

- 项目现在在你本地电脑 `E:\homepage-antigravity`
- 你想先传到 GitHub
- 然后让阿里云服务器自己拉代码

这条路很适合以后反复更新，因为你后面改代码时，不用每次都手动拖文件。

## 一、先理解这条路在干什么

流程其实很简单：

```text
本地项目 -> 上传到 GitHub -> 阿里云服务器 git clone / git pull -> build -> 重启服务
```

你只要先把第一次搞通，后面更新会轻松很多。

## 二、先确认你电脑有没有 Git

在你电脑的 PowerShell 里执行：

```powershell
git --version
```

### 如果能看到版本号

那就说明可以直接继续。

### 如果提示找不到 git

去安装 **Git for Windows**：

- 官网：[Git for Windows](https://gitforwindows.org/)

安装时一路默认基本就行。

装完以后，重新打开 PowerShell，再执行一次：

```powershell
git --version
```

## 三、先在 GitHub 上创建空仓库

登录 GitHub 后，创建一个新的仓库，建议：

- 仓库名：`homepage-antigravity`
- 类型：`Private`

注意：

- **不要勾选** `Add a README file`
- **不要勾选** `.gitignore`
- **不要勾选** `Choose a license`

因为这些文件你本地项目里已经有了。

创建完成后，GitHub 会给你一个仓库地址，通常长这样：

```text
https://github.com/你的用户名/homepage-antigravity.git
```

## 四、第一次把本地项目传到 GitHub

在你电脑 PowerShell 里执行：

```powershell
cd E:\homepage-antigravity
git init
git branch -M main
git add .
git commit -m "init: homepage antigravity"
```

然后把远程仓库地址换成你自己的：

```powershell
git remote add origin https://github.com/你的用户名/homepage-antigravity.git
git push -u origin main
```

### 如果 Git 提示你登录

按它跳出的浏览器流程登录就行。

### 如果提示没有用户名和邮箱

先执行：

```powershell
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub注册邮箱"
```

然后重新执行：

```powershell
git add .
git commit -m "init: homepage antigravity"
git push -u origin main
```

## 五、以后你本地改完代码怎么继续推 GitHub

以后每次改完项目，在本地执行：

```powershell
cd E:\homepage-antigravity
git add .
git commit -m "update: 写这次改了什么"
git push
```

这样 GitHub 上的项目就会更新。

## 六、阿里云服务器第一次从 GitHub 拉项目

如果你已经把服务器上的旧目录备份走了，而且现在 `/var/www/homepage` 是空目录，那可以这样：

```sh
cd /var/www
rm -rf homepage
git clone https://github.com/你的用户名/homepage-antigravity.git homepage
cd /var/www/homepage
```

### 如果你的仓库是 Private

有两种常见做法：

1. 先把仓库临时改成 Public，再拉完改回 Private
2. 在服务器上配置 GitHub 认证

对你现在来说，**第一种更省事**。  
等你以后熟了，再上 SSH Key 或 Token。

## 七、服务器第一次拉完后要做什么

SSH 登录阿里云服务器后执行：

```sh
cd /var/www/homepage
corepack pnpm@9.14.4 install --frozen-lockfile
SITE_URL=https://blog.yugold.top/ corepack pnpm@9.14.4 build
sudo cp /var/www/homepage/deploy/homepage-admin.env.example /etc/homepage-admin.env
sudo cp /var/www/homepage/deploy/homepage-lite-admin.service.example /etc/systemd/system/homepage-lite-admin.service
sudo systemctl daemon-reload
sudo systemctl enable --now homepage-lite-admin
```

然后按主教程继续配置：

- [DEPLOY_CN.md](../DEPLOY_CN.md)

## 八、以后服务器怎么更新到 GitHub 最新代码

如果你本地已经改完并 `git push` 了，服务器执行：

```sh
cd /var/www/homepage
git pull
corepack pnpm@9.14.4 install --frozen-lockfile
SITE_URL=https://blog.yugold.top/ corepack pnpm@9.14.4 build
sudo systemctl restart homepage-lite-admin
sudo systemctl reload caddy
```

## 九、如果你不想先上 GitHub

也没关系。  
这个项目现在已经支持直接打包服务器源码：

```powershell
cd E:\homepage-antigravity
corepack pnpm@9.14.4 release:server
```

打包成功后，会在 `release/` 目录生成类似这样的文件：

```text
homepage-server-src-20260607-180000.tgz
```

这个压缩包就是我帮你准备好的“可上传到服务器”的文件包。

## 十、你该怎么选

如果你现在只想尽快把网站迁上阿里云：

- 先用 `release:server`

如果你想以后维护更省事：

- 走 GitHub 这条路

对你现在这个阶段，我建议：

1. 先把 GitHub 仓库建起来
2. 本地先推一次
3. 服务器再 `git clone`

这样以后改代码会舒服很多。
