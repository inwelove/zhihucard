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

  // ----- watermark toggle -----
  const toggle = document.getElementById("watermarkToggle");

  function paintToggle(on) {
    if (toggle) toggle.classList.toggle("active", !!on);
  }

  chrome.storage.sync.get({ watermark: false }, (res) => paintToggle(res.watermark));

  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = !toggle.classList.contains("active");
      paintToggle(next);
      chrome.storage.sync.set({ watermark: next });
    });
  }

  // ----- theme switch -----
  const themeSwitch = document.getElementById("themeSwitch");
  const themeIcon = document.getElementById("themeIcon");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeIcon) themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  chrome.storage.sync.get({ popupTheme: "dark" }, (res) => applyTheme(res.popupTheme === "light" ? "light" : "dark"));

  if (themeSwitch) {
    themeSwitch.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      chrome.storage.sync.set({ popupTheme: next });
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
