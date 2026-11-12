# 来源与权利说明

## 本项目原创实现与资产

本项目核心源码、关卡、Canvas角色与夜市图形、CSS钱币示意、图标路径及Web Audio合成音效，由当前Codex会话中的gpt-6-astra生成。模型标识依据见 `Provenance/production-start.json`，对应源码哈希由打包脚本记录。没有搬运其他游戏的实现，没有导入外部照片、音乐或模型。

Canvas资产随 `src/visual/scene.ts` 重建，钱币示意和纹理由 `src/style.css` 重建，音效随 `src/platform/audio.ts` 重建。货币只使用真实面额，图形是原创抽象示意，不复刻钞票或硬币图案。

使用操作系统已有中文字体与Georgia等后备字体，不在包中分发字体文件。字体在不同系统上的显示可能有差异，使用者的系统字体授权由系统提供方条款约束。

## 工具依赖

| 组件 | 版本 | 来源 | 声明许可 | 作用 |
| --- | --- | --- | --- | --- |
| TypeScript | 7.0.2 | https://www.npmjs.com/package/typescript | Apache-2.0 | 开发时类型检查 |
| esbuild | 0.28.2 | https://www.npmjs.com/package/esbuild | MIT | 开发时打包 |
| Playwright CLI | 0.1.23 | https://www.npmjs.com/package/@playwright/cli | Apache-2.0 | 开发时后台浏览器验证 |
| playwright / playwright-core | 由锁文件精确记录 | https://github.com/microsoft/playwright | Apache-2.0 | CLI传递依赖，测试用途 |

完整传递依赖、下载来源及完整性信息见 `package-lock.json`；随交付保留实际存在的LICENSE/NOTICE副本于 `ThirdPartyNotices`。上述依赖不计为本项目有效应用代码。离线游戏包不包含Node、Chrome、开发依赖、字体文件或引擎代码。

## 采购权利核验边界

模型服务方为OpenAI，当前会话标识可关联；实际套餐、具体服务合同/输出条款版本及采购方认可尚未提供，不能代替商务/法务确认权利。约定交付、模型训练、内部加工和模型商用用途的最终适用性均标为待合同核验，不据模型名称直接作保证。服务条款参考入口：https://openai.com/policies/ ，最终以实际账户适用的合同和版本为准。

未授权对外公开发布或上传。本次交付仅在用户本地工作区整理。没有付费采购资产。原PRD及用户任务来源为本工作区需求材料，按用户指令使用。
