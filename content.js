// ZhihuCard content script.
// Injects a "Generate card" button into Zhihu article/answer pages,
// extracts data straight from the DOM, and opens a preview modal.

(() => {
  "use strict";

  const BTN_CLASS = "zhihucard-btn";
  const processed = new WeakSet();

  // ============================================================
  // i18n
  // ============================================================

  const I18N_FALLBACK = {
    generateCardButton: "生成卡片",
    cardGeneratingText: "卡片生成中，需要等待几秒钟…",
    styleWhite: "白色",
    styleDark: "黑色",
    styleWallpaper: "壁纸",
    wallpaperSuffix: "壁纸",
    uploadBackgroundTitle: "上传背景",
    processingText: "处理中…",
    customBgLimitText: "自定义背景最多 %s 张，先删一张再传",
    uploadFailedText: "上传失败",
    deleteBgTitle: "删除这张背景",
    customBgLabel: "自定义背景 %s",
    moreWallpapers: "更多壁纸 ▸",
    collapseWallpapers: "收起 ◂",
    hideStatsLabel: "隐藏互动数据",
    hideTimeLabel: "隐藏时间",
    translateLabel: "翻译",
    translatingText: "翻译中…",
    translateFailedText: "翻译服务连不上（国内需代理）",
    copyImageButton: "复制图片",
    copiedText: "已复制 ✓",
    copyFailedText: "复制失败",
    downloadPngButton: "下载 PNG",
    downloadGeneratingText: "生成中…",
    renderFailedText: "渲染失败",
    closeButton: "关闭",
    scrollHintText: "复制按钮在下面 ↓",
    langToggleTitle: "切换界面语言",
    cardColorLabel: "卡片",
    opacityLabel: "透明度",
    customProfileLabel: "自定义头像和昵称",
    customNicknameLabel: "昵称",
    customNicknamePlaceholder: "留空则使用原作者昵称",
    customAvatarLabel: "头像",
    customAvatarUpload: "上传头像",
    customAvatarClear: "恢复默认",
    customSignatureLabel: "个人签名",
    customSignaturePlaceholder: "留空则使用原作者签名",
    likesLabel: "点赞数量",
    likesCurrentLabel: "当前值：",
    likesOriginalLabel: "原数据",
    likesRangeLabel: "随机范围(万)",
    likesRandomBtn: "随机",
    likesResetBtn: "还原",
    statsLabel: "互动数据",
    stat_likes: "点赞",
    stat_comments: "评论",
    stat_bookmarks: "收藏",
    stat_hearts: "喜欢",
    statsRangeHint: "左边填区间（点赞单位万），点随机一键生成",
    statsAutoRandomLabel: "打开面板时自动随机一次",
    paragraphGapLabel: "段落间距",
    imageLayoutLabel: "图片布局",
    imageLayoutAuto: "自动",
    imageLayoutSingle: "单列",
    imageLayoutMulti: "多列",
    autoSplitLabel: "长图自动切4张（下载时）",
    watermarkTextLabel: "水印文字",
    watermarkOpacityLabel: "水印透明度",
    watermarkDensityLabel: "水印密度",
    presetsLabel: "预设用户",
    presetSaveBtn: "保存当前",
    presetHint: "填好昵称/签名/头像点保存，点头像一键切换，右键删除",
    presetEmptyText: "先填昵称/签名/头像再保存",
    presetSavedText: "已保存 ✓",
    presetDeletedText: "已删除",
    presetChipTitle: "预设用户",
    editTextLabel: "编辑文案",
    editTitleLabel: "标题",
    editTitlePlaceholder: "修改卡片标题…",
    editTextPlaceholder: "直接修改卡片正文内容…",
    editRestoreBtn: "恢复原文",
    editHint: "改完自动更新预览",
  };

  function applyFallbackSubstitutions(template, substitutions) {
    if (substitutions == null) return template;
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    let i = 0;
    return template.replace(/%s/g, () => (i < subs.length ? String(subs[i++]) : "%s"));
  }

  let uiLangOverride = "auto";
  let overrideMessages = null;
  const overrideMessagesCache = {};

  function getUiLangSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ uiLang: "auto" }, (res) =>
          resolve(res.uiLang === "zh" || res.uiLang === "en" ? res.uiLang : "auto")
        );
      } catch (_) {
        resolve("auto");
      }
    });
  }

  function saveUiLang(lang) {
    try {
      chrome.storage.sync.set({ uiLang: lang });
    } catch (_) {}
  }

  async function applyUiLang(lang) {
    uiLangOverride = lang;
    if (lang !== "zh" && lang !== "en") {
      overrideMessages = null;
      return;
    }
    if (!overrideMessagesCache[lang]) {
      try {
        const res = await chrome.runtime.sendMessage({ type: "getMessages", lang });
        if (res && res.ok && res.messages) overrideMessagesCache[lang] = res.messages;
      } catch (_) {}
    }
    overrideMessages = overrideMessagesCache[lang] || null;
  }

  function resolveRawMessage(entry, substitutions) {
    const subs = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
    const placeholders = entry.placeholders || {};
    return (entry.message || "").replace(/\$([A-Za-z0-9_]+)\$/g, (whole, name) => {
      const ph = placeholders[name.toLowerCase()] || placeholders[name];
      if (!ph) return whole;
      const m = String(ph.content || "").match(/^\$(\d+)$/);
      if (!m) return ph.content || "";
      const idx = parseInt(m[1], 10) - 1;
      return subs[idx] != null ? String(subs[idx]) : "";
    });
  }

  function t(key, substitutions) {
    if (overrideMessages && overrideMessages[key]) {
      return resolveRawMessage(overrideMessages[key], substitutions);
    }
    try {
      const msg = chrome.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    } catch (_) {}
    return applyFallbackSubstitutions(I18N_FALLBACK[key] || key, substitutions);
  }

  function uiLanguageIsChinese() {
    if (uiLangOverride === "zh") return true;
    if (uiLangOverride === "en") return false;
    try {
      return (chrome.i18n.getUILanguage() || "").toLowerCase().indexOf("zh") === 0;
    } catch (_) {
      return true;
    }
  }

  function effectiveLocale() {
    if (uiLangOverride === "zh") return "zh-CN";
    if (uiLangOverride === "en") return "en";
    try {
      return chrome.i18n.getUILanguage() || "zh-CN";
    } catch (_) {
      return "zh-CN";
    }
  }

  function translateTargetLang(text) {
    if (isPrimarilyChinese(text)) return "en";
    return uiLanguageIsChinese() ? "zh-CN" : "en";
  }

  getUiLangSetting().then(applyUiLang);

  // ============================================================
  // Page type detection
  // ============================================================

  function detectPageType() {
    const href = location.href;
    if (/zhuanlan\.zhihu\.com\/p\//.test(href)) return "article";
    if (/zhihu\.com\/question\/\d+\/answer\//.test(href) || /zhihu\.com\/answer\//.test(href)) return "answer";
    if (/zhihu\.com\/question\/\d+/.test(href)) return "question";
    return null;
  }

  // ============================================================
  // Button injection
  // ============================================================

  const CAMERA_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 ' +
    '2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

  function createButton() {
    const btn = document.createElement("div");
    btn.className = BTN_CLASS;
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("aria-label", t("generateCardButton"));
    btn.title = t("generateCardButton");
    Object.assign(btn.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "32px",
      height: "32px",
      borderRadius: "4px",
      color: "#ffffff",
      cursor: "pointer",
      backgroundColor: "#0066ff",
      border: "none",
      transition: "background-color 0.2s ease",
      flexShrink: "0",
      padding: "0 8px",
      verticalAlign: "middle",
      fontSize: "13px",
      fontWeight: "600",
    });
    btn.innerHTML = CAMERA_ICON;
    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = "#0052cc";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "#0066ff";
    });
    return btn;
  }

  function isFollowText(txt) {
    txt = (txt || "").trim();
    return txt === "+ 关注" || txt === "+关注" || txt === "关注" || txt === "Follow" || txt === "+ Follow";
  }

  function isInPageHeader(el) {
    return !!(el.closest(".AppHeader")
      || el.closest(".AppHeader-inner")
      || el.closest(".TopstoryPageHeader")
      || el.closest("header.AppHeader")
      || el.closest("nav.AppHeader"));
  }

  function findFollowInScope(scope) {
    if (!scope) return null;
    const btns = scope.querySelectorAll("button, .FollowButton");
    for (const btn of btns) {
      if (isInPageHeader(btn)) continue;
      if (isFollowText(btn.textContent) || btn.classList.contains("FollowButton")) return btn;
    }
    return null;
  }

  function findAnswerItemFromEl(el) {
    if (!el) return null;
    return el.closest(".AnswerItem")
      || el.closest(".List-item")
      || el.closest(".ContentItem")
      || el;
  }

  function injectBesideFollow(followBtn, pageType, sourceEl) {
    if (!followBtn || !followBtn.parentNode) return;
    if (followBtn.parentNode.querySelector(`.${BTN_CLASS}`)) return;
    if (processed.has(followBtn)) return;
    processed.add(followBtn);

    const btn = createButton();
    Object.assign(btn.style, { marginRight: "8px" });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 列表页：点击时从关注按钮向上找对应的回答条目
      const item = sourceEl === null ? (findAnswerItemFromEl(followBtn) || followBtn) : sourceEl;
      console.log("ZhihuCard: button clicked, pageType=", pageType, "item=", item);
      handleGenerateClick(pageType, item);
    });
    followBtn.parentNode.insertBefore(btn, followBtn);
  }

  function injectButtonForArticle() {
    const followBtn = findFollowInScope(document.querySelector(".Post-SideColumn"))
      || findFollowInScope(document.querySelector(".Post-Author"))
      || findFollowInScope(document.querySelector(".AuthorInfo"));
    injectBesideFollow(followBtn, "article", document);
  }

  function injectButtonsForAnswers() {
    const scopes = document.querySelectorAll(".AnswerItem, .List-item");
    scopes.forEach((scope) => {
      if (isInPageHeader(scope)) return;
      const followBtn = findFollowInScope(scope.querySelector(".AuthorInfo") || scope);
      injectBesideFollow(followBtn, "answer", null);
    });
  }

  function injectButtons() {
    const pageType = detectPageType();
    if (pageType === "article") injectButtonForArticle();
    else if (pageType === "answer" || pageType === "question") injectButtonsForAnswers();
  }

  const observer = new MutationObserver(() => {
    injectButtons();
  });

  function startObserving() {
    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) startObserving();
  else document.addEventListener("DOMContentLoaded", startObserving, { once: true });

  // ============================================================
  // Data extraction
  // ============================================================

  function extractArticleData() {
    // 标题 - 多种选择器，优先级从高到低
    const titleEl = document.querySelector(".Post-Title")
      || document.querySelector("h1.Post-Title")
      || document.querySelector(".ArticleItem-title")
      || document.querySelector("h1");
    const title = titleEl ? titleEl.textContent.trim() : "";

    // 作者 - 多种选择器
    const authorEl = document.querySelector(".AuthorInfo-name .UserLink-link") 
      || document.querySelector(".Post-AuthorInfo .UserLink-link")
      || document.querySelector(".UserLink-link");
    const author = authorEl ? authorEl.textContent.trim() : "";

    // 头像
    const avatarEl = document.querySelector(".AuthorInfo-avatar img") 
      || document.querySelector(".Post-AuthorInfoAvatar img")
      || document.querySelector(".AuthorInfo img");
    const avatar = avatarEl ? avatarEl.getAttribute("src") || avatarEl.src : "";

    // 作者简介
    const headlineEl = document.querySelector(".AuthorInfo-detail") 
      || document.querySelector(".Post-AuthorInfo .AuthorInfo-detail");
    const authorHeadline = headlineEl ? headlineEl.textContent.trim() : "";

    // 正文 - 多种选择器
    const contentEl = document.querySelector(".RichText.ztext.Post-RichText") 
      || document.querySelector(".Post-RichTextContainer")
      || document.querySelector(".RichText")
      || document.querySelector(".Post-content");
    let text = "";
    let images = [];

    if (contentEl) {
      text = extractTextFromElement(contentEl);
      images = extractImagesFromElement(contentEl);
    }

    // 时间
    const timeEl = document.querySelector(".ContentItem-time time") 
      || document.querySelector(".Post-Row-Content time")
      || document.querySelector("time[datetime]");
    const datetime = timeEl ? timeEl.getAttribute("datetime") : null;

    // 统计数据
    const stats = extractStatsFromToolbar(".Post-Toolbox .ContentItem-actions") 
      || extractStatsFromToolbar(".ContentItem-actions");

    return {
      type: "article",
      title,
      author,
      avatar,
      authorHeadline,
      text,
      images,
      stats,
      datetime,
      url: location.href,
    };
  }

  function extractAnswerData() {
    // 问题标题 - 多种选择器
    const questionTitleEl = document.querySelector(".QuestionHeader-title") 
      || document.querySelector("h1");
    const title = questionTitleEl ? questionTitleEl.textContent.trim() : "";

    // 作者 - 多种选择器
    const authorEl = document.querySelector(".AuthorInfo-name .UserLink-link") 
      || document.querySelector(".AnswerItem .AuthorInfo .UserLink-link")
      || document.querySelector(".UserLink-link");
    const author = authorEl ? authorEl.textContent.trim() : "";

    // 头像
    const avatarEl = document.querySelector(".AuthorInfo-avatar img") 
      || document.querySelector(".AnswerItem .AuthorInfo img")
      || document.querySelector(".AuthorInfo img");
    const avatar = avatarEl ? avatarEl.getAttribute("src") || avatarEl.src : "";

    // 作者简介
    const headlineEl = document.querySelector(".AnswerItem .AuthorInfo-detail") 
      || document.querySelector(".AuthorInfo-detail");
    const authorHeadline = headlineEl ? headlineEl.textContent.trim() : "";

    // 正文 - 多种选择器
    const contentEl = document.querySelector(".RichContent-inner .RichText") 
      || document.querySelector(".QuestionAnswer-content .RichText")
      || document.querySelector(".RichContent-inner")
      || document.querySelector(".RichText");
    let text = "";
    let images = [];

    if (contentEl) {
      text = extractTextFromElement(contentEl);
      images = extractImagesFromElement(contentEl);
    }

    // 时间
    const timeEl = document.querySelector(".AnswerItem .ContentItem-time time") 
      || document.querySelector(".QuestionAnswer-content time")
      || document.querySelector("time[datetime]");
    const datetime = timeEl ? timeEl.getAttribute("datetime") : null;

    // 统计数据 - 多种选择器
    const stats = extractStatsFromToolbar(".AnswerItem .ContentItem-actions") 
      || extractStatsFromToolbar(".RichContent-actions")
      || extractStatsFromToolbar('[role="group"]');

    return {
      type: "answer",
      title,
      author,
      avatar,
      authorHeadline,
      text,
      images,
      stats,
      datetime,
      url: location.href,
    };
  }

  function extractAnswerDataFromItem(item) {
    if (!item || item.nodeType !== 1) return null;

    const q = (sel) => item.querySelector(sel);

    // 问题标题（所有回答共享，从页面级取）
    const titleEl = document.querySelector(".QuestionHeader-title") || document.querySelector("h1");
    const title = titleEl ? titleEl.textContent.trim() : "";

    // 作者
    const authorEl = q(".AuthorInfo-name .UserLink-link") || q(".AuthorInfo .UserLink-link") || q(".UserLink-link");
    const author = authorEl ? authorEl.textContent.trim() : "";

    // 头像
    const avatarEl = q(".AuthorInfo-avatar img") || q(".AuthorInfo img");
    const avatar = avatarEl ? (avatarEl.getAttribute("src") || avatarEl.src) : "";

    // 作者简介
    const headlineEl = q(".AuthorInfo-detail");
    const authorHeadline = headlineEl ? headlineEl.textContent.trim() : "";

    // 正文：优先取正文容器，找不到再回退到条目整体
    const contentEl = q(".RichContent-inner .RichText")
      || q(".QuestionAnswer-content .RichText")
      || q(".RichContent-inner")
      || q(".RichContent")
      || q(".RichText");
    let text = "";
    let images = [];
    if (contentEl) {
      text = extractTextFromElement(contentEl);
      images = extractImagesFromElement(contentEl);
    }
    if (!text.trim() && contentEl !== item) {
      text = extractTextFromElement(item);
      images = extractImagesFromElement(item);
    }

    // 时间
    const timeEl = q(".ContentItem-time time") || q("time[datetime]");
    const datetime = timeEl ? timeEl.getAttribute("datetime") : null;

    // 统计数据
    const toolbar = q(".ContentItem-actions") || q(".RichContent-actions") || q('[role="group"]');
    const stats = extractStatsFromToolbarEl(toolbar);

    return {
      type: "answer",
      title,
      author,
      avatar,
      authorHeadline,
      text,
      images,
      stats,
      datetime,
      url: location.href,
    };
  }

  function extractTextFromElement(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("style, script, .RichText-zwlink").forEach((n) => n.remove());

    let out = "";
    function walk(node) {
      if (node.nodeType === 3) {
        const raw = node.nodeValue;
        out += raw;
      } else if (node.nodeType === 1) {
        const tag = node.tagName;
        if (tag === "BR") {
          out += "\n";
          return;
        }
        if (tag === "IMG" || tag === "FIGURE" || tag === "PICTURE" || tag === "VIDEO" || tag === "NOSCRIPT") {
          return;
        }
        if (tag === "P" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
          if (out && !out.endsWith("\n")) out += "\n";
        }
        if (tag === "LI") {
          out += "\u2022 ";
        }
        for (const child of node.childNodes) {
          walk(child);
        }
        if (tag === "P" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
          if (!out.endsWith("\n")) out += "\n";
        }
      }
    }
    for (const child of clone.childNodes) {
      walk(child);
    }
    return out.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function extractImagesFromElement(el) {
    const results = [];
    el.querySelectorAll("img").forEach((img) => {
      const src = bestImgSrc(img);
      if (!src || src.startsWith("data:")) return;
      if (/equation|latex|formula/i.test(src)) return;
      const container = img.closest("figure") || img.parentElement;
      let aspectRatio = null;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          aspectRatio = rect.width / rect.height;
        }
      }
      results.push({ url: src, aspectRatio });
    });
    return results.slice(0, 4);
  }

  function extractStatsFromToolbarEl(toolbar) {
    const stats = { likes: 0, comments: 0, bookmarks: 0, hearts: 0 };
    if (!toolbar) return stats;

    // 从任意文案里取第一个数字，支持 2.2万 / 1.3亿 / 6.35K / 1078
    function firstNumber(text) {
      const m = String(text || "").match(/([\d][\d,.]*\s*[万亿KMB]?)/i);
      return m ? parseCount(m[1]) : 0;
    }

    const METRICS = [
      { key: "likes", kw: /赞同|voteup|agree/i },
      { key: "comments", kw: /评论|comment/i },
      { key: "bookmarks", kw: /收藏|collect|bookmark/i },
      { key: "hearts", kw: /喜欢|heart/i },
    ];

    const candidates = Array.from(toolbar.querySelectorAll(
      "button, a, [role='button'], .VoteButton, .CommentButton, .BookmarkButton, [class*='VoteButton'], [class*='CommentButton'], [class*='BookmarkButton']"
    ));

    METRICS.forEach((metric) => {
      for (const el of candidates) {
        const label = el.getAttribute("aria-label") || "";
        const text = el.textContent || "";
        if (!metric.kw.test(label) && !metric.kw.test(text)) continue;
        const n = firstNumber(text) || firstNumber(label);
        if (n) { stats[metric.key] = n; break; }
      }
    });

    // 兜底：老选择器（同样支持万/亿单位）
    if (!stats.likes) {
      const likeBtn = toolbar.querySelector('.VoteButton--up, .VoteButton--up .CountValue, [aria-label*="赞同"], [aria-label*="like"]');
      if (likeBtn) stats.likes = firstNumber(likeBtn.textContent) || firstNumber(likeBtn.getAttribute("aria-label"));
    }
    if (!stats.comments) {
      const commentBtn = toolbar.querySelector('button[aria-label*="评论"], button[aria-label*="comment"], .CommentButton');
      if (commentBtn) stats.comments = firstNumber(commentBtn.textContent) || firstNumber(commentBtn.getAttribute("aria-label"));
    }
    if (!stats.bookmarks) {
      const bookmarkBtn = toolbar.querySelector('button[aria-label*="收藏"], button[aria-label*="bookmark"], .BookmarkButton');
      if (bookmarkBtn) stats.bookmarks = firstNumber(bookmarkBtn.textContent) || firstNumber(bookmarkBtn.getAttribute("aria-label"));
    }
    if (!stats.hearts) {
      const heartBtn = toolbar.querySelector('button[aria-label*="喜欢"], button[aria-label*="heart"], button[aria-label*="Hearts"]');
      if (heartBtn) stats.hearts = firstNumber(heartBtn.textContent) || firstNumber(heartBtn.getAttribute("aria-label"));
    }

    // 兜底：赞同数也从头部「N 万人赞同」取
    if (!stats.likes) {
      const voteEl = document.querySelector(".AnswerItem-voteInfo, .ContentItem-voteInfo, [class*='voteInfo']");
      const m = voteEl && voteEl.textContent.match(/([\d][\d,.]*\s*[万亿]?)\s*人赞同/);
      if (m) stats.likes = parseCount(m[1]);
    }

    return stats;
  }

  function extractStatsFromToolbar(selector) {
    return extractStatsFromToolbarEl(document.querySelector(selector));
  }

  // ============================================================
  // js-initialData fallback (more reliable than DOM selectors)
  // ============================================================

  function extractFromInitialData() {
    try {
      const scriptEl = document.querySelector('script#js-initialData[type="text/json"]');
      if (!scriptEl) return null;

      const data = JSON.parse(scriptEl.textContent);
      if (!data || !data.initialState || !data.initialState.entities) return null;

      const entities = data.initialState.entities;
      const url = location.href;

      // 文章页面
      if (/zhuanlan\.zhihu\.com\/p\//.test(url)) {
        const articles = entities.articles || {};
        const article = Object.values(articles)[0];
        if (!article) return null;

        // 从 URL 提取文章 ID
        const match = url.match(/\/p\/(\d+)/);
        const articleId = match ? match[1] : null;
        const articleData = articleId ? articles[articleId] : article;

        return {
          type: "article",
          title: articleData.title || "",
          author: (articleData.author && articleData.author.name) || "",
          avatar: (articleData.author && articleData.author.avatarUrl) || "",
          authorHeadline: (articleData.author && articleData.author.headline) || "",
          text: stripHtml(articleData.content || ""),
          images: extractImagesFromHtml(articleData.content || ""),
          stats: {
            likes: articleData.voteupCount || 0,
            comments: articleData.commentCount || 0,
            bookmarks: articleData.stats ? (articleData.stats.favoritesCount || 0) : 0,
            hearts: articleData.likeCount || 0,
          },
          datetime: articleData.created ? new Date(articleData.created * 1000).toISOString() : null,
          url: url,
        };
      }

      // 回答页面
      if (/zhihu\.com\/question\/\d+\/answer\//.test(url) || /zhihu\.com\/answer\//.test(url)) {
        const answers = entities.answers || {};
        const answer = Object.values(answers)[0];
        if (!answer) return null;

        const match = url.match(/\/answer\/(\d+)/);
        const answerId = match ? match[1] : null;
        const answerData = answerId ? answers[answerId] : answer;

        const question = answerData.question || {};
        return {
          type: "answer",
          title: question.title || "",
          author: (answerData.author && answerData.author.name) || "",
          avatar: (answerData.author && answerData.author.avatarUrl) || "",
          authorHeadline: (answerData.author && answerData.author.headline) || "",
          text: stripHtml(answerData.content || ""),
          images: extractImagesFromHtml(answerData.content || ""),
          stats: {
            likes: answerData.voteupCount || 0,
            comments: answerData.commentCount || 0,
            bookmarks: answerData.stats ? (answerData.stats.favoritesCount || 0) : 0,
            hearts: answerData.likeCount || 0,
          },
          datetime: answerData.createdTime ? new Date(answerData.createdTime * 1000).toISOString() : null,
          url: url,
        };
      }
    } catch (e) {
      console.warn("ZhihuCard: js-initialData parse failed", e);
    }
    return null;
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    let out = "";
    function walk(node) {
      if (node.nodeType === 3) {
        out += node.nodeValue;
      } else if (node.nodeType === 1) {
        const tag = node.tagName;
        if (tag === "BR") { out += "\n"; return; }
        if (tag === "IMG" || tag === "FIGURE" || tag === "PICTURE" || tag === "VIDEO" || tag === "NOSCRIPT") { return; }
        if (tag === "P" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
          if (out && !out.endsWith("\n")) out += "\n";
        }
        if (tag === "LI") { out += "\u2022 "; }
        for (const child of node.childNodes) walk(child);
        if (tag === "P" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
          if (!out.endsWith("\n")) out += "\n";
        }
      }
    }
    for (const child of div.childNodes) walk(child);
    return out.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function bestImgSrc(img) {
    return img.getAttribute("data-original")
      || img.getAttribute("data-actualsrc")
      || img.getAttribute("data-src")
      || img.getAttribute("src")
      || "";
  }

  function extractImagesFromHtml(html) {
    const results = [];
    const seen = new Set();
    function addUrl(url) {
      if (!url || url.startsWith("data:") || /equation|latex|formula/i.test(url)) return;
      if (seen.has(url)) return;
      seen.add(url);
      results.push({ url: url, aspectRatio: null });
    }

    const div = document.createElement("div");
    div.innerHTML = html;
    div.querySelectorAll("img").forEach((img) => {
      addUrl(bestImgSrc(img));
    });

    if (results.length === 0) {
      const tagRegex = /<img\b[^>]*?>/gi;
      const attrRegex = /(?:data-original|data-actualsrc|data-src|src)\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
      let m;
      while ((m = tagRegex.exec(html)) !== null) {
        const tag = m[0];
        const a = attrRegex.exec(tag);
        if (a) addUrl(a[1] || a[2]);
      }
    }

    if (results.length === 0) {
      const textContent = div.textContent || "";
      const urlRegex = /https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?/gi;
      let m;
      while ((m = urlRegex.exec(textContent)) !== null) {
        addUrl(m[0]);
      }
    }

    return results.slice(0, 4);
  }

  function parseCount(s) {
    if (s == null) return 0;
    s = String(s).replace(/[,，\s]/g, "");
    const m = s.match(/([\d.]+)([KMB万亿]?)/i);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    const u = m[2].toUpperCase();
    if (u === "K") n *= 1e3;
    else if (u === "M") n *= 1e6;
    else if (u === "B") n *= 1e9;
    else if (m[2] === "万") n *= 1e4;
    else if (m[2] === "亿") n *= 1e8;
    return Math.round(n);
  }

  const CHINESE_RE = /[一-鿿]/g;

  function isPrimarilyChinese(text) {
    const stripped = (text || "").replace(/\s/g, "");
    if (!stripped.length) return false;
    const zh = (stripped.match(CHINESE_RE) || []).length;
    return zh / stripped.length >= 0.1;
  }

  // ============================================================
  // Settings
  // ============================================================

  // 本地优先的读写：storage.local 一定可用且容量大（sync 在部分地区不可用，
  // 且单条 8KB 限制装不下头像 dataURL），sync 只做尽力同步/迁移。
  function storageGetLocal(keys) {
    return new Promise((resolve) => {
      try { chrome.storage.local.get(keys, (res) => resolve(res || {})); }
      catch (_) { resolve({}); }
    });
  }
  function storageGetSync(keys) {
    return new Promise((resolve) => {
      try { chrome.storage.sync.get(keys, (res) => resolve(res || {})); }
      catch (_) { resolve({}); }
    });
  }
  function storageSet(obj) {
    try { chrome.storage.local.set(obj, () => void chrome.runtime.lastError); } catch (_) {}
    try { chrome.storage.sync.set(obj, () => void chrome.runtime.lastError); } catch (_) {}
  }
  async function loadSetting(key, fallback) {
    const local = await storageGetLocal({ [key]: null });
    if (local[key] !== null && local[key] !== undefined) return local[key];
    const sync = await storageGetSync({ [key]: fallback });
    const v = sync[key] !== undefined && sync[key] !== null ? sync[key] : fallback;
    storageSet({ [key]: v });
    return v;
  }

  async function getWatermarkSetting() {
    return !!(await loadSetting("watermark", false));
  }
  function saveWatermarkSetting(value) {
    storageSet({ watermark: !!value });
  }

  async function getWatermarkStyleSetting() {
    const text = await loadSetting("watermarkText", "ZhihuCard");
    const opacity = await loadSetting("watermarkOpacity", 14);
    const density = await loadSetting("watermarkDensity", 100);
    let op = Number(opacity);
    if (!isFinite(op)) op = 14;
    op = Math.min(60, Math.max(2, Math.round(op)));
    let de = Number(density);
    if (!isFinite(de)) de = 100;
    de = Math.min(220, Math.max(40, Math.round(de)));
    return { text: typeof text === "string" ? text : "ZhihuCard", opacity: op, density: de };
  }
  function saveWatermarkText(value) {
    storageSet({ watermarkText: typeof value === "string" ? value : "ZhihuCard" });
  }
  function saveWatermarkOpacity(value) {
    let op = Number(value);
    if (!isFinite(op)) op = 14;
    storageSet({ watermarkOpacity: Math.min(60, Math.max(2, Math.round(op))) });
  }
  function saveWatermarkDensity(value) {
    let de = Number(value);
    if (!isFinite(de)) de = 100;
    storageSet({ watermarkDensity: Math.min(220, Math.max(40, Math.round(de))) });
  }

  const MAX_PROFILE_PRESETS = 5;
  function sanitizePresets(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((p) => p && typeof p === "object")
      .slice(0, MAX_PROFILE_PRESETS)
      .map((p) => ({
        nickname: typeof p.nickname === "string" ? p.nickname : "",
        signature: typeof p.signature === "string" ? p.signature : "",
        avatar: typeof p.avatar === "string" ? p.avatar : "",
      }));
  }
  function getProfilePresets() {
    return loadSetting("profilePresets", []).then((v) => sanitizePresets(v));
  }
  function saveProfilePresets(list) {
    storageSet({ profilePresets: sanitizePresets(list) });
  }

  const VALID_STYLES = ["white", "dark", "warm", "cool", "paper", "minimal", "cherry", "tianya", "retro", "matcha", "chocolate", "blueberry", "redTeal", "wallpaper"];

  function getSavedStyle() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ theme: "white" }, (res) =>
          resolve(VALID_STYLES.includes(res.theme) ? res.theme : "white")
        );
      } catch (_) {
        resolve("white");
      }
    });
  }

  function saveStyle(style) {
    try {
      chrome.storage.sync.set({ theme: style });
    } catch (_) {}
  }

  const MAX_CUSTOM_BACKGROUNDS = 6;

  function getCustomBackgrounds() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({ customBgs: [], customBg: null }, (res) => {
          if (Array.isArray(res.customBgs)) {
            resolve(res.customBgs);
          } else if (res.customBg) {
            const migrated = [res.customBg];
            chrome.storage.local.set({ customBgs: migrated }, () => {
              chrome.storage.local.remove("customBg", () => resolve(migrated));
            });
          } else {
            resolve([]);
          }
        });
      } catch (_) {
        resolve([]);
      }
    });
  }

  function setCustomBackgrounds(list) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ customBgs: list }, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  function getHideStatsSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ hideStats: false }, (res) => resolve(!!res.hideStats));
      } catch (_) {
        resolve(false);
      }
    });
  }

  function saveHideStats(value) {
    try {
      chrome.storage.sync.set({ hideStats: !!value });
    } catch (_) {}
  }

  function getHideTimeSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ hideTime: false }, (res) => resolve(!!res.hideTime));
      } catch (_) {
        resolve(false);
      }
    });
  }

  function saveHideTime(value) {
    try {
      chrome.storage.sync.set({ hideTime: !!value });
    } catch (_) {}
  }

  function getParagraphGapSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ paragraphGap: false }, (res) => resolve(!!res.paragraphGap));
      } catch (_) { resolve(false); }
    });
  }
  function saveParagraphGap(value) {
    try { chrome.storage.sync.set({ paragraphGap: !!value }); } catch (_) {}
  }

  const IMAGE_LAYOUTS = ["auto", "single", "multi"];
  function getImageLayoutSetting() {
    return loadSetting("imageLayout", "auto").then((v) => (IMAGE_LAYOUTS.indexOf(v) >= 0 ? v : "auto"));
  }
  function saveImageLayout(value) {
    const v = IMAGE_LAYOUTS.indexOf(value) >= 0 ? value : "auto";
    storageSet({ imageLayout: v });
  }

  // 长图自动切 4 张
  const SPLIT_THRESHOLD_CSS = 2400; // 卡片 CSS 高度超过此值才切
  const SPLIT_MAX = 4;
  const SPLIT_MARGIN_CSS = 24; // 每张图上下左右页边距

  function getAutoSplitSetting() {
    return loadSetting("autoSplit", true).then((v) => v !== false);
  }
  function saveAutoSplit(value) {
    storageSet({ autoSplit: !!value });
  }

  // 找安全切点：块级元素边界 + 正文行网格（避免从文字/图片中间切断）
  function measureSafeCuts(cardEl, cssHeight, n) {
    const clone = cardEl.cloneNode(true);
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { position: "fixed", left: "-9999px", top: "0" });
    wrap.appendChild(clone);
    document.body.appendChild(wrap);
    const base = clone.getBoundingClientRect().top;
    const candidates = [];
    clone.querySelectorAll("*").forEach((elm) => {
      const r = elm.getBoundingClientRect();
      if (r.height <= 0 || r.width <= 0) return;
      candidates.push(r.top - base, r.bottom - base);
    });
    const tb = clone.querySelector('[data-zhihucard-role="text-original"], [data-zhihucard-role="text-translated"]');
    if (tb) {
      const cs = getComputedStyle(tb);
      const fs = parseFloat(cs.fontSize) || 16;
      const lh = parseFloat(cs.lineHeight) || fs * 1.75;
      const r = tb.getBoundingClientRect();
      const lines = Math.max(1, Math.round(r.height / lh));
      for (let k = 1; k < lines; k++) candidates.push(r.top - base + k * lh);
    }
    document.body.removeChild(wrap);

    const sliceH = cssHeight / n;
    const win = Math.max(60, sliceH * 0.25);
    const cuts = [];
    for (let i = 1; i < n; i++) {
      const target = sliceH * i;
      let best = target, bestD = Infinity;
      for (const c of candidates) {
        if (c <= 10 || c >= cssHeight - 10) continue;
        const d = Math.abs(c - target);
        if (d < bestD) { bestD = d; best = c; }
      }
      cuts.push(bestD <= win ? best : target);
    }
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i] <= cuts[i - 1] + 120) cuts[i] = cuts[i - 1] + 120;
      if (cuts[i] > cssHeight - 120) cuts[i] = cssHeight - 120;
    }
    return cuts.filter((c) => c > 0 && c < cssHeight);
  }

  // 把整张长图按切点分成多张，每张带页边距；壁纸模式用原图边缘延展背景
  function sliceCanvas(srcCanvas, cutsCss, scale, cardEl) {
    const devW = srcCanvas.width, devH = srcCanvas.height;
    const m = Math.round(SPLIT_MARGIN_CSS * scale);
    const isWallpaper = !!(cardEl && cardEl.dataset && cardEl.dataset.zhihucardRole === "wallpaper-frame");
    let bg = "#ffffff";
    try {
      const cs = getComputedStyle(cardEl);
      if (cs && cs.backgroundColor && cs.backgroundColor !== "transparent" && cs.backgroundColor !== "rgba(0, 0, 0, 0)") bg = cs.backgroundColor;
    } catch (_) {}
    const bounds = (cutsCss || []).map((c) => Math.round(c * scale)).filter((c) => c > 0 && c < devH);
    bounds.push(devH);
    const out = [];
    let start = 0;
    for (const end of bounds) {
      const h = end - start;
      if (h <= 0) continue;
      const c = document.createElement("canvas");
      c.width = devW + m * 2;
      c.height = h + m * 2;
      const ctx = c.getContext("2d");
      if (isWallpaper) {
        const sx = Math.min(2, devW), sy = Math.min(2, h);
        ctx.drawImage(srcCanvas, 0, start, devW, sy, 0, 0, devW, m);                      // 上边
        ctx.drawImage(srcCanvas, 0, end - sy, devW, sy, 0, m + h, devW, m);                // 下边
        ctx.drawImage(srcCanvas, 0, start, sx, h, 0, m, m, h);                             // 左边
        ctx.drawImage(srcCanvas, devW - sx, start, sx, h, m + devW, m, m, h);              // 右边
        ctx.drawImage(srcCanvas, 0, start, devW, h, m, m, devW, h);                        // 正片
      } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(srcCanvas, 0, start, devW, h, m, m, devW, h);
      }
      out.push(c);
      start = end;
    }
    return out;
  }

  const STAT_KEYS = ["likes", "comments", "bookmarks", "hearts"];
  const DEFAULT_STAT_RANGES = {
    likes: [3, 5],          // 单位：万
    comments: [500, 3000],
    bookmarks: [100, 1500],
    hearts: [50, 800],
  };

  function normalizeRange(lo, hi) {
    lo = Number(lo); hi = Number(hi);
    if (!isFinite(lo) || lo < 0) lo = 0;
    if (!isFinite(hi) || hi < 0) hi = 0;
    if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
    return [lo, hi];
  }

  function getStatsOverrideSetting() {
    const defaults = { likes: 0, comments: 0, bookmarks: 0, hearts: 0, ranges: DEFAULT_STAT_RANGES };
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ statsOverride: null, statsRanges: null, likesOverride: 0, likesRandomMin: 3, likesRandomMax: 5 }, (res) => {
          const hasSaved = res.statsOverride && typeof res.statsOverride === "object";
          const saved = hasSaved ? res.statsOverride : {};
          const out = {
            likes: hasSaved ? (Number(saved.likes) || 0) : (Number(res.likesOverride) || 0),
            comments: Number(saved.comments) || 0,
            bookmarks: Number(saved.bookmarks) || 0,
            hearts: Number(saved.hearts) || 0,
            ranges: {},
          };
          STAT_KEYS.forEach((k) => {
            const r = res.statsRanges && res.statsRanges[k];
            if (Array.isArray(r) && r.length === 2) out.ranges[k] = normalizeRange(r[0], r[1]);
            else if (k === "likes") out.ranges[k] = normalizeRange(res.likesRandomMin, res.likesRandomMax);
            else out.ranges[k] = DEFAULT_STAT_RANGES[k].slice();
          });
          resolve(out);
        });
      } catch (_) { resolve(defaults); }
    });
  }
  function saveStatsOverride(stats) {
    try {
      const out = {};
      STAT_KEYS.forEach((k) => { out[k] = Math.max(0, Number(stats[k]) || 0); });
      chrome.storage.sync.set({ statsOverride: out });
    } catch (_) {}
  }
  function saveStatsRanges(ranges) {
    try {
      const out = {};
      STAT_KEYS.forEach((k) => { out[k] = (ranges[k] || [0, 0]).slice(); });
      chrome.storage.sync.set({ statsRanges: out });
    } catch (_) {}
  }
  function getStatsAutoRandomSetting() {
    return loadSetting("statsAutoRandom", false).then((v) => !!v);
  }
  function saveStatsAutoRandom(value) {
    storageSet({ statsAutoRandom: !!value });
  }

  function getTitleFontSizeSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ titleFontSize: 22 }, (res) => resolve(Number(res.titleFontSize) || 22));
      } catch (_) { resolve(22); }
    });
  }
  function saveTitleFontSize(value) {
    try { chrome.storage.sync.set({ titleFontSize: Number(value) || 22 }); } catch (_) {}
  }

  function getBodyFontSizeSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ bodyFontSize: 16 }, (res) => resolve(Number(res.bodyFontSize) || 16));
      } catch (_) { resolve(16); }
    });
  }
  function saveBodyFontSize(value) {
    try { chrome.storage.sync.set({ bodyFontSize: Number(value) || 16 }); } catch (_) {}
  }

  function getHideLinkSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ hideLink: false }, (res) => resolve(!!res.hideLink));
      } catch (_) { resolve(false); }
    });
  }
  function saveHideLink(value) {
    try { chrome.storage.sync.set({ hideLink: !!value }); } catch (_) {}
  }

  function getCustomAvatarSetting() {
    return loadSetting("customAvatar", "").then((v) => (typeof v === "string" ? v : ""));
  }
  function saveCustomAvatar(value) {
    storageSet({ customAvatar: typeof value === "string" ? value : "" });
  }

  function getCustomNicknameSetting() {
    return loadSetting("customNickname", "").then((v) => (typeof v === "string" ? v : ""));
  }
  function saveCustomNickname(value) {
    storageSet({ customNickname: typeof value === "string" ? value : "" });
  }

  function getCustomSignatureSetting() {
    return loadSetting("customSignature", "").then((v) => (typeof v === "string" ? v : ""));
  }
  function saveCustomSignature(value) {
    storageSet({ customSignature: typeof value === "string" ? value : "" });
  }

  const VALID_CARD_THEMES = ["white", "dark", "warm", "cool", "paper", "minimal", "cherry", "tianya", "retro", "matcha", "chocolate", "blueberry", "redTeal"];

  function clampCardOpacity(v) {
    const n = Math.round(Number(v));
    if (isNaN(n)) return 100;
    return Math.min(100, Math.max(30, n));
  }

  function getWallpaperCardSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ wallpaperCardTheme: "white", wallpaperCardOpacity: 100 }, (res) =>
          resolve({
            theme: VALID_CARD_THEMES.includes(res.wallpaperCardTheme) ? res.wallpaperCardTheme : "white",
            opacity: clampCardOpacity(res.wallpaperCardOpacity),
          })
        );
      } catch (_) {
        resolve({ theme: "white", opacity: 100 });
      }
    });
  }

  function saveWallpaperCardSettings(theme, opacity) {
    try {
      chrome.storage.sync.set({ wallpaperCardTheme: theme, wallpaperCardOpacity: opacity });
    } catch (_) {}
  }

  const BUILTIN_BACKGROUNDS = [
    { id: "aurora", name: "Aurora", file: "assets/bg-aurora.jpg" },
    { id: "sunset", name: "Sunset", file: "assets/bg-sunset.jpg" },
    { id: "rose", name: "Rose", file: "assets/bg-rose.jpg" },
    { id: "ocean", name: "Ocean", file: "assets/bg-ocean.jpg" },
    { id: "violet", name: "Violet", file: "assets/bg-violet.jpg" },
    { id: "golden", name: "Golden", file: "assets/bg-golden.jpg" },
    { id: "graphite", name: "Graphite", file: "assets/bg-graphite.jpg" },
  ];

  function builtinBackgroundUrl(entry) {
    try {
      return chrome.runtime.getURL(entry.file);
    } catch (_) {
      return "";
    }
  }

  function defaultWallpaperUrl() {
    return builtinBackgroundUrl(BUILTIN_BACKGROUNDS[0]);
  }

  function getSavedBackgroundId() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ wallpaperBg: "aurora" }, (res) => resolve(res.wallpaperBg || "aurora"));
      } catch (_) {
        resolve("aurora");
      }
    });
  }

  function saveBackgroundId(id) {
    try {
      chrome.storage.sync.set({ wallpaperBg: id });
    } catch (_) {}
  }

  function resolveBackgroundUrl(bgId, customBgs) {
    if (typeof bgId === "string" && bgId.indexOf("custom:") === 0) {
      const idx = parseInt(bgId.slice(7), 10);
      if (Array.isArray(customBgs) && idx >= 0 && idx < customBgs.length) return customBgs[idx];
      return defaultWallpaperUrl();
    }
    const entry = BUILTIN_BACKGROUNDS.find((b) => b.id === bgId);
    if (entry) return builtinBackgroundUrl(entry);
    return defaultWallpaperUrl();
  }

  function sanitizeBgId(bgId, customBgs) {
    if (typeof bgId === "string" && bgId.indexOf("custom:") === 0) {
      const idx = parseInt(bgId.slice(7), 10);
      if (!(Array.isArray(customBgs) && idx >= 0 && idx < customBgs.length)) return "aurora";
      return bgId;
    }
    if (BUILTIN_BACKGROUNDS.some((b) => b.id === bgId)) return bgId;
    return "aurora";
  }

  function resizeImageFileToDataUrl(file, maxSide) {
    maxSide = maxSide || 2400;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIDE = maxSide;
          let { width, height } = img;
          if (width > MAX_SIDE || height > MAX_SIDE) {
            if (width >= height) {
              height = Math.round(height * (MAX_SIDE / width));
              width = MAX_SIDE;
            } else {
              width = Math.round(width * (MAX_SIDE / height));
              height = MAX_SIDE;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("failed to decode image"));
        img.src = reader.result;
      };
      reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
      reader.readAsDataURL(file);
    });
  }

  // ============================================================
  // Preview modal
  // ============================================================

  function buildFilename(author) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}`;
    const cleanAuthor = (author || "zhihucard").replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, "") || "zhihucard";
    return `${cleanAuthor}_${stamp}.png`;
  }

  function waitForImages(root, timeoutMs) {
    const pending = Array.from(root.querySelectorAll("img")).map((img) =>
      img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    );
    if (!pending.length) return Promise.resolve();
    return Promise.race([
      Promise.all(pending),
      new Promise((resolve) => setTimeout(resolve, timeoutMs || 5000)),
    ]);
  }

  function closeModal(host) {
    if (host && host.__zhihuStorage) {
      try { chrome.storage.onChanged.removeListener(host.__zhihuStorage); } catch (_) {}
      host.__zhihuStorage = null;
    }
    if (host && host.parentNode) host.parentNode.removeChild(host);
    document.removeEventListener("keydown", host.__zhihuEsc, true);
    if (host.__zhihuResize) window.removeEventListener("resize", host.__zhihuResize);
  }

  async function handleGenerateClick(pageType, sourceEl) {
    console.log("ZhihuCard: handleGenerateClick called, pageType=", pageType);
    const shell = createModalShell();
    await nextPaint();
    if (!shell.host.isConnected) return;

    // 列表页：按点击按钮对应的回答条目提取
    let data = null;
    if (sourceEl && sourceEl !== document && sourceEl.nodeType === 1) {
      data = extractAnswerDataFromItem(sourceEl);
      console.log("ZhihuCard: item extraction result=", data);
    }

    // 优先从 js-initialData 提取（更可靠），失败则用 DOM 选择器
    if (!data) data = extractFromInitialData();
    console.log("ZhihuCard: js-initialData result=", data);
    if (!data) {
      data = pageType === "article" ? extractArticleData() : extractAnswerData();
      console.log("ZhihuCard: DOM extraction result=", data);
    }

    // initialData 里缺的指标用 DOM 工具栏补
    if (data && data.stats) {
      const domStats = extractStatsFromToolbarEl(
        document.querySelector(".AnswerItem .ContentItem-actions")
        || document.querySelector(".Post-Toolbox .ContentItem-actions")
        || document.querySelector(".ContentItem-actions")
        || document.querySelector(".RichContent-actions")
      );
      if (domStats) {
        STAT_KEYS.forEach((k) => { if (!data.stats[k]) data.stats[k] = domStats[k]; });
      }
    }

    if (data && (!data.images || data.images.length === 0)) {
      let contentEl = null;
      if (sourceEl && sourceEl !== document && sourceEl.nodeType === 1) {
        contentEl = sourceEl.querySelector(".RichContent-inner .RichText")
          || sourceEl.querySelector(".RichContent-inner")
          || sourceEl.querySelector(".RichContent")
          || sourceEl.querySelector(".RichText");
      } else {
        contentEl = pageType === "article"
          ? (document.querySelector(".RichText.ztext.Post-RichText") || document.querySelector(".Post-RichTextContainer") || document.querySelector(".RichText"))
          : (document.querySelector(".RichContent-inner .RichText") || document.querySelector(".RichContent-inner") || document.querySelector(".RichText"));
      }
      if (contentEl) {
        const domImages = extractImagesFromElement(contentEl);
        if (domImages.length > 0) data.images = domImages;
      }
    }
    const [watermark, style, customBgs, hideStats, hideTime, savedBgId, uiLang, wallpaperCard, paragraphGap, titleFontSize, bodyFontSize, hideLink, customAvatar, customNickname, customSignature, statsCfg, statsAutoRandom, watermarkStyle, profilePresets, imageLayout, autoSplit] = await Promise.all([
      getWatermarkSetting(),
      getSavedStyle(),
      getCustomBackgrounds(),
      getHideStatsSetting(),
      getHideTimeSetting(),
      getSavedBackgroundId(),
      getUiLangSetting(),
      getWallpaperCardSettings(),
      getParagraphGapSetting(),
      getTitleFontSizeSetting(),
      getBodyFontSizeSetting(),
      getHideLinkSetting(),
      getCustomAvatarSetting(),
      getCustomNicknameSetting(),
      getCustomSignatureSetting(),
      getStatsOverrideSetting(),
      getStatsAutoRandomSetting(),
      getWatermarkStyleSetting(),
      getProfilePresets(),
      getImageLayoutSetting(),
      getAutoSplitSetting(),
    ]);
    if (!shell.host.isConnected) return;
    await applyUiLang(uiLang);
    if (!shell.host.isConnected) return;

    finishModal(shell, data, {
      watermark,
      style,
      customBgs,
      hideStats,
      hideTime,
      wallpaperCard,
      bgId: sanitizeBgId(savedBgId, customBgs),
      pageType,
      paragraphGap,
      titleFontSize,
      bodyFontSize,
      hideLink,
      customAvatar,
      customNickname,
      customSignature,
      likesCfg: statsCfg,
      statsAutoRandom,
      watermarkText: watermarkStyle.text,
      watermarkOpacity: watermarkStyle.opacity,
      watermarkDensity: watermarkStyle.density,
      profilePresets,
      imageLayout,
      autoSplit,
    });
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function createModalShell() {
    const host = document.createElement("div");
    host.id = "zhihucard-host";
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes zhihucard-spin { to { transform: rotate(360deg); } }
      .zc-sidebar::-webkit-scrollbar { width: 6px; }
      .zc-sidebar::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
      .zc-swatch { width: 28px; height: 28px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; transition: border-color 0.15s; }
      .zc-swatch:hover { border-color: rgba(255,255,255,0.4); }
      .zc-swatch.active { border-color: #6c5ce7; }
      .zc-slider { -webkit-appearance: none; height: 4px; border-radius: 2px; background: #444; outline: none; }
      .zc-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #6c5ce7; cursor: pointer; }
      .zc-checkbox { accent-color: #6c5ce7; }
    `;
    shadow.appendChild(styleEl);

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0, 0, 0, 0.6)",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif',
    });

    // Two-column container
    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      width: "92vw",
      maxWidth: "1080px",
      height: "85vh",
      maxHeight: "780px",
      borderRadius: "16px",
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
      background: "#1a1a2e",
    });

    // Left sidebar
    const sidebar = document.createElement("div");
    sidebar.className = "zc-sidebar";
    Object.assign(sidebar.style, {
      width: "280px",
      minWidth: "280px",
      background: "#1a1a2e",
      color: "#e0e0e0",
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid #333",
      overflowY: "auto",
    });

    // Right preview area
    const previewArea = document.createElement("div");
    Object.assign(previewArea.style, {
      flex: "1",
      background: "#2d2d44",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      position: "relative",
      overflow: "hidden",
    });

    const previewWrap = document.createElement("div");
    Object.assign(previewWrap.style, {
      width: "100%",
      flex: "1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "auto",
    });

    const loadingWrap = document.createElement("div");
    Object.assign(loadingWrap.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "80px 40px",
    });
    const spinner = document.createElement("div");
    Object.assign(spinner.style, {
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      border: "3px solid #444",
      borderTopColor: "#6c5ce7",
      animation: "zhihucard-spin 0.8s linear infinite",
    });
    const loadingText = document.createElement("div");
    Object.assign(loadingText.style, { fontSize: "14px", color: "#aaa" });
    loadingText.textContent = t("cardGeneratingText");
    loadingWrap.appendChild(spinner);
    loadingWrap.appendChild(loadingText);
    previewWrap.appendChild(loadingWrap);

    previewArea.appendChild(previewWrap);
    container.appendChild(sidebar);
    container.appendChild(previewArea);
    overlay.appendChild(container);
    shadow.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(host);
    });
    const escHandler = (e) => {
      if (e.key === "Escape") closeModal(host);
    };
    host.__zhihuEsc = escHandler;
    document.addEventListener("keydown", escHandler, true);

    return { host, shadow, overlay, container, sidebar, previewArea, previewWrap };
  }

  function finishModal(shell, data, options) {
    const { host, shadow, container, sidebar, previewArea, previewWrap } = shell;

    const state = {
      translatedText: null,
      style: VALID_STYLES.includes(options.style) ? options.style : "white",
      customBgs: options.customBgs || [],
      hideStats: !!options.hideStats,
      hideTime: !!options.hideTime,
      hideLink: !!options.hideLink,
      watermark: !!options.watermark,
      watermarkText: options.watermarkText || "ZhihuCard",
      watermarkOpacity: options.watermarkOpacity || 14,
      watermarkDensity: options.watermarkDensity || 100,
      presets: options.profilePresets || [],
      wallpaperCardTheme: (options.wallpaperCard && options.wallpaperCard.theme) || "white",
      wallpaperCardOpacity: (options.wallpaperCard && options.wallpaperCard.opacity) || 100,
      bgId: options.bgId || "aurora",
      paragraphGap: !!options.paragraphGap,
      imageLayout: options.imageLayout || "auto",
      autoSplit: options.autoSplit !== false,
      titleFontSize: options.titleFontSize || 22,
      bodyFontSize: options.bodyFontSize || 16,
      customAvatar: options.customAvatar || "",
      customNickname: options.customNickname || "",
      customSignature: options.customSignature || "",
      statsOverride: {
        likes: (options.likesCfg && options.likesCfg.likes) || 0,
        comments: (options.likesCfg && options.likesCfg.comments) || 0,
        bookmarks: (options.likesCfg && options.likesCfg.bookmarks) || 0,
        hearts: (options.likesCfg && options.likesCfg.hearts) || 0,
      },
      statsRanges: (options.likesCfg && options.likesCfg.ranges) || DEFAULT_STAT_RANGES,
      statsAutoRandom: !!options.statsAutoRandom,
      exportEl: null,
    };

    // 外部改动（如弹窗开关水印）时同步刷新卡片
    shell.host.__zhihuStorage = (changes) => {
      let dirty = false;
      if (changes.watermark) {
        const v = !!changes.watermark.newValue;
        if (v !== state.watermark) {
          state.watermark = v;
          if (state.watermarkCheckboxEl) state.watermarkCheckboxEl.checked = v;
          dirty = true;
        }
      }
      if (changes.watermarkText) {
        const v = typeof changes.watermarkText.newValue === "string" ? changes.watermarkText.newValue : "ZhihuCard";
        if (v !== state.watermarkText) {
          state.watermarkText = v;
          if (state.wmTextEl) state.wmTextEl.value = v;
          dirty = true;
        }
      }
      if (changes.watermarkOpacity) {
        const v = Number(changes.watermarkOpacity.newValue);
        if (isFinite(v) && v !== state.watermarkOpacity) {
          state.watermarkOpacity = v;
          if (state.wmOpSlider) state.wmOpSlider.value = String(v);
          if (state.wmOpVal) state.wmOpVal.textContent = `${v}%`;
          dirty = true;
        }
      }
      if (changes.watermarkDensity) {
        const v = Number(changes.watermarkDensity.newValue);
        if (isFinite(v) && v !== state.watermarkDensity) {
          state.watermarkDensity = v;
          if (state.wmDenSlider) state.wmDenSlider.value = String(v);
          if (state.wmDenVal) state.wmDenVal.textContent = `${v}%`;
          dirty = true;
        }
      }
      if (changes.profilePresets) {
        const list = Array.isArray(changes.profilePresets.newValue) ? changes.profilePresets.newValue : [];
        state.presets = list.slice(0, MAX_PROFILE_PRESETS);
        if (state.renderPresetsFn) state.renderPresetsFn();
      }
      if (changes.customNickname) {
        const v = typeof changes.customNickname.newValue === "string" ? changes.customNickname.newValue : "";
        if (v !== state.customNickname) {
          state.customNickname = v;
          if (state.nicknameInputEl) state.nicknameInputEl.value = v;
          dirty = true;
        }
      }
      if (changes.customSignature) {
        const v = typeof changes.customSignature.newValue === "string" ? changes.customSignature.newValue : "";
        if (v !== state.customSignature) {
          state.customSignature = v;
          if (state.signatureInputEl) state.signatureInputEl.value = v;
          dirty = true;
        }
      }
      if (changes.customAvatar) {
        const v = typeof changes.customAvatar.newValue === "string" ? changes.customAvatar.newValue : "";
        if (v !== state.customAvatar) {
          state.customAvatar = v;
          if (state.avatarPreviewPaint) state.avatarPreviewPaint();
          dirty = true;
        }
      }
      if (dirty) rebuildCard();
    };
    try { chrome.storage.onChanged.addListener(shell.host.__zhihuStorage); } catch (_) {}

    // ===== SIDEBAR BUILDER HELPERS =====
    function sidebarSection(title) {
      const sec = document.createElement("div");
      Object.assign(sec.style, { padding: "16px 16px 8px" });
      if (title) {
        const h = document.createElement("div");
        Object.assign(h.style, { fontSize: "11px", color: "#888", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "10px", textTransform: "uppercase" });
        h.textContent = title;
        sec.appendChild(h);
      }
      sidebar.appendChild(sec);
      return sec;
    }

    function sidebarCheckbox(labelText, checked, onChange) {
      const label = document.createElement("label");
      Object.assign(label.style, { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#ccc", cursor: "pointer", padding: "4px 0" });
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = checked; cb.className = "zc-checkbox";
      const span = document.createElement("span");
      span.textContent = labelText;
      label.appendChild(cb); label.appendChild(span);
      cb.addEventListener("change", () => { onChange(cb.checked); rebuildCard(); });
      return label;
    }

    function sidebarSlider(labelText, value, min, max, onChange) {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" });
      const lbl = document.createElement("span");
      Object.assign(lbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      lbl.textContent = labelText;
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = String(min); slider.max = String(max); slider.step = "1";
      slider.value = String(value); slider.className = "zc-slider";
      Object.assign(slider.style, { flex: "1", cursor: "pointer" });
      const val = document.createElement("span");
      Object.assign(val.style, { fontSize: "12px", color: "#6c5ce7", minWidth: "36px", textAlign: "right" });
      val.textContent = `${value}px`;
      slider.addEventListener("input", () => { val.textContent = `${slider.value}px`; });
      slider.addEventListener("change", () => { onChange(Number(slider.value)); rebuildCard(); });
      row.appendChild(lbl); row.appendChild(slider); row.appendChild(val);
      return row;
    }

    // ===== SIDEBAR: COLOR SCHEME =====
    const PALETTE_COLORS = {
      white: ["#ffffff", "#121212", "#0066ff"],
      dark: ["#1a1a1a", "#f0f0f0", "#4d94ff"],
      warm: ["#FAF3EB", "#5D4037", "#8D6E63"],
      cool: ["#F8FAFC", "#0F172A", "#3B82F6"],
      paper: ["#FDF6E3", "#073642", "#CB4B16"],
      minimal: ["#FFFFFF", "#111827", "#10B981"],
      cherry: ["#FFF5F7", "#E91E63", "#F48FB1"],
      tianya: ["#FBF7F0", "#6D4C41", "#8D6E63"],
      retro: ["#EDE8DF", "#4A3A35", "#7B9E87"],
      matcha: ["#F5F0E8", "#2E4A2B", "#6B8F5E"],
      chocolate: ["#F5EDE0", "#5C2E26", "#D4829A"],
      blueberry: ["#EDE9E2", "#1E3050", "#5B8BA0"],
      redTeal: ["#F0E6D8", "#B71C1C", "#1B5E4B"],
    };
    const STYLE_LABELS = {
      white: t("styleWhite"), dark: t("styleDark"), warm: t("styleWarm"),
      cool: t("styleCool"), paper: t("stylePaper"), minimal: t("styleMinimal"),
      cherry: t("styleCherry"), tianya: t("styleTianya"), retro: t("styleRetro"),
      matcha: t("styleMatcha"), chocolate: t("styleChocolate"),
      blueberry: t("styleBlueberry"), redTeal: t("styleRedTeal"),
      wallpaper: t("styleWallpaper"),
    };

    {
      const sec = sidebarSection(t("styleLabel"));
      const grid = document.createElement("div");
      Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" });

      VALID_STYLES.forEach((key) => {
        const card = document.createElement("div");
        const active = state.style === key;
        Object.assign(card.style, {
          padding: "6px", borderRadius: "8px", cursor: "pointer",
          border: active ? "2px solid #6c5ce7" : "2px solid transparent",
          background: active ? "rgba(108,92,231,0.1)" : "transparent",
          transition: "all 0.15s",
        });
        const colors = PALETTE_COLORS[key] || ["#fff", "#333", "#0066ff"];
        const swatches = document.createElement("div");
        Object.assign(swatches.style, { display: "flex", gap: "3px", marginBottom: "4px" });
        colors.forEach((c) => {
          const s = document.createElement("div");
          Object.assign(s.style, { width: "18px", height: "18px", borderRadius: "4px", background: c, border: "1px solid rgba(255,255,255,0.15)" });
          swatches.appendChild(s);
        });
        const lbl = document.createElement("div");
        Object.assign(lbl.style, { fontSize: "10px", color: "#aaa", textAlign: "center", lineHeight: "1.2" });
        lbl.textContent = STYLE_LABELS[key];
        card.appendChild(swatches); card.appendChild(lbl);
        card.addEventListener("click", () => {
          if (state.style === key) return;
          state.style = key;
          saveStyle(key);
          updateBgControlsVisibility();
          sidebar.querySelectorAll("[data-zc-style]").forEach((el) => {
            el.style.borderColor = el.dataset.zcStyle === key ? "#6c5ce7" : "transparent";
            el.style.background = el.dataset.zcStyle === key ? "rgba(108,92,231,0.1)" : "transparent";
          });
          rebuildCard();
        });
        card.dataset.zcStyle = key;
        grid.appendChild(card);
      });
      sec.appendChild(grid);
    }

    // wallpaper controls
    const bgControls = document.createElement("div");
    Object.assign(bgControls.style, { display: "none", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "8px" });

    const cardControls = document.createElement("div");
    Object.assign(cardControls.style, { display: "none", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "8px" });

    function updateBgControlsVisibility() {
      const vis = state.style === "wallpaper" ? "flex" : "none";
      bgControls.style.display = vis;
      cardControls.style.display = vis;
    }

    // wallpaper bg picker
    let bgExpanded = false;
    function buildBgThumb(item, allowDelete) {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, { position: "relative", flexShrink: "0" });
      const thumb = document.createElement("button");
      thumb.type = "button"; thumb.title = item.label;
      const selected = state.bgId === item.id;
      Object.assign(thumb.style, {
        width: "24px", height: "24px", borderRadius: "50%", display: "block",
        backgroundImage: `url("${item.url}")`, backgroundSize: "cover", backgroundPosition: "center",
        border: selected ? "2px solid #6c5ce7" : "2px solid transparent",
        boxShadow: selected ? "none" : "0 0 0 1px #555", padding: "0", cursor: "pointer",
      });
      thumb.addEventListener("click", () => {
        if (state.bgId === item.id) return;
        state.bgId = item.id; saveBackgroundId(item.id);
        renderBgThumbnails(); rebuildCard();
      });
      wrap.appendChild(thumb);
      if (allowDelete) {
        const del = document.createElement("button");
        del.type = "button"; del.title = t("deleteBgTitle"); del.textContent = "\u00d7";
        Object.assign(del.style, {
          position: "absolute", top: "-4px", right: "-4px", width: "14px", height: "14px",
          borderRadius: "50%", border: "1px solid #333", background: "#666", color: "#fff",
          fontSize: "10px", lineHeight: "12px", textAlign: "center", padding: "0", cursor: "pointer",
        });
        del.addEventListener("click", async (e) => {
          e.stopPropagation();
          const idx = parseInt(item.id.slice(7), 10);
          const wasSelected = state.bgId === item.id;
          const next = state.customBgs.slice(); next.splice(idx, 1);
          state.customBgs = next; await setCustomBackgrounds(next);
          if (wasSelected) { state.bgId = "aurora"; saveBackgroundId("aurora"); }
          renderBgThumbnails(); rebuildCard();
        });
        wrap.appendChild(del);
      }
      return wrap;
    }
    function renderBgThumbnails() {
      bgControls.innerHTML = "";
      const items = BUILTIN_BACKGROUNDS.map((b) => ({ id: b.id, label: b.name, url: builtinBackgroundUrl(b) }));
      items.forEach((item) => bgControls.appendChild(buildBgThumb(item, false)));
    }
    renderBgThumbnails();

    {
      const sec = sidebar.appendChild(document.createElement("div"));
      Object.assign(sec.style, { padding: "0 16px 8px" });
      sec.appendChild(bgControls);
    }

    // wallpaper card theme + opacity
    {
      const sec = sidebar.appendChild(document.createElement("div"));
      Object.assign(sec.style, { padding: "0 16px 8px" });
      sec.appendChild(cardControls);
      const lbl = document.createElement("span");
      Object.assign(lbl.style, { fontSize: "12px", color: "#888" });
      lbl.textContent = t("cardColorLabel");
      cardControls.appendChild(lbl);
      VALID_CARD_THEMES.forEach((key) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = key === "white" ? t("styleWhite") : t("styleDark");
        Object.assign(btn.style, {
          border: "none", borderRadius: "4px", padding: "3px 8px",
          fontSize: "11px", fontWeight: "600", cursor: "pointer",
          background: state.wallpaperCardTheme === key ? "#6c5ce7" : "#333",
          color: state.wallpaperCardTheme === key ? "#fff" : "#aaa",
        });
        btn.addEventListener("click", () => {
          state.wallpaperCardTheme = key;
          saveWallpaperCardSettings(key, state.wallpaperCardOpacity);
          rebuildCard();
        });
        cardControls.appendChild(btn);
      });
      const opRow = document.createElement("div");
      Object.assign(opRow.style, { display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" });
      const opLbl = document.createElement("span");
      Object.assign(opLbl.style, { fontSize: "12px", color: "#888" });
      opLbl.textContent = t("opacityLabel");
      const opSlider = document.createElement("input");
      opSlider.type = "range"; opSlider.min = "30"; opSlider.max = "100"; opSlider.step = "5";
      opSlider.value = String(state.wallpaperCardOpacity); opSlider.className = "zc-slider";
      Object.assign(opSlider.style, { width: "80px", cursor: "pointer" });
      const opVal = document.createElement("span");
      Object.assign(opVal.style, { fontSize: "11px", color: "#6c5ce7" });
      opVal.textContent = `${state.wallpaperCardOpacity}%`;
      opSlider.addEventListener("change", () => {
        state.wallpaperCardOpacity = clampCardOpacity(opSlider.value);
        opVal.textContent = `${state.wallpaperCardOpacity}%`;
        saveWallpaperCardSettings(state.wallpaperCardTheme, state.wallpaperCardOpacity);
        rebuildCard();
      });
      opRow.appendChild(opLbl); opRow.appendChild(opSlider); opRow.appendChild(opVal);
      cardControls.appendChild(opRow);
    }
    updateBgControlsVisibility();

    // ===== SIDEBAR: OPTIONS =====
    {
      const sec = sidebarSection(t("optionsLabel"));
      const wmLabel = sidebarCheckbox(t("watermarkLabel"), state.watermark, (v) => { state.watermark = v; saveWatermarkSetting(v); });
      sec.appendChild(wmLabel);
      state.watermarkCheckboxEl = wmLabel.querySelector("input");

      // 水印文字 + 透明度（满屏平铺）
      const wmTextRow = document.createElement("div");
      Object.assign(wmTextRow.style, { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" });
      const wmTextLbl = document.createElement("span");
      Object.assign(wmTextLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      wmTextLbl.textContent = t("watermarkTextLabel");
      const wmTextInput = document.createElement("input");
      wmTextInput.type = "text";
      wmTextInput.value = state.watermarkText;
      Object.assign(wmTextInput.style, {
        flex: "1", minWidth: "0", background: "#2d2d44", border: "1px solid #444",
        borderRadius: "6px", color: "#e0e0e0", fontSize: "13px", padding: "6px 8px", outline: "none",
      });
      let wmTextTimer = 0;
      wmTextInput.addEventListener("input", () => {
        state.watermarkText = wmTextInput.value;
        clearTimeout(wmTextTimer);
        wmTextTimer = setTimeout(() => { saveWatermarkText(state.watermarkText); rebuildCard(); }, 400);
      });
      state.wmTextEl = wmTextInput;
      wmTextRow.appendChild(wmTextLbl); wmTextRow.appendChild(wmTextInput);
      sec.appendChild(wmTextRow);

      const wmOpRow = document.createElement("div");
      Object.assign(wmOpRow.style, { display: "flex", alignItems: "center", gap: "6px", padding: "4px 0" });
      const wmOpLbl = document.createElement("span");
      Object.assign(wmOpLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      wmOpLbl.textContent = t("watermarkOpacityLabel");
      const wmOpSlider = document.createElement("input");
      wmOpSlider.type = "range"; wmOpSlider.min = "2"; wmOpSlider.max = "60"; wmOpSlider.step = "1";
      wmOpSlider.value = String(state.watermarkOpacity); wmOpSlider.className = "zc-slider";
      Object.assign(wmOpSlider.style, { flex: "1", cursor: "pointer" });
      const wmOpVal = document.createElement("span");
      Object.assign(wmOpVal.style, { fontSize: "11px", color: "#6c5ce7", minWidth: "34px", textAlign: "right" });
      wmOpVal.textContent = `${state.watermarkOpacity}%`;
      wmOpSlider.addEventListener("input", () => { wmOpVal.textContent = `${wmOpSlider.value}%`; });
      wmOpSlider.addEventListener("change", () => {
        state.watermarkOpacity = Math.min(60, Math.max(2, Number(wmOpSlider.value) || 14));
        wmOpVal.textContent = `${state.watermarkOpacity}%`;
        saveWatermarkOpacity(state.watermarkOpacity);
        rebuildCard();
      });
      wmOpRow.appendChild(wmOpLbl); wmOpRow.appendChild(wmOpSlider); wmOpRow.appendChild(wmOpVal);
      sec.appendChild(wmOpRow);
      state.wmOpSlider = wmOpSlider; state.wmOpVal = wmOpVal;

      const wmDenRow = document.createElement("div");
      Object.assign(wmDenRow.style, { display: "flex", alignItems: "center", gap: "6px", padding: "4px 0" });
      const wmDenLbl = document.createElement("span");
      Object.assign(wmDenLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      wmDenLbl.textContent = t("watermarkDensityLabel");
      const wmDenSlider = document.createElement("input");
      wmDenSlider.type = "range"; wmDenSlider.min = "40"; wmDenSlider.max = "220"; wmDenSlider.step = "5";
      wmDenSlider.value = String(state.watermarkDensity); wmDenSlider.className = "zc-slider";
      Object.assign(wmDenSlider.style, { flex: "1", cursor: "pointer" });
      const wmDenVal = document.createElement("span");
      Object.assign(wmDenVal.style, { fontSize: "11px", color: "#6c5ce7", minWidth: "34px", textAlign: "right" });
      wmDenVal.textContent = `${state.watermarkDensity}%`;
      wmDenSlider.addEventListener("input", () => { wmDenVal.textContent = `${wmDenSlider.value}%`; });
      wmDenSlider.addEventListener("change", () => {
        state.watermarkDensity = Math.min(220, Math.max(40, Number(wmDenSlider.value) || 100));
        wmDenVal.textContent = `${state.watermarkDensity}%`;
        saveWatermarkDensity(state.watermarkDensity);
        rebuildCard();
      });
      wmDenRow.appendChild(wmDenLbl); wmDenRow.appendChild(wmDenSlider); wmDenRow.appendChild(wmDenVal);
      sec.appendChild(wmDenRow);
      state.wmDenSlider = wmDenSlider; state.wmDenVal = wmDenVal;

      sec.appendChild(sidebarCheckbox(t("hideStatsLabel"), state.hideStats, (v) => { state.hideStats = v; saveHideStats(v); }));
      sec.appendChild(sidebarCheckbox(t("hideTimeLabel"), state.hideTime, (v) => { state.hideTime = v; saveHideTime(v); }));
      sec.appendChild(sidebarCheckbox(t("hideLinkLabel"), state.hideLink, (v) => { state.hideLink = v; saveHideLink(v); }));
      sec.appendChild(sidebarCheckbox(t("paragraphGapLabel"), state.paragraphGap, (v) => { state.paragraphGap = v; saveParagraphGap(v); }));

      // 图片布局：自动 / 单列 / 多列
      const layoutRow = document.createElement("div");
      Object.assign(layoutRow.style, { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" });
      const layoutLbl = document.createElement("span");
      Object.assign(layoutLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      layoutLbl.textContent = t("imageLayoutLabel");
      const layoutSelect = document.createElement("select");
      Object.assign(layoutSelect.style, {
        flex: "1", minWidth: "0", background: "#2d2d44", border: "1px solid #444",
        borderRadius: "6px", color: "#e0e0e0", fontSize: "13px", padding: "6px 8px", outline: "none",
      });
      [["auto", t("imageLayoutAuto")], ["single", t("imageLayoutSingle")], ["multi", t("imageLayoutMulti")]].forEach(([val, text]) => {
        const opt = document.createElement("option");
        opt.value = val; opt.textContent = text;
        layoutSelect.appendChild(opt);
      });
      layoutSelect.value = state.imageLayout;
      layoutSelect.addEventListener("change", () => {
        state.imageLayout = layoutSelect.value;
        saveImageLayout(state.imageLayout);
        rebuildCard();
      });
      layoutRow.appendChild(layoutLbl); layoutRow.appendChild(layoutSelect);
      sec.appendChild(layoutRow);

      // 长图自动切 4 张
      sec.appendChild(sidebarCheckbox(t("autoSplitLabel"), state.autoSplit, (v) => { state.autoSplit = v; saveAutoSplit(v); }));
    }

    // ===== SIDEBAR: ENGAGEMENT STATS =====
    {
      const sec = sidebarSection(t("statsLabel"));
      Object.assign(sec.style, { paddingBottom: "12px" });

      function makeBtn(text, primary) {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = text;
        Object.assign(b.style, {
          cursor: "pointer", fontSize: "12px", fontWeight: "600",
          color: primary ? "#fff" : "#aaa",
          background: primary ? "#6c5ce7" : "transparent",
          border: primary ? "none" : "1px solid #555",
          borderRadius: "6px", padding: "5px 10px", flexShrink: "0",
        });
        return b;
      }
      function makeNumInput(value, width) {
        const inp = document.createElement("input");
        inp.type = "number"; inp.min = "0"; inp.step = "1";
        inp.value = value > 0 ? String(value) : "";
        inp.placeholder = t("likesOriginalLabel");
        Object.assign(inp.style, {
          width: width, background: "#2d2d44", border: "1px solid #444",
          borderRadius: "6px", color: "#e0e0e0", fontSize: "12px", padding: "5px 4px", outline: "none",
        });
        return inp;
      }

      const rowStyle = { display: "flex", alignItems: "center", gap: "4px", padding: "3px 0" };
      const labelStyle = { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap", width: "34px", flexShrink: "0" };
      const sepStyle = { fontSize: "12px", color: "#888", flexShrink: "0" };

      // 每个指标一行：[标签] [最小] – [最大](万) [数值]
      const statControls = {};
      STAT_KEYS.forEach((key) => {
        const row = document.createElement("div");
        Object.assign(row.style, rowStyle);

        const lbl = document.createElement("span");
        Object.assign(lbl.style, labelStyle);
        lbl.textContent = t("stat_" + key);

        const range = state.statsRanges[key];
        const minInput = makeNumInput(0, "44px");
        minInput.value = range[0] > 0 ? String(range[0]) : "0";
        minInput.placeholder = "0";
        const sep = document.createElement("span");
        Object.assign(sep.style, sepStyle);
        sep.textContent = "–";
        const maxInput = makeNumInput(0, "44px");
        maxInput.value = range[1] > 0 ? String(range[1]) : "0";
        maxInput.placeholder = "0";

        const unit = document.createElement("span");
        Object.assign(unit.style, { fontSize: "11px", color: "#888", flexShrink: "0" });
        unit.textContent = key === "likes" ? "万" : "";

        const valueInput = makeNumInput(state.statsOverride[key], "62px");

        function commitRange() {
          let lo = Number(minInput.value); let hi = Number(maxInput.value);
          if (!isFinite(lo) || lo < 0) lo = 0;
          if (!isFinite(hi) || hi < 0) hi = 0;
          if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
          minInput.value = String(lo); maxInput.value = String(hi);
          state.statsRanges[key] = [lo, hi];
          saveStatsRanges(state.statsRanges);
        }
        minInput.addEventListener("change", commitRange);
        maxInput.addEventListener("change", commitRange);

        valueInput.addEventListener("change", () => {
          state.statsOverride[key] = Math.max(0, Math.round(Number(valueInput.value) || 0));
          valueInput.value = state.statsOverride[key] > 0 ? String(state.statsOverride[key]) : "";
          saveStatsOverride(state.statsOverride);
          rebuildCard();
        });

        statControls[key] = { minInput, maxInput, valueInput };

        row.appendChild(lbl);
        row.appendChild(minInput);
        row.appendChild(sep);
        row.appendChild(maxInput);
        row.appendChild(unit);
        row.appendChild(valueInput);
        sec.appendChild(row);
      });

      const hint = document.createElement("div");
      Object.assign(hint.style, { fontSize: "11px", color: "#888", marginTop: "4px" });
      hint.textContent = t("statsRangeHint");
      sec.appendChild(hint);

      const btnRow = document.createElement("div");
      Object.assign(btnRow.style, { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" });
      const randBtn = makeBtn(t("likesRandomBtn"), true);
      function randomizeStats(persist) {
        STAT_KEYS.forEach((key) => {
          const ctl = statControls[key];
          let lo = Number(ctl.minInput.value); let hi = Number(ctl.maxInput.value);
          if (!isFinite(lo) || lo < 0) lo = 0;
          if (!isFinite(hi) || hi < 0) hi = 0;
          if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
          ctl.minInput.value = String(lo); ctl.maxInput.value = String(hi);
          state.statsRanges[key] = [lo, hi];
          const factor = key === "likes" ? 10000 : 1;
          const loN = Math.round(lo * factor);
          const hiN = Math.round(hi * factor);
          state.statsOverride[key] = loN + Math.floor(Math.random() * (hiN - loN + 1));
          ctl.valueInput.value = state.statsOverride[key] > 0 ? String(state.statsOverride[key]) : "";
        });
        if (persist !== false) {
          saveStatsRanges(state.statsRanges);
          saveStatsOverride(state.statsOverride);
          rebuildCard();
        }
      }
      randBtn.addEventListener("click", () => { randomizeStats(true); });
      const resetBtn = makeBtn(t("likesResetBtn"), false);
      resetBtn.addEventListener("click", () => {
        STAT_KEYS.forEach((key) => {
          state.statsOverride[key] = 0;
          statControls[key].valueInput.value = "";
        });
        saveStatsOverride(state.statsOverride);
        rebuildCard();
      });
      btnRow.appendChild(randBtn);
      btnRow.appendChild(resetBtn);
      sec.appendChild(btnRow);

      // 打开时自动随机
      sec.appendChild(sidebarCheckbox(t("statsAutoRandomLabel"), state.statsAutoRandom, (v) => {
        state.statsAutoRandom = v;
        saveStatsAutoRandom(v);
        if (v) randomizeStats(true);
      }));
      if (state.statsAutoRandom) randomizeStats(true);
    }

    // ===== SIDEBAR: FONT SIZE =====
    {
      const sec = sidebarSection(t("fontSizeLabel"));
      sec.appendChild(sidebarSlider(t("titleFontSizeLabel"), state.titleFontSize, 14, 72, (v) => { state.titleFontSize = v; saveTitleFontSize(v); }));
      sec.appendChild(sidebarSlider(t("bodyFontSizeLabel"), state.bodyFontSize, 12, 48, (v) => { state.bodyFontSize = v; saveBodyFontSize(v); }));
    }

    // ===== SIDEBAR: EDIT TEXT =====
    {
      const sec = sidebarSection(t("editTextLabel"));
      const originalText = data.text || "";
      const originalTitle = data.title || "";

      // 标题编辑
      const titleRow = document.createElement("div");
      Object.assign(titleRow.style, { display: "flex", alignItems: "center", gap: "8px", padding: "0 0 8px" });
      const titleLbl = document.createElement("span");
      Object.assign(titleLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      titleLbl.textContent = t("editTitleLabel");
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.value = originalTitle;
      titleInput.placeholder = t("editTitlePlaceholder");
      Object.assign(titleInput.style, {
        flex: "1", minWidth: "0", background: "#2d2d44", border: "1px solid #444",
        borderRadius: "6px", color: "#e0e0e0", fontSize: "13px", padding: "6px 8px", outline: "none",
      });
      let titleTimer = 0;
      titleInput.addEventListener("input", () => {
        clearTimeout(titleTimer);
        titleTimer = setTimeout(() => { data.title = titleInput.value; rebuildCard(); }, 400);
      });
      titleInput.addEventListener("change", () => { data.title = titleInput.value; rebuildCard(); });
      titleRow.appendChild(titleLbl); titleRow.appendChild(titleInput);
      sec.appendChild(titleRow);

      const ta = document.createElement("textarea");
      ta.value = originalText;
      ta.placeholder = t("editTextPlaceholder");
      Object.assign(ta.style, {
        width: "100%", boxSizing: "border-box", minHeight: "140px", resize: "vertical",
        background: "#2d2d44", border: "1px solid #444", borderRadius: "6px",
        color: "#e0e0e0", fontSize: "13px", lineHeight: "1.6", padding: "8px 10px", outline: "none",
      });
      sec.appendChild(ta);

      const btnRow = document.createElement("div");
      Object.assign(btnRow.style, { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" });

      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.textContent = t("editRestoreBtn");
      Object.assign(restoreBtn.style, {
        cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#aaa",
        background: "transparent", border: "1px solid #555", borderRadius: "6px", padding: "6px 10px",
      });
      restoreBtn.addEventListener("click", () => {
        ta.value = originalText;
        data.text = originalText;
        titleInput.value = originalTitle;
        data.title = originalTitle;
        if (state.translatedText) {
          state.translatedText = null;
          if (state.translateCheckbox) state.translateCheckbox.checked = false;
        }
        rebuildCard();
      });

      const hint = document.createElement("span");
      Object.assign(hint.style, { fontSize: "11px", color: "#888" });
      hint.textContent = t("editHint");

      btnRow.appendChild(restoreBtn);
      btnRow.appendChild(hint);
      sec.appendChild(btnRow);

      let editTimer = 0;
      ta.addEventListener("input", () => {
        clearTimeout(editTimer);
        editTimer = setTimeout(() => {
          data.text = ta.value;
          if (state.translatedText) {
            state.translatedText = null;
            if (state.translateCheckbox) state.translateCheckbox.checked = false;
          }
          rebuildCard();
        }, 400);
      });
    }

    // ===== SIDEBAR: CUSTOM PROFILE =====
    {
      const sec = sidebarSection(t("customProfileLabel"));

      const nickRow = document.createElement("div");
      Object.assign(nickRow.style, { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" });
      const nickLbl = document.createElement("span");
      Object.assign(nickLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      nickLbl.textContent = t("customNicknameLabel");
      const nickInput = document.createElement("input");
      nickInput.type = "text";
      nickInput.value = state.customNickname || data.author || "";
      nickInput.placeholder = t("customNicknamePlaceholder");
      Object.assign(nickInput.style, {
        flex: "1", minWidth: "0", background: "#2d2d44", border: "1px solid #444",
        borderRadius: "6px", color: "#e0e0e0", fontSize: "13px", padding: "6px 8px", outline: "none",
      });
      let nickTimer = 0;
      nickInput.addEventListener("input", () => {
        state.customNickname = nickInput.value;
        clearTimeout(nickTimer);
        nickTimer = setTimeout(() => saveCustomNickname(state.customNickname), 400);
      });
      nickInput.addEventListener("change", () => {
        state.customNickname = nickInput.value;
        saveCustomNickname(state.customNickname);
        rebuildCard();
      });
      nickRow.appendChild(nickLbl); nickRow.appendChild(nickInput);
      sec.appendChild(nickRow);
      state.nicknameInputEl = nickInput;

      const sigRow = document.createElement("div");
      Object.assign(sigRow.style, { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" });
      const sigLbl = document.createElement("span");
      Object.assign(sigLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      sigLbl.textContent = t("customSignatureLabel");
      const sigInput = document.createElement("input");
      sigInput.type = "text";
      sigInput.value = state.customSignature || data.authorHeadline || "";
      sigInput.placeholder = t("customSignaturePlaceholder");
      Object.assign(sigInput.style, {
        flex: "1", minWidth: "0", background: "#2d2d44", border: "1px solid #444",
        borderRadius: "6px", color: "#e0e0e0", fontSize: "13px", padding: "6px 8px", outline: "none",
      });
      let sigTimer = 0;
      sigInput.addEventListener("input", () => {
        state.customSignature = sigInput.value;
        clearTimeout(sigTimer);
        sigTimer = setTimeout(() => saveCustomSignature(state.customSignature), 400);
      });
      sigInput.addEventListener("change", () => {
        state.customSignature = sigInput.value;
        saveCustomSignature(state.customSignature);
        rebuildCard();
      });
      sigRow.appendChild(sigLbl); sigRow.appendChild(sigInput);
      sec.appendChild(sigRow);
      state.signatureInputEl = sigInput;

      const avatarRow = document.createElement("div");
      Object.assign(avatarRow.style, { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", marginTop: "4px", flexWrap: "wrap" });
      const avatarLbl = document.createElement("span");
      Object.assign(avatarLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      avatarLbl.textContent = t("customAvatarLabel");

      const preview = document.createElement("img");
      preview.alt = "";
      Object.assign(preview.style, {
        width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover",
        background: "#2d2d44", border: "1px solid #444", flexShrink: "0",
      });
      const defaultAvatar = data.avatar || "";
      function paintAvatarPreview() {
        const src = state.customAvatar || defaultAvatar;
        if (src) preview.src = src;
        else preview.removeAttribute("src");
      }
      preview.addEventListener("error", () => {
        const alt = state.customAvatar ? defaultAvatar : "";
        if (alt && preview.getAttribute("src") !== alt) preview.src = alt;
        else if (!alt) preview.removeAttribute("src");
      });
      paintAvatarPreview();
      state.avatarPreviewPaint = paintAvatarPreview;

      const uploadBtn = document.createElement("label");
      uploadBtn.textContent = t("customAvatarUpload");
      Object.assign(uploadBtn.style, {
        cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#fff",
        background: "#6c5ce7", borderRadius: "6px", padding: "6px 10px", flexShrink: "0",
      });
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      uploadBtn.appendChild(fileInput);
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          const dataUrl = await resizeImageFileToDataUrl(file, 512);
          state.customAvatar = dataUrl;
          saveCustomAvatar(dataUrl);
          paintAvatarPreview();
          rebuildCard();
        } catch (_) {
          // ignore upload failures
        }
      });

      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.textContent = t("customAvatarClear");
      Object.assign(clearBtn.style, {
        cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#aaa",
        background: "transparent", border: "1px solid #555", borderRadius: "6px",
        padding: "6px 10px", flexShrink: "0",
      });
      clearBtn.addEventListener("click", () => {
        // 恢复默认用户：头像/昵称/签名全部回原作者默认值
        state.customAvatar = "";
        state.customNickname = "";
        state.customSignature = "";
        saveCustomAvatar("");
        saveCustomNickname("");
        saveCustomSignature("");
        if (state.nicknameInputEl) state.nicknameInputEl.value = data.author || "";
        if (state.signatureInputEl) state.signatureInputEl.value = data.authorHeadline || "";
        paintAvatarPreview();
        rebuildCard();
      });

      avatarRow.appendChild(avatarLbl);
      avatarRow.appendChild(preview);
      avatarRow.appendChild(uploadBtn);
      avatarRow.appendChild(clearBtn);
      sec.appendChild(avatarRow);

      // ----- 预设用户（最多 5 个，点头像一键切换） -----
      const presetRow = document.createElement("div");
      Object.assign(presetRow.style, { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0 2px", flexWrap: "wrap" });
      const presetLbl = document.createElement("span");
      Object.assign(presetLbl.style, { fontSize: "13px", color: "#ccc", whiteSpace: "nowrap" });
      presetLbl.textContent = t("presetsLabel");
      presetRow.appendChild(presetLbl);
      sec.appendChild(presetRow);

      const presetStrip = document.createElement("div");
      Object.assign(presetStrip.style, { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" });
      sec.appendChild(presetStrip);

      const presetHint = document.createElement("div");
      Object.assign(presetHint.style, { fontSize: "11px", color: "#888", marginTop: "6px" });
      presetHint.textContent = t("presetHint");
      sec.appendChild(presetHint);

      function flashHint(msg, ok) {
        presetHint.textContent = msg;
        presetHint.style.color = ok ? "#6c5ce7" : "#e06c75";
        clearTimeout(presetHint.__timer);
        presetHint.__timer = setTimeout(() => {
          presetHint.textContent = t("presetHint");
          presetHint.style.color = "#888";
        }, 2200);
      }

      function applyPreset(p) {
        state.customNickname = p.nickname || "";
        state.customSignature = p.signature || "";
        state.customAvatar = p.avatar || "";
        saveCustomNickname(state.customNickname);
        saveCustomSignature(state.customSignature);
        saveCustomAvatar(state.customAvatar);
        if (state.nicknameInputEl) state.nicknameInputEl.value = state.customNickname || data.author || "";
        if (state.signatureInputEl) state.signatureInputEl.value = state.customSignature || data.authorHeadline || "";
        paintAvatarPreview();
        rebuildCard();
        renderPresets();
      }

      function renderPresets() {
        presetStrip.innerHTML = "";
        state.presets.forEach((p, idx) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.title = p.nickname || t("presetChipTitle");
          const isActive = p.nickname === (state.customNickname || "").trim()
            && p.signature === (state.customSignature || "").trim()
            && p.avatar === (state.customAvatar || "");
          Object.assign(chip.style, {
            width: "34px", height: "34px", borderRadius: "50%", padding: "0",
            border: isActive ? "2px solid #6c5ce7" : "2px solid #444",
            background: "#2d2d44", cursor: "pointer", flexShrink: "0",
            backgroundImage: p.avatar ? `url("${p.avatar}")` : "none",
            backgroundSize: "cover", backgroundPosition: "center",
            fontSize: "13px", fontWeight: "700", color: "#ccc", lineHeight: "30px",
          });
          if (!p.avatar) chip.textContent = (p.nickname || "?").trim().slice(0, 1) || "?";
          chip.addEventListener("click", () => applyPreset(p));
          chip.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            state.presets.splice(idx, 1);
            saveProfilePresets(state.presets);
            renderPresets();
            flashHint(t("presetDeletedText"), true);
          });
          presetStrip.appendChild(chip);
        });
      }
      renderPresets();
      state.renderPresetsFn = renderPresets;

      const savePresetBtn = document.createElement("button");
      savePresetBtn.type = "button";
      savePresetBtn.textContent = t("presetSaveBtn");
      Object.assign(savePresetBtn.style, {
        cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#fff",
        background: "#6c5ce7", border: "none", borderRadius: "6px", padding: "6px 12px",
      });
      savePresetBtn.addEventListener("click", () => {
        const nickname = (state.customNickname || "").trim();
        const signature = (state.customSignature || "").trim();
        const avatar = state.customAvatar || "";
        if (!nickname && !signature && !avatar) {
          flashHint(t("presetEmptyText"), false);
          return;
        }
        const preset = { nickname, signature, avatar };
        const dup = state.presets.findIndex((p) =>
          p.nickname === preset.nickname && p.signature === preset.signature && p.avatar === preset.avatar);
        if (dup >= 0) state.presets.splice(dup, 1);
        if (state.presets.length >= MAX_PROFILE_PRESETS) state.presets.shift();
        state.presets.push(preset);
        saveProfilePresets(state.presets);
        renderPresets();
        flashHint(t("presetSavedText"), true);
      });
      presetRow.appendChild(savePresetBtn);
    }

    // ===== SIDEBAR: TRANSLATE =====
    {
      const sec = sidebarSection();
      const statusText = document.createElement("span");
      Object.assign(statusText.style, { fontSize: "11px", color: "#888" });
      const label = document.createElement("label");
      Object.assign(label.style, { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#ccc", cursor: "pointer", padding: "4px 0" });
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox"; checkbox.className = "zc-checkbox";
      state.translateCheckbox = checkbox;
      const span = document.createElement("span");
      span.textContent = t("translateLabel");
      label.appendChild(checkbox); label.appendChild(span);
      checkbox.addEventListener("change", async () => {
        if (checkbox.checked) {
          statusText.textContent = t("translatingText");
          try {
            const res = await chrome.runtime.sendMessage({ type: "translate", text: data.text, target: translateTargetLang(data.text) });
            if (res && res.ok) { state.translatedText = res.text; statusText.textContent = ""; }
            else { statusText.textContent = t("translateFailedText"); checkbox.checked = false; }
          } catch (_) { statusText.textContent = t("translateFailedText"); checkbox.checked = false; }
        } else { state.translatedText = null; statusText.textContent = ""; }
        rebuildCard();
      });
      sec.appendChild(label); sec.appendChild(statusText);
    }

    // ===== SIDEBAR: ACTIONS =====
    {
      const sec = sidebar.appendChild(document.createElement("div"));
      Object.assign(sec.style, { padding: "16px", marginTop: "auto" });
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", gap: "8px", flexWrap: "wrap" });

      function makeActionBtn(text, primary) {
        const btn = document.createElement("button");
        btn.type = "button"; btn.textContent = text;
        Object.assign(btn.style, {
          border: primary ? "none" : "1px solid #555",
          background: primary ? "#6c5ce7" : "transparent",
          color: primary ? "#fff" : "#ccc",
          borderRadius: "8px", padding: "8px 14px",
          fontSize: "13px", fontWeight: "600", cursor: "pointer", flex: "1",
        });
        return btn;
      }

      const copyBtn = makeActionBtn(t("copyImageButton"), true);
      copyBtn.addEventListener("click", async () => {
        copyBtn.disabled = true; copyBtn.textContent = t("downloadGeneratingText");
        try {
          const blobPromise = window.ZhihuCard.renderCardToPng(state.exportEl, 2).then((r) => r.blob);
          let items;
          try { items = [new ClipboardItem({ "image/png": blobPromise })]; }
          catch (_) { items = [new ClipboardItem({ "image/png": await blobPromise })]; }
          await navigator.clipboard.write(items);
          copyBtn.textContent = t("copiedText");
        } catch (e) { copyBtn.textContent = t("copyFailedText"); }
        setTimeout(() => { copyBtn.textContent = t("copyImageButton"); copyBtn.disabled = false; }, 1500);
      });

      const downloadBtn = makeActionBtn(t("downloadPngButton"), false);
      downloadBtn.addEventListener("click", async () => {
        downloadBtn.textContent = t("downloadGeneratingText"); downloadBtn.disabled = true;
        try {
          const { canvas, dataUrl } = await window.ZhihuCard.renderCardToPng(state.exportEl, 2);
          const cssH = canvas.height / 2;
          if (state.autoSplit && cssH > SPLIT_THRESHOLD_CSS) {
            const cuts = measureSafeCuts(state.exportEl, cssH, SPLIT_MAX);
            const slices = sliceCanvas(canvas, cuts, 2, state.exportEl);
            const base = buildFilename(data.author).replace(/\.png$/i, "");
            for (let i = 0; i < slices.length; i++) {
              const url = slices[i].toDataURL("image/png");
              const a = document.createElement("a");
              a.href = url;
              a.download = `${base}-${i + 1}of${slices.length}.png`;
              a.click();
              await new Promise((r) => setTimeout(r, 400));
            }
          } else {
            const a = document.createElement("a"); a.href = dataUrl; a.download = buildFilename(data.author); a.click();
          }
        } catch (e) { downloadBtn.textContent = t("renderFailedText"); setTimeout(() => { downloadBtn.textContent = t("downloadPngButton"); downloadBtn.disabled = false; }, 1500); return; }
        downloadBtn.textContent = t("downloadPngButton"); downloadBtn.disabled = false;
      });

      const closeBtn = makeActionBtn(t("closeButton"), false);
      closeBtn.addEventListener("click", () => closeModal(host));

      row.appendChild(copyBtn); row.appendChild(downloadBtn); row.appendChild(closeBtn);
      sec.appendChild(row);
    }

    // ===== SIDEBAR: LANGUAGE TOGGLE =====
    {
      const sec = sidebar.appendChild(document.createElement("div"));
      Object.assign(sec.style, { padding: "8px 16px 16px" });
      const langBtn = document.createElement("button");
      langBtn.type = "button";
      langBtn.textContent = uiLanguageIsChinese() ? "EN" : "\u4e2d";
      Object.assign(langBtn.style, {
        border: "1px solid #444", background: "transparent", color: "#aaa",
        borderRadius: "4px", padding: "4px 10px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
      });
      langBtn.addEventListener("click", () => {
        saveUiLang(uiLanguageIsChinese() ? "en" : "zh");
        closeModal(host); handleGenerateClick(options.pageType);
      });
      sec.appendChild(langBtn);
    }

    // ===== PREVIEW =====
    let updateScrollHint = () => {};

    async function buildExportEl(cardData, cardOptions) {
      const theme = state.style === "wallpaper" ? state.wallpaperCardTheme : state.style;
      const card = window.ZhihuCard.buildCard(cardData, Object.assign({ theme }, cardOptions));
      await waitForImages(card);
      window.ZhihuCard.finalizeMediaLayout(card);
      if (state.style !== "wallpaper") return card;
      if (state.wallpaperCardOpacity < 100) {
        const alpha = state.wallpaperCardOpacity / 100;
        card.style.backgroundColor = state.wallpaperCardTheme === "dark" ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
      }
      const stage = document.createElement("div");
      Object.assign(stage.style, { position: "fixed", left: "-9999px", top: "0" });
      stage.appendChild(card); document.body.appendChild(stage);
      const bgUrl = resolveBackgroundUrl(state.bgId, state.customBgs);
      const frame = window.ZhihuCard.buildWallpaperFrame(card, bgUrl);
      document.body.removeChild(stage);
      return frame;
    }

    function renderScaledPreview(exportEl, viewport) {
      const previewClone = exportEl.cloneNode(true);
      const probe = document.createElement("div");
      Object.assign(probe.style, { position: "fixed", left: "-9999px", top: "0" });
      probe.appendChild(previewClone); document.body.appendChild(probe);
      const rect = previewClone.getBoundingClientRect();
      const naturalWidth = rect.width, naturalHeight = rect.height;
      document.body.removeChild(probe);
      const viewportRect = viewport.getBoundingClientRect();
      const scale = Math.min((viewportRect.width - 40) / naturalWidth, (viewportRect.height - 40) / naturalHeight, 1);
      const scaledWrapper = document.createElement("div");
      Object.assign(scaledWrapper.style, {
        width: `${naturalWidth * scale}px`, height: `${naturalHeight * scale}px`,
        flexShrink: "0", cursor: "zoom-in", overflow: "hidden",
      });
      Object.assign(previewClone.style, { transform: `scale(${scale})`, transformOrigin: "top left" });
      scaledWrapper.appendChild(previewClone);
      scaledWrapper.addEventListener("click", () => openZoomOverlay(exportEl));
      viewport.appendChild(scaledWrapper);
    }

    function openZoomOverlay(exportEl) {
      document.removeEventListener("keydown", host.__zhihuEsc, true);
      const zoomHost = document.createElement("div");
      Object.assign(zoomHost.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)",
        zIndex: "2147483647", display: "flex", justifyContent: "center",
        alignItems: "flex-start", overflow: "auto", cursor: "zoom-out", padding: "40px", boxSizing: "border-box",
      });
      const zoomClone = exportEl.cloneNode(true);
      zoomClone.style.cursor = "zoom-out"; zoomClone.style.flexShrink = "0";
      zoomHost.appendChild(zoomClone);
      function close() {
        if (zoomHost.parentNode) zoomHost.parentNode.removeChild(zoomHost);
        document.removeEventListener("keydown", escHandler, true);
        document.addEventListener("keydown", host.__zhihuEsc, true);
      }
      zoomHost.addEventListener("click", close);
      const escHandler = (e) => { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", escHandler, true);
      shadow.appendChild(zoomHost);
    }

    let rebuildSeq = 0;
    async function rebuildCard() {
      const seq = ++rebuildSeq;
      const cardData = Object.assign({}, data, {
        translatedText: state.translatedText,
        author: (state.customNickname || "").trim() || data.author,
        avatar: state.customAvatar || data.avatar,
        authorHeadline: (state.customSignature || "").trim() || data.authorHeadline,
      });
      if (STAT_KEYS.some((k) => state.statsOverride[k] > 0)) {
        const merged = Object.assign({}, data.stats || {});
        STAT_KEYS.forEach((k) => { if (state.statsOverride[k] > 0) merged[k] = state.statsOverride[k]; });
        cardData.stats = merged;
      }
      const cardOptions = {
        watermark: state.watermark,
        watermarkText: state.watermarkText,
        watermarkOpacity: state.watermarkOpacity,
        watermarkDensity: state.watermarkDensity,
        hideStats: state.hideStats,
        hideTime: state.hideTime, hideLink: state.hideLink,
        paragraphGap: state.paragraphGap, titleFontSize: state.titleFontSize,
        bodyFontSize: state.bodyFontSize, locale: effectiveLocale(),
        imageLayout: state.imageLayout,
      };
      const exportEl = await buildExportEl(cardData, cardOptions);
      if (seq !== rebuildSeq || !host.isConnected) return;
      previewWrap.innerHTML = "";
      state.exportEl = exportEl;
      host.__zhihuExportEl = state.exportEl;
      const viewport = document.createElement("div");
      Object.assign(viewport.style, {
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
      });
      previewWrap.appendChild(viewport);
      renderScaledPreview(state.exportEl, viewport);
    }
    rebuildCard();
  }
})();
