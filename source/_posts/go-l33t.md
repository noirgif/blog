---
title: go L337
date: 2017-06-29 09:04:05
tags:
    - blog
    - leet
sitemap: false
---

<!-- more -->

<script type='text/javascript'>
function replaceLeet() {
    replaceText("*", "A", "4");
    replaceText("*", "E", "3");
    replaceText("*", "O", "0");
    replaceText("*", "T", "7");
}

function replaceText(selector, text, newText) {
  var matcher = new RegExp(text, "gi");
  var elems = document.querySelectorAll(selector), i;

  for (i = 0; i < elems.length; i++)
    if (!elems[i].childElementCount)
      elems[i].innerHTML = elems[i].innerHTML.replace(matcher, newText);
}
</script>

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

<button onclick="replaceLeet()">Let's go leet</button>


