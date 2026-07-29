# Conflux Storage Scan Radix 语言选择器设计

## 目标

将页脚中的原生语言 `<select>` 替换为基于 `@radix-ui/react-select` 的紧凑描边式选择器，
提升视觉完成度，同时保持现有中英文切换、浏览器语言检测和本地持久化行为不变。

## 范围

- 仅引入 Radix Select primitive，不引入 Radix Themes 或整套设计系统。
- 只修改页脚语言选择器及其样式、测试和依赖。
- 不修改翻译资源结构、路由、数据查询、RPC、钱包连接或链上逻辑。
- 继续仅支持 Light Theme。

## 组件结构

`LanguageSelect` 继续负责读取当前 i18n 语言并调用 `i18n.changeLanguage`。显示层改为：

- 外部可见的“语言 / Language”标签；
- 40px 高的 `Select.Trigger`；
- 当前语言 `Select.Value`；
- 右侧向下 Chevron；
- 通过 Portal 渲染的 `Select.Content`；
- 包含“中文（简体）”和“English”的两个 `Select.Item`；
- 当前项显示 Check 图标。

Radix Root 使用受控 `value` 和 `onValueChange`。选择语言后仍由现有 i18next
监听器更新 `<html lang>`，并由语言检测插件写入
`conflux-storage-scan-language`，不会新增第二份状态。

## 视觉与交互

- Trigger 使用现有 Conflux 令牌：白色表面、`#EBECED` 边框、强正文色。
- Hover 使用 muted accent 边框；打开和键盘聚焦使用 interactive 蓝色焦点环。
- 弹层优先向上展开，使用 raised surface、细边框和现有 popover 阴影。
- 当前项使用 primary soft 背景与 primary strong 文本。
- 每个选项保持至少 40px 高；移动端弹层宽度不超过可视区域。
- Chevron 和 Check 均为装饰图标并从无障碍树中隐藏。
- 打开、关闭和选择状态只使用透明度与位移过渡，并尊重
  `prefers-reduced-motion`。

## 无障碍

- Trigger 通过可见标签获得“Language / 语言”的可访问名称。
- 使用 Radix 提供的键盘行为：Enter/Space 打开、方向键移动、Enter 选择、Esc 关闭，
  关闭后焦点返回 Trigger。
- 选中项通过 Radix 的语义和 `ItemIndicator` 表达，不只依赖颜色。
- Portal 弹层保持足够的文字对比度和可见焦点。

## 测试

遵循 TDD：

1. 先修改组件测试，要求通过按钮打开 listbox、选择中文并验证语言持久化；确认原生
   combobox 断言失败。
2. 实现 Radix 版本后运行组件测试、类型检查和 Biome。
3. 更新 E2E，使页脚选择通过可访问按钮和选项完成，同时继续验证 URL 不变、
   `<html lang>` 更新、刷新后保持用户选择且没有额外 RPC。
4. 在 1440px、1024px 和 390px 宽度检查页脚、弹层位置、焦点和横向溢出。
5. 运行 `corepack pnpm verify` 与 `corepack pnpm test:e2e`。

## 依赖与版本

使用独立包 `@radix-ui/react-select@2.3.7`。图标继续复用现有 `lucide-react`，
不增加 Radix Icons。

## 验收标准

- 页脚语言控件符合紧凑描边式方案并与现有 Light Theme 一致。
- 鼠标、触屏和键盘均能完整操作。
- 中英文切换、浏览器语言检测和持久化行为与当前版本一致。
- 切换语言不改变 URL，不触发额外 RPC。
- 无横向溢出，无控制台错误，完整质量门禁通过。
