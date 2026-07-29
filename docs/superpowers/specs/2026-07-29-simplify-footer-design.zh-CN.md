# Conflux Storage Scan 精简 Footer 设计

## 目标

移除 Footer 中不需要的网络、合约和源码资源链接，保留最必要的产品身份、只读属性和语言切换，
让 Footer 更紧凑、安静。

## 已确认布局

Footer 使用两行结构：

1. 第一行显示 `Conflux Storage Scan` 和
   `FixedPriceFlow 存储提交的只读浏览器。`
2. 第二行左侧显示带绿色状态点的 `只读`，右侧显示现有语言选择器。

英文继续显示现有等价文案：

- `Conflux Storage Scan`
- `Read-only explorer for FixedPriceFlow storage submissions.`
- `Read-only`
- `Language`

## 删除内容

从 Footer 组件、翻译资源和测试中删除：

- `Conflux eSpace 测试网` Footer 外链；
- `FixedPriceFlow 0x3fF0…7199` Footer 外链；
- `GitHub` Footer 外链；
- 资源导航的可访问名称；
- `ExternalLink` 图标和相关常量。

这不影响页面其他位置的 ConfluxScan 交易链接，也不删除静态品牌图标、浏览器元数据或项目源码。

## 响应式行为

- 桌面与平板：第一行产品信息自然换行；第二行使用两端对齐。
- 390px：第二行的 `只读` 和语言选择器保持同一行，不改为上下堆叠。
- Footer 不产生横向滚动。
- 语言弹层继续向上打开，保持现有字号、焦点和键盘行为。

## 组件与样式

- `AppFooter` 只保留产品信息行与控制行。
- 产品名继续使用 `translate="no"`。
- `LanguageSelect` 组件行为不变。
- 删除 `.app-footer__resources nav` 和 Footer 外链样式。
- 将原资源层调整为语义更准确的控制行样式。

## 测试与验收

1. 先修改 smoke test，要求三个 Footer 外链不存在，并要求 `只读` 与语言选择器位于同一控制行。
2. 运行测试观察预期失败。
3. 实施最小组件、翻译和样式变更。
4. 验证中英文切换、390px 同排和无横向溢出。
5. 运行 `corepack pnpm harness:validate`、`corepack pnpm verify` 和
   `corepack pnpm test:e2e`。

## 非目标

- 不修改 Header、页面主体、图表、表格或路由。
- 不修改 RPC、合约、缓存或钱包逻辑。
- 不增加新的 Footer 链接、版权文案或营销内容。
