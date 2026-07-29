# Conflux Storage Scan 中英文国际化设计

状态：已确认

日期：2026-07-29

## 1. 目标

为现有 Conflux Storage Scan 增加完整的简体中文界面，同时保留英文界面。用户通过 Footer
中的语言选择器即时切换语言；首次访问跟随浏览器语言，手动选择后在当前浏览器中持久保存。

国际化只改变界面文案和本地化格式，不改变路由、链上数据、IndexedDB 数据、RPC 请求、
查询键或只读产品边界。

## 2. 已确认决策

| 主题 | 决策 |
| --- | --- |
| 国际化框架 | `i18next` + `react-i18next` |
| 语言检测 | `i18next-browser-languagedetector` |
| 支持语言 | `en-US`、`zh-CN` |
| 首次访问 | `localStorage` 无偏好时跟随 `navigator.languages` |
| 持久化 | 手动切换保存到 `localStorage` |
| URL | 不增加语言前缀、查询参数或 hash |
| 切换位置 | Footer 右侧的原生 `select` |
| 切换行为 | 即时更新，不刷新页面，不触发链数据重新同步 |
| 回退语言 | `en-US` |
| 钱包界面 | RainbowKit 与应用语言同步 |
| 错误界面 | 本地化用户提示并保留稳定错误代码 |

## 3. 产品不变量

- 产品保持只读，不增加上传、下载、挖矿、奖励、签名、授权或合约写入。
- 存储费用继续固定显示 `0 CFX`。
- 公开浏览路由不要求连接钱包，仅 `/history` 使用可选钱包账户过滤。
- `/analytics` 继续只读取标准本地索引，语言切换不得发起额外 RPC 请求。
- 继续只支持 Light Theme。
- 技术名称和链上值保持原样，包括 `Conflux`、`eSpace`、`FixedPriceFlow`、`Submit`、
  `CFX`、地址、哈希、错误代码和路由。

## 4. 国际化架构

### 4.1 初始化

创建独立的 i18next 实例并在 React 渲染前初始化：

- 使用 `initReactI18next`；
- 使用 `LanguageDetector`；
- `supportedLngs` 固定为 `["en-US", "zh-CN"]`；
- `fallbackLng` 固定为 `"en-US"`；
- 检测顺序固定为 `["localStorage", "navigator"]`；
- 缓存仅使用 `["localStorage"]`；
- 使用项目专用 key `conflux-storage-scan-language`；
- 禁止从 Cookie、URL、路径、子域或 `<html lang>` 反向检测语言。

当解析后的语言为中文区域变体时统一使用 `zh-CN`，其他未支持语言回退到 `en-US`。
语言变化时同步更新 `document.documentElement.lang`。

### 4.2 翻译资源

翻译资源使用 TypeScript 文件并按功能命名空间拆分：

- `common`：品牌辅助文案、导航、Footer、搜索、分页、通用按钮和状态；
- `explorer`：概览、提交列表、提交详情、地址活动和钱包历史；
- `analytics`：图表、图例、摘要和可访问数据表；
- `errors`：路由、同步、缓存、合约验证和重建索引错误；
- `wallet`：连接、账户和网络切换文案。

英文资源是 key 与插值参数的基准。简体中文必须覆盖同一组 key。开发和测试通过类型检查及
资源一致性测试阻止缺失 key。

### 4.3 React 集成

页面和组件通过 `useTranslation` 读取当前命名空间。应用 Provider 根据
`i18n.resolvedLanguage` 设置 RainbowKit 的 `locale`：

- `zh-CN` 对应 RainbowKit `zh-CN`；
- `en-US` 对应 RainbowKit `en-US`。

语言变化只使依赖翻译的 React 组件重新渲染。`StorageDataSource`、TanStack Query Client、
wagmi 配置和路由实例保持稳定，不因语言变化重建。

## 5. Footer 语言选择器

Footer 保留网络和只读产品说明，并在右侧增加带可见 `<label>` 的原生 `select`：

- `value="zh-CN"` 显示 `中文（简体）`；
- `value="en-US"` 显示 `English`；
- 控件名称、焦点样式和选择状态必须可被键盘与辅助技术访问；
- 选项名称使用各自语言，不随当前语言翻译，保证用户始终能识别返回路径；
- 桌面端与现有 Footer 内容同行；
- 390px 移动端允许换行，不能产生横向滚动。

选择语言后调用 `i18n.changeLanguage`。检测插件负责保存选择，页面 URL、滚动位置和当前数据
状态不变。

## 6. 翻译范围

必须本地化：

- Skip link、页头导航、搜索和网络辅助说明；
- Footer、404、路由校验和路由错误；
- 概览指标、同步状态、最近提交和分析预览；
- 提交列表、分页、表头、caption、空状态和加载状态；
- 提交详情与链上来源字段；
- 地址活动和钱包账户活动；
- 图表标题、摘要、坐标日期、Tooltip、图例和可访问数据表；
- 复制按钮的 `aria-label`、`title` 和复制成功状态；
- 所有其他用户可见的 `aria-label`、状态提示和恢复操作。

不得翻译：

- 品牌名 `Conflux Storage Scan`；
- 合约与网络技术标识；
- 地址、哈希、序号和错误代码；
- `0 CFX` 产品常量；
- 路由路径和查询参数值。

## 7. 数字、日期与复数

- 数字使用当前语言的 `Intl.NumberFormat`；
- 相对时间使用当前语言的 `Intl.RelativeTimeFormat`；
- 日期和时间使用当前语言的 `Intl.DateTimeFormat`；
- UTC 图表日期保持 UTC 语义，只改变显示格式；
- 字节单位继续使用 IEC 单位 `B`、`KiB`、`MiB`、`GiB` 等；
- 可数名词使用 i18next 的 `count` 和复数规则，不能拼接英文复数后缀；
- 地址、哈希、区块高度和业务序号保持精确，不进行语言相关数值转换。

## 8. 错误处理

界面不把任意底层异常字符串直接作为主要中文提示。稳定错误代码映射到本地化消息：

```text
数据可能不完整
RPC 请求超时（RPC_TIMEOUT）
```

未知错误使用通用本地化提示，并在存在稳定代码时继续显示代码。合约实现不匹配、错误网络、
缓存损坏和数据缺口必须保留现有差异化恢复行为。重建本地索引的确认文案明确说明仅删除当前
浏览器缓存，不修改链上数据。

## 9. 测试策略

遵循 TDD，先观察失败再实现：

1. 资源一致性、浏览器语言检测、英文回退和 `localStorage` 持久化测试；
2. Footer 选择器可访问名称、即时切换和刷新后保留语言测试；
3. 数字、UTC 日期、相对时间和复数测试；
4. 公共组件、错误状态、图表及页面核心中英文文案测试；
5. Playwright 验证中文浏览器首次显示中文、切换英文后 URL 不变、刷新后仍为英文；
6. 现有产品不变量和所有英文测试继续通过。

完整验证包括：

```bash
corepack pnpm harness:validate
corepack pnpm verify
corepack pnpm test:e2e
```

最后在 1440px、1024px 和 390px 宽度下检查 Header、Footer、表格、详情、图表、钱包状态及
错误状态，确认中文文案没有溢出、遮挡或异常换行。

## 10. 完成标准

- 首次访问按浏览器语言选择中文或英文；
- Footer 可以即时切换并持久化语言；
- 所有应用界面与 RainbowKit 使用同一语言；
- 所有路由保持原路径，语言切换不引发 RPC 同步；
- 中文界面不存在非技术性英文残留；
- 英文回退、错误代码和产品不变量保持可用；
- 集中测试、完整门禁、E2E 和三档真实浏览器检查全部通过；
- 功能分支推送后合入 `master`，合并态复验通过并推送远程。
