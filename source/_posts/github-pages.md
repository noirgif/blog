---
title: 如何被 GitHub Pages 蹬鼻子上脸
date: 2018-11-01 06:18:55
lang: zh-cn
tags:
    - blog
---

## 被什么蹬鼻子上脸？

[GitHub Pages](pages.github.com) 是 GitHub 不知道在哪一年推出的网站托管服务。用户将网站内容放在一个 GitHub 仓库中（无论仓库是公共还是私有的），然后喝口水的功夫，网站就建立起来了。

GitHub Pages 有如下几个好处：

0. 不要钱（以这种寒酸网站为基准）
1. 方便，一键部署，一键 TLS
2. 使用 GitHub CDN，不容易炸
3. 炸了也是 GitHub 背锅

用户可以通过如下的几种方式部署 GitHub Pages：

1. 使用名为 `<username/org name>.github.io` 的仓库作为网站的根目录 (webroot)
2. 使用一个仓库的 `master` 或 `gh-pages` 分支作为网站的根目录
3. 使用一个仓库的 `master` 分支的 `docs/` 文件夹作为网站的根目录

在方式 1 下，默认可以通过`<username/org name>.github.io` 访问建立的网站；而在方式 2 和 3 下，默认通过 `<username/org name>.github.io/<repo name>` 进行访问。

除了给定的域名，GitHub Pages 还提供了自定义域名的选项，支持 `example.com` 和 `www.example.com` 形式的域名。具体看 wiki 。

## 被 GitHub Pages 怎么上脸？

通常来说，建一个博客需要如下几个部分：

1. IP
2. 域名
3. 服务器
4. 内容

使用网页托管服务，相当于用户交出了对服务器的完全控制，这有其两面性：用户可以不管什么阿帕奇，什么引擎X，但用户在服务器层面上能有多大的自由，完全取决于托管服务商的支持。

在 GitHub Pages 为例，用户失去了：

1. HTTP redirect 的能力，具体来说，用户只能用一个 meta 标签做重定向，而不是返回 HTTP 301/302 进行重定向。
2. 个性化错误页面，只能按照 GitHub Pages 的要求指定一个网页作为 404 页面（虽然大多情况下这就够了）。

## 你说的我都明白，所以这又怎么了？

<del>其实没怎么。</del>

由于[上一篇博客](/posts/multilanguage)中做的修改，现在的 RSS 变成了一个到中文 RSS Feed 的 HTTP 重定向。用 GitHub Pages 会使得无法重定向，导致 RSS 订阅会掉。

另外一个没有提及的问题是 GitHub Pages 的罪恶连锁：

> 不使用 <username>.github.io -> 自定义域名不能使用 CNAME -> 自定义域名使用 A 记录 -> 每次部署的时候报警

以及

> 不使用 <username>.github.io -> 自定义域名不能使用 CNAME -> 自定义域名使用 A 记录 -> 随机 302

其中第二个问题是由于 GitHub 方面需要平衡负载而导致的。

## 下一步？

再说。