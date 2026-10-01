# dsh-zoom

Global UI zoom for the DeepSeek Harness web client: scales the **whole interface** — sidebar, menus, settings, overlays and conversation — from the keyboard.

> Unofficial community plugin. Not affiliated with, endorsed by, or published by DeepSeek.

## Why this exists

DeepSeek Harness ships one typography setting, `ui-theme.fontSize`, which affects **conversation body text only**. Sidebar labels, menus and settings chrome are fixed pixel sizes, and the app has no page zoom: its menu has no View/zoom roles and its code exposes no `setZoomLevel`/`zoomFactor`. So `Cmd` + `=` does nothing out of the box. This plugin adds that.

## Install

**In the app** — sidebar → **Plugins → Add plugin**, then enter:

```
github:DC-507/dsh-zoom
```

The Host reads the spec, confirms the package is a bundle, and installs it. Choose **Enable now** when the install finishes. (An npm release may follow; that would make the shorter `dsh-zoom` spec work too.)

**From a terminal** (bundled CLI):

```sh
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" \
  plugin --profile desktop add github:DC-507/dsh-zoom
```

A restart is the guaranteed way to activate it; profiles with HMR usually recompose on their own.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd`/`Ctrl` + `=` (also `Cmd`/`Ctrl` + `Shift` + `=`, i.e. `+`) | zoom in one step |
| `Cmd`/`Ctrl` + `-` | zoom out one step |
| `Cmd`/`Ctrl` + `0` | back to 100% |

Steps: 80 · 90 · 100 · 110 · 125 · 150 · 175 · 200 %. The level is persisted in `localStorage` (`dsh-zoom:level`) and restored on the next launch. For scripting or debugging, the page exposes `__dshZoom.get()`, `__dshZoom.set(1.25)`, `__dshZoom.step(±1)` and `__dshZoom.reset()`.

## How it works

- The zoom is `document.documentElement.style.zoom` — the standardised Chromium CSS `zoom` property. It must live on the **root element**: zooming a wrapper instead collapses the app frame (`#root` measures 0 height) and introduces a horizontal scrollbar.
- Because CSS zoom does not rescale viewport units, the plugin also injects a small `!important` patch for the few surviving `max-height: calc(100vh …)` / `100dvh` overlay clamps (menu scroll region, risk-confirmation dialog, toast, image lightbox). Those rules are addressed by hashed class names, so each is applied **only if it exists** in the running build; on any other build the patch is simply empty and the core zoom is unaffected.
- The shortcuts are a window **capture**-phase `keydown` listener. The shell dispatches its own shortcuts on `document` in the capture phase, so a window listener runs first; the chord is consumed with `preventDefault` + `stopImmediatePropagation` before editors, the terminal or the composer can see it.
- Persistence uses `localStorage`, which is real and durable on the desktop shell's `dsh-app://app` origin (registered `standard` + `secure`, default session, no CSP).

## Known limitations

- Canvas-backed surfaces (xterm terminal, Monaco editors, PDF/spreadsheet previews) rasterize at the unzoomed size and look slightly soft at higher factors. Each change dispatches a `resize` so they re-measure.
- The shortcuts do not fire while focus is inside a sidebar browser/preview `<webview>` or iframe — click the main window first.
- macOS traffic lights are positioned in window points and do not scale. Above 125 % check the top strip and the window drag region.
- In a plain **browser** (not the desktop shell), `Cmd` + `=` is the browser's own zoom; this plugin calls `preventDefault`, so the page zoom is replaced by the plugin's CSS zoom.
- The app ships `immediately: true` prefetching, so the module loads at boot; plugins like this one cannot react to a build that renames every hashed class without a release.

## Compatibility

Tested against DeepSeek Harness **0.2.0-rc.2** (Electron 44 / Chromium 152) on macOS. It declares no `@deepseek-ai/dsh*` peer dependency on purpose: the host half is an empty `apply()` and the browser half uses only standard DOM APIs, so there is nothing to version-gate. The viewport-unit patch is the only build-specific part and degrades to a no-op.

## Development

```sh
npm test          # smoke test: DOM stub, no dependencies
```

`backup/`, `launch-big.sh` and `rollback.sh` are local development helpers and are excluded from the published tarball by `files`.

To iterate against a live install:

```sh
dsh plugin --profile desktop add "link:$PWD"   # symlinked install, edits are live after a reload
dsh plugin --profile desktop remove dsh-zoom
```

## License

MIT — see [LICENSE](./LICENSE).

---

# dsh-zoom（中文）

DeepSeek Harness Web 客户端的**整体界面缩放**插件：侧栏、菜单、设置、浮层、对话一起放大，用快捷键控制。

> 非官方社区插件，与 DeepSeek 无隶属关系。

## 为什么需要它

DSH 只提供一个排版设置 `ui-theme.fontSize`，而且**只影响对话正文**；侧栏、菜单、设置页都是固定像素，应用本身也没有页面缩放（菜单里没有 View/缩放角色，代码里没有 `setZoomLevel`/`zoomFactor`），所以 `Cmd` + `=` 默认没有任何反应。

## 安装

应用内：侧栏 **插件 → Add plugin**，填 `github:DC-507/dsh-zoom`，装完点 **Enable now**。命令行同样可以：

```sh
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" \
  plugin --profile desktop add github:DC-507/dsh-zoom
```

| 快捷键 | 动作 |
| --- | --- |
| `Cmd`/`Ctrl` + `=`（或 `Cmd`+`Shift`+`=`） | 放大一档 |
| `Cmd`/`Ctrl` + `-` | 缩小一档 |
| `Cmd`/`Ctrl` + `0` | 回到 100% |

档位 80/90/100/110/125/150/175/200%，存在 `localStorage`，重启保留。

## 实现要点

缩放用标准 CSS `zoom` 挂在 `<html>` 上；挂包裹元素会把 `#root` 压成 0 高度并出现横向滚动条。由于 CSS zoom 不缩放视口单位，插件会为少数 `100vh/100dvh` 浮层钳制规则注入带 `!important` 的补丁，且这些规则按类名哈希**存在才注入**，换版本后自动变成空补丁而不影响主体。快捷键走 `window` 捕获阶段，早于外壳在 `document` 上的派发器。

## 已知限制

画布类面板（终端、Monaco、PDF/表格预览）高倍率下略糊；焦点在侧栏 `<webview>`/iframe 里时快捷键不生效；macOS 红绿灯不参与缩放，125% 以上请留意顶栏拖拽区；在普通浏览器里会顶掉浏览器自带的页面缩放。

## 许可证

MIT，见 [LICENSE](./LICENSE)。
