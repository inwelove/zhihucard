# ZhihuCard（中文）

由 @inwelove 出品 · 一键把知乎文章/回答变成精美分享卡片。

## 功能

- 在知乎专栏文章和回答页面注入相机图标按钮
- 一键生成卡片：标题、作者头像、昵称、正文预览、配图、互动数据
- 三种卡片样式：白色、黑色、壁纸（卡片居中放在背景图上，带柔和阴影）
- 壁纸模式内置 7 张原创渐变背景，也支持上传自己的图片（最多 6 张）
- 壁纸模式下卡片本体可以选白色或黑色，透明度 30%–100% 随意调
- 一键翻译（谷歌翻译），方向自动：外语翻成中文，中文翻成外语
- 图片完整显示：单图按原始比例，双图并排，三张以上网格布局；侧栏「图片布局」可切换 自动／单列／多列（单列=每张图占满整行竖排，多列=统一两列）
- 可隐藏互动数据和时间
- 「段落间距」：勾选后每个回车（段落）后补一个空行，与下一段隔开
- 作者信息下方显示「N人赞同了该回答」（可随互动数据一起隐藏）
- 赞同数可手动改写：设定随机范围（默认 3–5 万），点「随机」生成，点「还原」恢复原数据
- 「互动数据」整块可编辑：点赞／评论／收藏／喜欢每项都能手填数字，也能各设一个随机区间（点赞单位万），「随机」按各自区间一键全部生成、「还原」全部恢复；勾选「打开面板时自动随机一次」，每次打开面板自动按区间重掷
- 水印开关同时在侧栏「选项」和扩展弹窗里，改了立即生效；水印为满屏斜向平铺，可自定义文字、透明度（2%–60%）与密度（40%–220%）
- 头像／昵称／签名一次设置永久记住（本地保存，跨设备尽力同步）
- 预设用户：填好昵称/签名/头像点「保存当前」，最多 5 个；点头像圆形一键切换，右键删除，「恢复默认」回到原作者（头像预览/昵称/签名都载入原作者默认值）
- 侧栏「编辑文案」可直接改写卡片正文，改完自动刷新预览，可一键恢复原文
- 界面语言自动跟随浏览器，弹窗右上角也能手动一键切换中／English
- 支持下载 PNG，或直接复制图片到剪贴板
- 可选在卡片右下角显示 ZhihuCard 署名水印，默认关闭
- 数据全部从页面 DOM 读取，不需要登录、不需要 API Key、不做任何追踪
- 零第三方依赖，无需构建

## 支持的页面类型

- 知乎专栏文章：`zhuanlan.zhihu.com/p/*`
- 知乎回答：`www.zhihu.com/question/*/answer/*`、`www.zhihu.com/answer/*`

## 安装

1. 下载或克隆本仓库。
2. 打开 Chrome 的 `chrome://extensions`。
3. 打开右上角「开发者模式」。
4. 点「加载已解压的扩展程序」，选择本项目文件夹。
5. 打开知乎专栏文章或回答页面，页面上会出现相机图标。

## 使用方法

1. 点页面上的相机图标。
2. 弹出预览窗口，能看到生成的卡片。
3. 选一个样式：白色／黑色／壁纸。壁纸样式下点「更多壁纸」展开全部内置背景，也可以上传自己的图片当背景（最多 6 张，可删除）；还能给卡片本体选白色或黑色，并用滑块调卡片透明度。
4. 勾选「翻译」，卡片正文换成译文：外语翻成中文，中文翻成英文。
5. 点「复制图片」把图片复制到剪贴板，或点「下载 PNG」保存文件。

## 隐私

ZhihuCard 只读取当前页面的 DOM，不收集、不存储、不上传任何数据。

- 卡片生成完全在你的浏览器本地完成。
- 图片直接从 `pic*.zhimg.com` 加载；如果直接加载失败，会走插件自己的后台脚本代理下载。
- 如果你打开了翻译功能，正文会发送给谷歌的公开翻译接口（`translate.googleapis.com`）获取译文；只有你主动点「翻译」才会发生这件事。
- 没有数据统计、没有账号系统、没有第三方服务器。
- 壁纸样式如果你上传了自定义背景图，会压缩后存在本地（`chrome.storage.local`），不会上传到任何地方。

## License

MIT

---

# ZhihuCard

Built by [@inwelove](https://github.com/inwelove) · Turn any Zhihu article or answer into a beautiful, shareable card.

## Features

- Injects a camera icon into Zhihu article and answer pages
- One click generates a clean card with title, author avatar, name, text, images, and stats
- Three card styles — White, Dark, and Wallpaper — remembered as your default
- Wallpaper mode ships with 7 built-in original gradient backgrounds, or upload your own
- In Wallpaper mode the card itself can be white or dark, with adjustable background opacity
- One-click translation (via Google Translate), direction-aware
- Images display in full layout (single, side-by-side, or grid); the sidebar "Image layout" option switches between Auto / Single column (each image full width, stacked) / Multi column (uniform 2-column grid)
- Optionally hide the engagement stats and the timestamp
- "Paragraph spacing": when checked, every paragraph (line break) gets a blank line before the next one
- Shows a "N people upvoted this answer" line under the author
- Overwrite the upvote count — set a random range (default 30k–50k), hit Random, or restore the real number
- The whole engagement stats block is editable: each metric (likes, comments, bookmarks, hearts) takes a manual number or its own random range (likes in 10k units); Random fills all four per their ranges, Reset restores the page values; check "Auto-randomize each time the panel opens" to re-roll on every panel open
- Watermark toggle lives in both the sidebar options and the extension popup, applying instantly; the watermark is a full-card diagonal tile with editable text, opacity (2%–60%), and density (40%–220%)
- Custom avatar, nickname, and signature persist locally after a single setup
- Saved profiles: fill in the fields, hit "Save current" (up to 5), click a circle to switch instantly, right-click to remove, "Reset" goes back to the original author (avatar preview, nickname, and signature all show the original defaults)
- Edit the card body text directly from the sidebar; the preview refreshes as you type
- UI follows your browser language with manual toggle
- Download as PNG, or copy to clipboard
- Optional "ZhihuCard" watermark — off by default
- Everything is read directly from the page DOM — no login, no API keys, no tracking
- Zero third-party dependencies, no build step

## Supported Pages

- Zhihu articles: `zhuanlan.zhihu.com/p/*`
- Zhihu answers: `www.zhihu.com/question/*/answer/*`, `www.zhihu.com/answer/*`

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on "Developer mode" (top right).
4. Click "Load unpacked" and select this project's folder.
5. Open a Zhihu article or answer page — a camera icon will appear.

## Usage

1. Click the camera icon on the page.
2. A preview modal opens with the generated card.
3. Pick a style — White, Dark, or Wallpaper. In Wallpaper mode you can expand the gallery or upload your own images, choose card color, and adjust opacity.
4. Turn on the translate toggle to swap the card body for a translation.
5. Copy the rendered image to your clipboard, or download the card as a PNG.

## Privacy

ZhihuCard only reads the DOM of the page you're already looking at. It does
not collect, store, or transmit any of your data.

- Card generation happens entirely locally in your browser.
- Images are loaded directly from `pic*.zhimg.com`, or proxied through the extension's background worker if CORS fails.
- Translation only happens when you explicitly turn on the translate toggle.
- No analytics, no accounts, no third-party servers.

## License

MIT
