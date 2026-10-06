---
title: nameref
tags:
  - latex
  - hyperref
mathjax: true
date: 2017-04-26 20:53:35
lang: zh-cn
label: nameref
---
嗯哼。
<!-- excerpt -->

嗯哼。

nameref并不在计算章节名之后再引用，导致了如下情形的发生：

```
\title{A simplistic proof of 1=2}
\maketitle

\section{1=\arabic{section}}
\label{label0}

\section{2=\arabic{section}}
\nameref{label0}
```

棒极了。可以算入1=2的另一个证明了。

怎么解决（绕过）这个问题?

可以用章节名给label起名，然后用`\ref`就好了

像这样：

{% codeblock lang:latex  %}

\title{Not a proof of 1=2}
\maketitle

{% raw %}
\makeatletter
\def\namedlabel#1{\begingroup
        \def\@currentlabel{\Sectionname}%
        \label{#1}\endgroup
}
{% endraw %}

\makeatother
\section{1=\arabic{section}}\namedlabel{label0}

\section{2=\arabic{section}}

\hyperref[label0]{\ref{label0}}

{% endcodeblock %}

真是奇妙。

{% raw %}
{# 会被nunjucks识别，怪不得老是出错。
{% endraw %}
