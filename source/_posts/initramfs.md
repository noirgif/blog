---
title: initramfs
tags:
  - linux
  - boot
date: 2017-04-25 01:07:31
lang: zh-cn
---
initramfs与mkinitcpio
<!-- excerpt -->


## initramfs与mkinitcpio

我们从initramfs开始。

initramfs(initial RAM filesystem)是initrd(initial ramdisk)的后继，是在Linux启动时加载入内存的东西。

一看,后继!就是厉害，没话说。

mkinitramfs则是新一代的生成initramfs的工具。

锦上添花。<del>两份喜悦。</del>

mkinitcpio中的cpio是copy in and out的意思，指initramfs是copy in and out。

它有那么一堆优点：

用busybox

支持udev（我换成systemd了）进行自动的硬件检测

支持hook的扩展

。。。

好像也没什么。

运行

```shell
# mkinitcpio -p linux 
```

就会调用预设的linux.preset（在`/etc/mkinitcpio.d/`下）进行镜像的生成。

-k选项提示使用的内核，preset里直接使用vmlinux（z表示压缩）的内核版本。mkinitcpio会在`/usr/lib/modules/$(uname -r)/`下寻找必要的模块。

因此modules与vmlinux的版本需要相同，否则需要手工指定版本。

烦。

## hook

在`/etc/mkinitcpio.conf`中，可以指定hooks选项。hooks是一些用来构建启动环境的脚本，bash脚本。

为什么是bash。

hook可以通过

```shell
$ mkinitcpio -L
```

来查询。

build hooks的在`/usr/lib/initcpio/install`下可以找到。

build hook在mkinitcpio的时候被执行。

可以看到udev就是按照规则加载。

看吧，开头就是一个`#!/bin/bash`。唉。

runtime hooks在`/usr/lib/initcpio/hooks`下可以找到。

runtime hook则是在启动的时候被调用，会存在同名的build hook将其加入启动脚本中去。

好的。

这些东西当然都是在initramfs里面，也就是说在kernel(那个vmlinuz)加载之后运行。

为什么mkinitcpio需要挂载proc和sysfs呢（

如果直接chroot就会出毛病，arch-chroot脚本就帮忙做了。

否则需要

```shell
# mount -t proc proc /proc
# mount -t sysfs sys /sys
# mount -t devtmpfs udev /dev
```

神奇。


---
## 智商分界线
---

为了实现user swap space，在`mkinitcpio.conf`里加了uresume这个钩子，后来不用了没有删掉，导致启动不了。

只好通过liveCD来修改，结果生成了多少次镜像都发现不管用。

最后发现：

我的镜像放在`/boot/`下，而`/boot/`是另外一个FAT分区。而我

**没有挂载boot分区！**

导致mkinitcpio生成的镜像并没有覆盖实际要用的那个。

说实话在默认选项提示内核版本不对的时候就应该反应过来使用的是当初装机时的残骸了。

一怒之下把那里面的`/boot/`一扫而光。

早知道应该把分区挂载在`/boot/efi/`上，嗯，待会就去做。

好像要改fstab，不能忘了。

不然又是一顿好找。
