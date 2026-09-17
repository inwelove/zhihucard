// ZhihuCard popup: single setting — whether to show the "ZhihuCard" watermark.

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

  const toggle = document.getElementById("watermark-toggle");

  chrome.storage.sync.get({ watermark: false }, (res) => {
    toggle.checked = !!res.watermark;
  });

  toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ watermark: toggle.checked });
  });
})();
