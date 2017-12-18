---
title: paper breaker
date: 2017-10-29 00:47:24
tags:
	- paper
---
本文的目标，是用最少的、最通俗的语言，来表述一篇论文的创新之处，或者说，进步。
<!-- excerpt -->

本文的目标，是用最少的、最通俗的语言，来表述一篇论文的创新之处，或者说，进步。

随意排序，不负误导责任。

## dropout

每次feed forward和backprop都只使用随机的一部分perceptron。使得网络能更冗余（要求不同的perceptron表示同样的模型）->健壮。

## maxout

同时使用多个函数feed forward，取最大的一个。可以用几个简单的函数（线性变换）近似一个复杂的函数（如二次、Rectifier）。

## WGAN

使用和GAN不同的尺度（EM距离）来丈量generator和数据中的分布的差距，以避免GAN原来使用的KL或JS造成的梯度消失的问题。

## WGAN GP

补在WGAN里捅的篓子。换了一种方法实现Lipshitz连续，以计算更好的EM距离梯度。

## ResNet

将一个单元的输入加到输出上，同时堆层数。

## Adam

对RMSProp做出改进。使用幂衰减的梯度和二阶梯度的估计修正梯度，并加上bias修正（由于梯度初始化为0，计算前几个梯度时幂衰减平均较小）。
