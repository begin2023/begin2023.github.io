---
title: "如何使用 GitHub Pages 搭建免费博客"
date: 2026-01-28
draft: false
summary: "本文将详细介绍如何使用 GitHub Pages 搭建一个完全免费的个人博客，无需购买服务器。"
tags: ["教程", "GitHub"]
---

GitHub Pages 是 GitHub 提供的免费静态网站托管服务，非常适合搭建个人博客。本文将详细介绍如何使用它。

## 什么是 GitHub Pages？

GitHub Pages 是一个静态站点托管服务，它直接从 GitHub 仓库获取 HTML、CSS 和 JavaScript 文件，然后发布为网站。

### 优点

- **完全免费** - 不需要任何费用
- **无需服务器** - GitHub 帮你托管
- **自动部署** - 推送代码即可更新
- **支持自定义域名** - 可以使用自己的域名
- **HTTPS 支持** - 自动提供 SSL 证书

## 快速开始

### 第一步：创建 GitHub 仓库

1. 登录 GitHub
2. 点击右上角的 "+" 号，选择 "New repository"
3. 仓库名称填写 `你的用户名.github.io`
4. 选择 "Public"（公开）
5. 点击 "Create repository"

### 第二步：上传博客文件

```bash
# 克隆仓库到本地
git clone https://github.com/你的用户名/你的用户名.github.io.git

# 进入目录
cd 你的用户名.github.io

# 复制博客文件到这里
# 然后提交并推送
git add .
git commit -m "Initial blog setup"
git push origin main
```

### 第三步：访问你的博客

等待几分钟后，访问 `https://你的用户名.github.io` 即可看到你的博客！

## 使用 Hugo 搭建博客

Hugo 是一个快速的静态网站生成器，配合 GitHub Pages 使用非常方便。

### 安装 Hugo

```bash
# macOS
brew install hugo

# Windows
choco install hugo-extended

# Linux
snap install hugo
```

### 创建站点

```bash
hugo new site my-blog
cd my-blog
```

### 添加主题

```bash
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

### 写文章

```bash
hugo new posts/my-first-post.md
```

## 进阶配置

### 自定义域名

1. 在仓库根目录创建 `CNAME` 文件
2. 文件内容为你的域名，如 `blog.example.com`
3. 在域名服务商处添加 CNAME 记录指向 `你的用户名.github.io`

### 启用 HTTPS

在仓库的 Settings > Pages 中勾选 "Enforce HTTPS"。

## 总结

GitHub Pages 是搭建个人博客的绝佳选择，简单、免费、可靠。希望这篇教程对你有帮助！
