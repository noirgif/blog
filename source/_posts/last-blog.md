---
title: 最后的博客
date: 2023-04-02 20:18:11
tags:
    - hexo
    - blog
category:
    - writing
lang: zh-cn
---

在写这篇文章之前，我折腾了一下午的npm。改了依赖，扔了失修已久的`multilingual feed`，为了解决一个错误听ChatGPT的话改了tranquilpeak主题一通，最后告诉我只要把`strip-indent`的版本改回3.0.0就行了。现在这个时间点再运行`npm audit`，应该是0漏洞了。

这个博客从设立起到现在也快6个年头了。所以我想回忆一下这些年是怎么一路折腾来的。然后再谈谈这个博客的未来。

## 心路旅程

### 域名

域名的问题，当时noir.moe和noire.moe都不知被谁注册了，所以一开始是noirina.moe，反正Noirina也是Noire。后来追求短，就变成了现在的nir.moe。现在noir.moe没有人注册，欢迎去买，noire.moe不可用，但是也不知道注册的人拿来在干啥——不用不如捐给我。

除了这个之外，我还注册过一段时间什么.me，大概是用的本名，解析到Blogger去。反正那个Blogger也没写什么东西，就没续费了。

我忘了，很久很久以前，其实是nomamama.top和nomamama.xyz。Nomamama是我名字的一个anagram（之后才发现不仅把w改成了m，还把一个u改成了a）结合Segagaga得来的。现在用的Noirgif是另一个anagram，这个是先弄成日语罗马字然后再变来的。跑题了。在西部数码注册的域名，虽然很便宜（记得年费是个位数）但是后来要求备案，不备案就不给解析，于是这个域名就送他们了。

### 服务器

一开始是在12美元一年的Ethernet Servers，搞个Nginx挂着（首要用途还是开VPN），然后是HostMyBytes。

这个博客的图片基本是传在Cloudinary上的。我需要先上传到那边，拿到URL再贴到这边。这大概是用VPS时候留下来的了。现在想想，其实图片也可以直接推到GitHub上。

用VPS的时候还想着用Cloudflare怎么加速——结果发现一用VPN就不好使了。但是现在就没有必要了，name server还是用的Cloudflare，也是当时留下来的。

在2018年底的时候，我同时也部署到VPS和Github Pages上了（见[如何被 GitHub Pages 蹬鼻子上脸](/posts/github-pages)。其实单用Github Pages也可以——访问[noirgif.github.io](noirgif.github.io)就是走的pages，但是我闲得慌，为了一点现在已经没用的功能，而搞了Netlify。

HostMyBytes在19年4月被Alpharacks收购，我在那个时候改用CircleCI跑Hexo，然后CircleCI部署到专用的分支。没用Travis CI的原因，印象里是因为它的镜像太旧了还是机子太破了，还是两者皆有？当时也没人教我，只好自己试着搞来搞去，搞成现在这个模样。

6月份那个VPS连不上，随后Alpharacks倒闭的消息传来，干脆就不要自己搭的Nginx，只推到Github上了事。从此这个博客只有域名是要钱的了，我觉得这是这个博客的顶峰。

半年后有了Github Actions。求你下次早点来。

## Hexo

在用Hexo之前我实在想不起来用的什么。大概是没有吧。用Hexo的起点大概是周围的人很多当时在用Hexo。印象很深的三个：

1. [老涡的博客](https://xuanwo.io)：后来改用了Hugo。
2. [苏卡卡的博客](https://blog.skk.moe/)：不仅还在用，还自己折腾了很多，学不来。
3. 没有第三个了。[老肯](https://blog.yoitsu.moe)和[老fc](https://farseerfc.me/)用的都是Pelican。

喜欢的地方：主题很花哨。当时想着搞很多花哨东西，所以用了这个主题。现在没这个想法了。

有好有坏的地方：写作体验。用自己想用的编辑器，写Markdown固然简单，但是我有一个一直梦寐以求的功能：把图片拖进来，就能帮你上传到CDN，然后在博客里给你一个链接。我在Piazza用这个的时候就想着博客能不能有一个。Notion也会把文件上传到S3，不过Notion的数据可能都在S3。Hexo有一个Cloudinary插件，但是做的是你写一个tag，帮你插入Cloudinary上的图片，这种画蛇添足的事情。

头疼的地方：NodeJS加持的Hexo有很多插件，容易发生有的包没人维护了，这个没人维护的包的依赖有漏洞这种深奥的事情。按照这个部署的流程来说我是不需要管他们的？不是很清楚。但是想本地看一看效果的时候就很麻烦。今天我为此把multilingual feed删掉了。从此这个博客更新不分语言了：明天是英语，后天是日语。本博客虽然用各种语言写的，但是对多语言的支持闻者落泪。

我也不会折腾主题。把Hymmnos字体加进来（记得提醒我玩魔塔大陆3），被Katex折腾折腾，大概就是我力所能及的范围了。曾经有的、现在已经不工作了的飘雪的代码，其实是从Winter Plus的网站那里~~偷~~借过来的。请不要告诉North Plus我借了代码，也不要告诉上面的人我上过Soul Plus。

## 总结

这大概会是我最后一次折腾这个博客了。下次再告诉我有漏洞，我会换到Hatenablog。届时大概会搞一个像R18网站一样的跳转选项，或者在主页里加一个banner。（最后一次折腾？）

最近玩蔚蓝档案，给我很深的感触，就是我经常被活动和人物迷惑了双眼，本来我最优先的momotalk却很少打开。

折腾博客，虽然给我带来很多收获，但是我感觉我渐渐离开了本博客随便写写东西的初衷。而这个初衷是我想继续贯彻的。所以我想以此为戒，也是纪念。

{% quote %}
Plus je écris les blogs, mieux j’aime les papier.

我写的博客越多，我就越喜欢纸。
{% endquote %}

## 附记：一点题外话

虽然游戏堆积成山（蔚蓝档案只是其中一个原因），但是最近有在打天使骚骚的 Demo。因为游戏堆积成山，所以还没有决定要买。

{% image fancybox "/assets/image/tenshisouzou-3-30-2023-8-25-40.png" "说这句台词的时候天使的表情就像万花筒一样" %}

这篇博客开始写是晚上8点，现在已经是第二天了。昨天的日记也没写，Duolingo也没做，洗洗睡了。