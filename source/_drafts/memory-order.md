---
title: Memory Order
lang: zh-cn
tag:
    - C++
    - PL
category:
    - writing
---

我一直以为我大致懂了 memory order 。但是周围的人都说这很难，所以我想：我自己能不能用直白的语言将其解释一遍？如果能，那么我有很大信心说自己懂 memory order 了。如果不行，那就没有人会看到这篇 post 了，所以我尽可能努力一把试试。

我尝试以一环接一环的方式进行陈述，所以在读下一部分之前，务必确定自己已经理解了当前部分的内容，这样由归纳法可证。

## 为什么 memory order ？

简而言之，就是要跑多线程程序。

我们总想提高程序的运行速度——当一匹马拉得不能再快的时候，我们就想着用两匹马去拉。在一台机子上，我们想跑多线程、CUDA etcetc ；在多台机器上，我们想跑分布式。

但是令人遗憾的是，不费任何心思，就让两匹马同时拉车是不可能的。人们总需要做一些*多余*的事情，来确保马儿们是在拉大车而不是在分尸。说*多余*，只是在说这是用一匹马拉车的时候想都不用想的事情。多余的事情通常包括：不让一匹马累死而另一匹马闲死（有时候我们称为**负载均衡**），不让两匹马撞到一起或者互相蹩马腿（专业点说，就是避免**竞争**、保持**一致性**，以及防止死锁）等等。而 memory order 保证的是两匹马并驾齐驱，而不是一匹往南，一匹往北。具体而言，由于编译器会乱序排列访存指令，而 CPU 会乱序执行，这可能导致运行时暴露了一个错误的状态。

这份骈马的心血——事实证明——可以很令人憔悴。信息学奥林匹克（ OI ）经常会说用空间换时间，而这里就是用程序员的时间换计算机的时间了。孰是孰非，还得由结果说了算。
