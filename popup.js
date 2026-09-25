// ZhihuCard popup: watermark toggle, theme switch, i18n.

(() => {
  "use strict";

  function localizedMessage(key) {
    try {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    } catch (_) {}
    return null;
  }

  try {
    document.documentElement.lang = chrome.i18n.getUILanguage() || "zh-CN";
  } catch (_) {}

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = localizedMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const msg = localizedMessage(el.dataset.i18nAlt);
    if (msg) el.alt = msg;
  });

  // storage: 本地优先，sync 尽力同步（sync 在部分地区不可用且有 8KB 单条限制）
  function getSetting(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (local) => {
          const out = Object.assign({}, local || {});
          const missing = Object.keys(keys).filter((k) => out[k] === undefined);
          if (!missing.length) return resolve(out);
          try {
            chrome.storage.sync.get(keys, (sync) => {
              Object.assign(out, sync || {});
              const migrated = {};
              missing.forEach((k) => { if (out[k] !== undefined) migrated[k] = out[k]; });
              if (Object.keys(migrated).length) chrome.storage.local.set(migrated, () => void chrome.runtime.lastError);
              resolve(out);
            });
          } catch (_) { resolve(out); }
        });
      } catch (_) { resolve(keys); }
    });
  }
  function setSetting(obj) {
    try { chrome.storage.local.set(obj, () => void chrome.runtime.lastError); } catch (_) {}
    try { chrome.storage.sync.set(obj, () => void chrome.runtime.lastError); } catch (_) {}
  }

  // ----- watermark toggle -----
  const toggle = document.getElementById("watermarkToggle");

  function paintToggle(on) {
    if (toggle) toggle.classList.toggle("active", !!on);
  }

  getSetting({ watermark: false }).then((res) => paintToggle(res.watermark));

  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = !toggle.classList.contains("active");
      paintToggle(next);
      setSetting({ watermark: next });
    });
  }

  // ----- theme switch -----
  const themeSwitch = document.getElementById("themeSwitch");
  const themeIcon = document.getElementById("themeIcon");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeIcon) themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  getSetting({ popupTheme: "dark" }).then((res) => applyTheme(res.popupTheme === "light" ? "light" : "dark"));

  if (themeSwitch) {
    themeSwitch.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      setSetting({ popupTheme: next });
    });
  }

  // ----- external links -----
  document.querySelectorAll('a[target="_blank"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: a.href });
    });
  });
})();
