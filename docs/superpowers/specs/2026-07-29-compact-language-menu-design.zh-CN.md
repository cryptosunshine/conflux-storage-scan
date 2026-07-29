# Conflux Storage Scan 紧凑语言菜单设计

## 背景与根因

页脚语言选择器使用 Radix Select。`Select.Content` 通过 Portal 挂载到 `body`，不会继承
页脚容器的 `0.75rem` 字号，因此弹层实际回退到全局 `16px`。当前弹层宽度跟随
`144px` 的 Trigger，“中文（简体）”会被挤成两行，同时 40px 选项高度被换行内容继续撑高，
形成字号偏大、选项松散和选中背景过重的问题。

## 目标

- 让中英文选项在现有弹层宽度内保持单行。
- 缩小弹层文字和垂直留白，使菜单与页脚的紧凑尺度一致。
- 降低选中、悬停背景的视觉重量，同时保留清晰的文本、勾选标识和键盘高亮。
- 保持 Trigger 的尺寸、位置和当前交互不变。

## 范围

本次只修改语言选择器弹层样式和对应的视觉回归测试：

- 不修改 `LanguageSelect` 的组件结构、Radix 行为或 i18next 状态。
- 不修改 Trigger 的 `9rem × 2.5rem` 尺寸。
- 不修改翻译、路由、数据源、RPC、钱包或链上逻辑。
- 继续仅支持 Light Theme。

## 视觉规格

弹层使用显式排版，避免依赖 Portal 外部的继承上下文：

- `.language-select__content`：`font-size: 0.8125rem`（13px），
  `line-height: 1.25rem`（20px）。
- `.language-select__viewport`：内边距由 `0.3rem` 收紧为 `0.25rem`。
- `.language-select__item`：
  - `min-height: 2.25rem`（36px）；
  - 水平和垂直内边距为 `0.375rem 0.55rem`；
  - 圆角为 `0.4rem`；
  - `white-space: nowrap`，中文与英文都不得换行。
- 选项之间不额外增加分隔线或间距。
- 高亮项继续使用现有 primary token，但背景以 raised surface 混合，降低饱和度：
  `color-mix(in srgb, var(--color-primary-soft) 62%, var(--color-surface-raised))`。
- 当前项仍显示 Check 图标；颜色与键盘高亮不作为唯一的选中提示。

弹层宽度仍使用 `--radix-select-trigger-width`，移动端最大宽度仍限制为
`calc(100vw - 2rem)`。不通过扩大弹层掩盖排版问题。

## 交互与无障碍

- 鼠标、触屏和键盘操作保持 Radix Select 的既有行为。
- Enter/Space、方向键、Enter 选择、Esc 关闭与关闭后焦点恢复保持不变。
- Trigger 可见焦点环、弹层打开动画和 reduced-motion 行为保持不变。
- 选项的可访问名称仍为“中文（简体）”和“English”。
- 本次紧凑密度仅用于两个短选项的页脚辅助菜单，不推广为全站交互控件高度规范。

## TDD 与视觉验证

先在 `tests/e2e/localization.spec.ts` 增加失败的样式回归断言，验证打开弹层后：

- 计算字号为 `13px`；
- `white-space` 为 `nowrap`；
- “中文（简体）”只占一行；
- 每个选项的渲染高度不超过 `36px`。

确认测试在当前样式下因 `16px` 字号和中文换行而失败，再实施最小 CSS 修改。完成后：

1. 运行本地化 E2E 聚焦用例。
2. 在 1440px、1024px 和 390px 视口检查菜单单行显示、弹层位置和横向溢出。
3. 检查鼠标高亮、当前项勾选、键盘焦点及中英文切换。
4. 运行 `corepack pnpm verify` 和 `corepack pnpm test:e2e`。
5. 按 Web Interface Guidelines 对变更范围做最终审查。

## 验收标准

- 弹层文字不再使用全局 16px，中文选项在所有目标视口保持单行。
- 菜单密度明显收紧，两个选项的字号、行高、选中背景和圆角协调。
- Trigger 和 Footer 布局没有回归。
- 语言检测、切换、持久化、URL 和 RPC 行为保持不变。
- 无横向溢出、控制台错误或无障碍交互回归。
