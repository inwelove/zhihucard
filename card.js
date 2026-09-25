// ZhihuCard card template builder.
// Builds a fully inline-styled DOM tree for a single Zhihu article/answer card.
// Every style is set inline so render.js can serialize the node into an SVG
// <foreignObject> without losing any styling.
//
// Exposed as window.ZhihuCard.buildCard(data, options) and
// window.ZhihuCard.buildWallpaperFrame(cardEl, backgroundUrl).

(() => {
  "use strict";

  const PALETTES = {
    white: {
      bg: "#ffffff",
      text: "#1a1a1a",
      subtle: "#8590a6",
      hairline: "#ebebeb",
      watermark: "#a0a0a0",
      accent: "#0066ff",
      titleColor: "#121212",
      tagBg: "#f0f6ff",
      tagText: "#0066ff",
      avatarFallbackBg: "#e8e8e8",
      avatarFallbackFg: "#999999",
    },
    dark: {
      bg: "#1a1a1a",
      text: "#e0e0e0",
      subtle: "#8590a6",
      hairline: "#333333",
      watermark: "#666666",
      accent: "#4d94ff",
      titleColor: "#f0f0f0",
      tagBg: "#1a2a3a",
      tagText: "#4d94ff",
      avatarFallbackBg: "#333333",
      avatarFallbackFg: "#666666",
    },
    warm: {
      bg: "#FAF3EB",
      text: "#333333",
      subtle: "#8590a6",
      hairline: "#e0d5c8",
      watermark: "#a09080",
      accent: "#8D6E63",
      titleColor: "#5D4037",
      tagBg: "#f5ece3",
      tagText: "#8D6E63",
      avatarFallbackBg: "#e8ddd0",
      avatarFallbackFg: "#8D6E63",
    },
    cool: {
      bg: "#F8FAFC",
      text: "#334155",
      subtle: "#8590a6",
      hairline: "#e2e8f0",
      watermark: "#94a3b8",
      accent: "#3B82F6",
      titleColor: "#0F172A",
      tagBg: "#eff6ff",
      tagText: "#3B82F6",
      avatarFallbackBg: "#e2e8f0",
      avatarFallbackFg: "#3B82F6",
    },
    paper: {
      bg: "#FDF6E3",
      text: "#586E75",
      subtle: "#8590a6",
      hairline: "#eee8d5",
      watermark: "#93a1a1",
      accent: "#CB4B16",
      titleColor: "#073642",
      tagBg: "#f5eed8",
      tagText: "#CB4B16",
      avatarFallbackBg: "#eee8d5",
      avatarFallbackFg: "#CB4B16",
    },
    minimal: {
      bg: "#FFFFFF",
      text: "#1F2937",
      subtle: "#8590a6",
      hairline: "#e5e7eb",
      watermark: "#9ca3af",
      accent: "#10B981",
      titleColor: "#111827",
      tagBg: "#ecfdf5",
      tagText: "#10B981",
      avatarFallbackBg: "#e5e7eb",
      avatarFallbackFg: "#10B981",
    },
    cherry: {
      bg: "#FFF5F7",
      text: "#4A4A4A",
      subtle: "#8590a6",
      hairline: "#fce4ec",
      watermark: "#e91e6380",
      accent: "#F48FB1",
      titleColor: "#E91E63",
      tagBg: "#fff0f3",
      tagText: "#E91E63",
      avatarFallbackBg: "#fce4ec",
      avatarFallbackFg: "#E91E63",
    },
    tianya: {
      bg: "#FBF7F0",
      text: "#5D4037",
      subtle: "#8590a6",
      hairline: "#e8dfd4",
      watermark: "#8D6E6380",
      accent: "#8D6E63",
      titleColor: "#6D4C41",
      tagBg: "#f3ece0",
      tagText: "#6D4C41",
      avatarFallbackBg: "#e8dfd4",
      avatarFallbackFg: "#8D6E63",
    },
    retro: {
      bg: "#EDE8DF",
      text: "#3E3230",
      subtle: "#8590a6",
      hairline: "#d5cfc5",
      watermark: "#7B9E8780",
      accent: "#7B9E87",
      titleColor: "#4A3A35",
      tagBg: "#e5e0d5",
      tagText: "#7B9E87",
      avatarFallbackBg: "#d5cfc5",
      avatarFallbackFg: "#7B9E87",
    },
    matcha: {
      bg: "#F5F0E8",
      text: "#3D5A3A",
      subtle: "#8590a6",
      hairline: "#ddd8ce",
      watermark: "#6B8F5E80",
      accent: "#6B8F5E",
      titleColor: "#2E4A2B",
      tagBg: "#edeadf",
      tagText: "#6B8F5E",
      avatarFallbackBg: "#ddd8ce",
      avatarFallbackFg: "#6B8F5E",
    },
    chocolate: {
      bg: "#F5EDE0",
      text: "#3D1F1A",
      subtle: "#8590a6",
      hairline: "#e0d5c5",
      watermark: "#D4829A80",
      accent: "#D4829A",
      titleColor: "#5C2E26",
      tagBg: "#ede5d8",
      tagText: "#D4829A",
      avatarFallbackBg: "#e0d5c5",
      avatarFallbackFg: "#D4829A",
    },
    blueberry: {
      bg: "#EDE9E2",
      text: "#1A2744",
      subtle: "#8590a6",
      hairline: "#d5d0c8",
      watermark: "#5B8BA080",
      accent: "#5B8BA0",
      titleColor: "#1E3050",
      tagBg: "#e5e0d8",
      tagText: "#5B8BA0",
      avatarFallbackBg: "#d5d0c8",
      avatarFallbackFg: "#5B8BA0",
    },
    redTeal: {
      bg: "#F0E6D8",
      text: "#2D2D2D",
      subtle: "#8590a6",
      hairline: "#d8cec0",
      watermark: "#B71C1C60",
      accent: "#1B5E4B",
      titleColor: "#B71C1C",
      tagBg: "#e8ded0",
      tagText: "#1B5E4B",
      avatarFallbackBg: "#d8cec0",
      avatarFallbackFg: "#B71C1C",
    },
  };

  function el(tag, style, props) {
    const node = document.createElement(tag);
    if (style) Object.assign(node.style, style);
    if (props) Object.assign(node, props);
    return node;
  }

  function svgEl(markup) {
    const wrap = document.createElement("span");
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.innerHTML = markup;
    return wrap;
  }

  // ---------- formatting ----------

  function formatTime(iso, locale) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");

    let uiLang = locale || "zh-CN";
    if (uiLang.toLowerCase().indexOf("zh") === 0) {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
    }
    const datePart = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
    return `${datePart} · ${hh}:${mm}`;
  }

  function formatCount(n) {
    if (n == null || isNaN(n)) return "0";
    const abs = Math.abs(n);
    if (abs < 1000) return String(n);
    const units = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    for (const [div, suffix] of units) {
      if (abs >= div) {
        const v = n / div;
        let s;
        if (v >= 100) s = String(Math.round(v));
        else if (v >= 10) s = v.toFixed(1).replace(/\.0$/, "");
        else s = v.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
        return s + suffix;
      }
    }
    return String(n);
  }

  function formatLocaleCount(n, locale) {
    const zh = (locale || "zh-CN").toLowerCase().indexOf("zh") === 0;
    if (!zh) return formatCount(n);
    if (n == null || isNaN(n)) return "0";
    const abs = Math.abs(n);
    if (abs < 10000) return String(n);
    if (abs < 1e8) {
      const v = n / 1e4;
      const s = v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "");
      return s + "万";
    }
    const v = n / 1e8;
    return v.toFixed(1).replace(/\.0$/, "") + "亿";
  }

  // ---------- icons ----------

  const ICON_PATHS = {
    like: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
    comment:
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    bookmark:
      '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  };

  function iconSvg(kind, color) {
    return (
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" ` +
      `stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[kind]}</svg>`
    );
  }

  function filledIconSvg(kind, color) {
    return (
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="none">${ICON_PATHS[kind]}</svg>`
    );
  }

  function avatarFallback(palette) {
    return (
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${palette.avatarFallbackBg}"/><circle cx="48" cy="38" r="18" fill="${palette.avatarFallbackFg}"/><circle cx="48" cy="96" r="38" fill="${palette.avatarFallbackFg}"/></svg>`
      )
    );
  }

  // ---------- media grid ----------

  function buildSingleImageTile(src) {
    const holder = el("div", { position: "relative", borderRadius: "12px", overflow: "hidden" });
    const img = el("img", {
      width: "100%",
      height: "auto",
      display: "block",
      borderRadius: "12px",
    });
    img.src = src;
    holder.appendChild(img);
    return holder;
  }

  function buildGridTile(src, extraStyle) {
    const holder = el("div", {
      position: "relative",
      overflow: "hidden",
      width: "100%",
      borderRadius: "8px",
      ...extraStyle,
    });
    const img = el("img", {
      width: "100%",
      height: "auto",
      display: "block",
    });
    img.src = src;
    holder.appendChild(img);
    return holder;
  }

  function layoutMediaGrid(urls) {
    const n = urls.length;
    const wrap = el("div", { marginTop: "16px", borderRadius: "12px", overflow: "hidden" });

    if (n === 1) {
      Object.assign(wrap.style, { display: "block" });
      wrap.appendChild(buildSingleImageTile(urls[0]));
      return wrap;
    }

    if (n === 2) {
      Object.assign(wrap.style, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" });
      urls.forEach((src) => wrap.appendChild(buildGridTile(src)));
      return wrap;
    }

    if (n === 3) {
      Object.assign(wrap.style, {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "4px",
      });
      wrap.appendChild(buildGridTile(urls[0], { gridColumn: "1 / span 2" }));
      wrap.appendChild(buildGridTile(urls[1]));
      wrap.appendChild(buildGridTile(urls[2]));
      return wrap;
    }

    Object.assign(wrap.style, {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "4px",
    });
    urls.forEach((src) => wrap.appendChild(buildGridTile(src)));
    return wrap;
  }

  function buildMediaGrid(images) {
    if (!images || !images.length) return null;
    const list = images.slice(0, 4);
    const urls = list.map((item) => item.url);
    const wrap = layoutMediaGrid(urls);
    wrap.dataset.zhihucardMedia = String(list.length);
    return wrap;
  }

  function finalizeMediaLayout(root) {
  }

  // ---------- stat row ----------

  function statSpan(kind, value, palette, filled) {
    const span = el("span", {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      color: palette.subtle,
      fontSize: "13px",
    });
    const iconFn = filled ? filledIconSvg : iconSvg;
    span.appendChild(svgEl(iconFn(kind, palette.subtle)));
    const num = el("span", {}, { textContent: formatCount(value || 0) });
    span.appendChild(num);
    return span;
  }

  // ---------- watermark ----------

  function xmlEscape(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function watermarkTileDataUri(text, color, opacity) {
    const label = (text || "ZhihuCard").trim() || "ZhihuCard";
    const fill = /^#[0-9a-f]{6}/i.test(color || "") ? color.slice(0, 7) : "#999999";
    let op = Number(opacity);
    if (!isFinite(op)) op = 14;
    op = Math.min(60, Math.max(2, op)) / 100;
    const W = 240, H = 140, cx = W / 2, cy = H / 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<text x="${cx}" y="${cy}" transform="rotate(-30 ${cx} ${cy})" fill="${fill}" fill-opacity="${op}" font-size="14" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${xmlEscape(label)}</text>` +
      `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // ---------- main builder ----------

  function buildCard(data, options) {
    data = data || {};
    options = options || {};
    const palette = PALETTES[options.theme] || PALETTES.white;

    const card = el("div", {
      position: "relative",
      width: "600px",
      boxSizing: "border-box",
      background: palette.bg,
      borderRadius: "20px",
      padding: "32px",
      fontFamily: '-apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
      color: palette.text,
    });

    // ----- article type badge -----
    if (data.type) {
      const badge = el("div", {
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "600",
        marginBottom: "12px",
        background: palette.tagBg,
        color: palette.tagText,
      });
      badge.textContent = data.type === "article" ? "专栏文章" : "知乎回答";
      card.appendChild(badge);
    }

    // ----- title -----
    if (data.title) {
      const titleFontSize = options.titleFontSize || 22;
      const title = el("div", {
        fontSize: `${titleFontSize}px`,
        fontWeight: "700",
        lineHeight: "1.4",
        color: palette.titleColor,
        marginBottom: "16px",
        wordBreak: "break-word",
      });
      title.textContent = data.title;
      card.appendChild(title);
    }

    // ----- header (avatar + author info) -----
    const header = el("div", { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" });
    const avatar = el("img", {
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      objectFit: "cover",
      flexShrink: "0",
      background: palette.avatarFallbackBg,
    });
    avatar.src = data.avatar || avatarFallback(palette);
    header.appendChild(avatar);

    const nameCol = el("div", { display: "flex", flexDirection: "column", minWidth: "0" });
    const nameRow = el("div", { display: "flex", alignItems: "center", gap: "6px" });
    const nameSpan = el("span", {
      fontWeight: "600",
      fontSize: "15px",
      color: palette.text,
    }, { textContent: data.author || "" });
    nameRow.appendChild(nameSpan);

    if (!options.hideTime && data.datetime) {
      const dateSpan = el("span", {
        fontSize: "13px",
        color: palette.subtle,
      }, { textContent: formatTime(data.datetime, options.locale) });
      nameRow.appendChild(dateSpan);
    }
    nameCol.appendChild(nameRow);

    if (data.authorHeadline) {
      const headlineSpan = el("span", {
        fontSize: "13px",
        color: palette.subtle,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "400px",
      }, { textContent: data.authorHeadline });
      nameCol.appendChild(headlineSpan);
    }

    header.appendChild(nameCol);
    card.appendChild(header);

    // ----- voteup line -----
    const likes = data.stats ? (data.stats.likes || 0) : 0;
    if (!options.hideStats && likes > 0) {
      const zh = (options.locale || "zh-CN").toLowerCase().indexOf("zh") === 0;
      const count = formatLocaleCount(likes, options.locale);
      const voteup = el("div", {
        fontSize: "15px",
        fontWeight: "600",
        color: palette.accent,
        marginTop: "-8px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      });
      voteup.dataset.zhihucardRole = "voteup";
      voteup.appendChild(el("span", {}, {
        textContent: zh
          ? `${count}人${data.type === "article" ? "赞同了该文章" : "赞同了该回答"}`
          : `Liked by ${count} ${count === "1" ? "person" : "people"}`,
      }));
      voteup.appendChild(el("span", { fontSize: "16px", lineHeight: "1" }, { textContent: "›" }));
      card.appendChild(voteup);
    }

    // ----- body text -----
    const bodyFontSize = options.bodyFontSize || 16;
    const paragraphGap = !!options.paragraphGap;
    const body = el("div", { marginBottom: "16px" });
    const textBlock = el("div", {
      fontSize: `${bodyFontSize}px`,
      lineHeight: paragraphGap ? "2.0" : "1.75",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      color: palette.text,
    });
    if (data.translatedText) {
      textBlock.dataset.zhihucardRole = "text-translated";
      textBlock.textContent = data.translatedText;
    } else {
      textBlock.dataset.zhihucardRole = "text-original";
      textBlock.textContent = data.text || "";
    }
    body.appendChild(textBlock);
    card.appendChild(body);

    // ----- media -----
    const media = buildMediaGrid(data.images);
    if (media) card.appendChild(media);

    // ----- source URL -----
    if (data.url && !options.hideLink) {
      const sourceRow = el("div", {
        marginTop: "16px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "10px 14px",
        background: palette.tagBg,
        borderRadius: "10px",
        fontSize: "13px",
        color: palette.accent,
        wordBreak: "break-all",
      });
      sourceRow.appendChild(svgEl(iconSvg("link", palette.accent)));
      const urlText = el("span", { flex: "1" }, { textContent: data.url });
      sourceRow.appendChild(urlText);
      card.appendChild(sourceRow);
    }

    // ----- footer (stats) -----
    if (!options.hideStats) {
      const stats = data.stats || {};
      const hasStats = stats.likes || stats.comments || stats.bookmarks || stats.hearts;
      if (hasStats) {
        const footer = el("div", {
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: `1px solid ${palette.hairline}`,
          display: "flex",
          alignItems: "center",
          gap: "16px",
        });
        footer.dataset.zhihucardRole = "footer";

        if (stats.likes) footer.appendChild(statSpan("like", stats.likes, palette, true));
        if (stats.comments) footer.appendChild(statSpan("comment", stats.comments, palette));
        if (stats.bookmarks) footer.appendChild(statSpan("bookmark", stats.bookmarks, palette));
        if (stats.hearts) footer.appendChild(statSpan("like", stats.hearts, palette));

        card.appendChild(footer);
      }
    }

    // ----- watermark (full-card tiled text) -----
    if (options.watermark) {
      const uri = watermarkTileDataUri(options.watermarkText, palette.watermark, options.watermarkOpacity);
      card.style.backgroundImage = `url("${uri}")`;
      card.style.backgroundRepeat = "repeat";
    }

    return card;
  }

  // ---------- wallpaper frame ----------

  const WALLPAPER_PAD = 60;

  function buildWallpaperFrame(cardEl, backgroundUrl) {
    const rect = cardEl.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));

    const wrapper = el("div", {
      position: "relative",
      width: `${w + WALLPAPER_PAD * 2}px`,
      height: `${h + WALLPAPER_PAD * 2}px`,
      flexShrink: "0",
      boxSizing: "border-box",
      overflow: "hidden",
    });
    wrapper.dataset.zhihucardRole = "wallpaper-frame";

    const bg = el("img", {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    });
    bg.dataset.zhihucardRole = "wallpaper-bg";
    bg.src = backgroundUrl;
    wrapper.appendChild(bg);

    const centerLayer = el("div", {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    cardEl.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.35)";
    cardEl.style.flexShrink = "0";
    centerLayer.appendChild(cardEl);
    wrapper.appendChild(centerLayer);

    return wrapper;
  }

  window.ZhihuCard = window.ZhihuCard || {};
  window.ZhihuCard.buildCard = buildCard;
  window.ZhihuCard.finalizeMediaLayout = finalizeMediaLayout;
  window.ZhihuCard.buildWallpaperFrame = buildWallpaperFrame;
  window.ZhihuCard.formatCount = formatCount;
  window.ZhihuCard.formatTime = formatTime;
})();
