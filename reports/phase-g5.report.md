# phase-g5.report.md — G5 打包与分发收尾

## 验收

- [x] **开发者路径**：`pip install -r requirements.txt` + `npm install` + `npm run desktop`（或 `npm run dev`）在 README 与 `.env.example` 可溯源  
- [x] **环境变量**：`.env.example` 增补 Output Router 相关变量说明  
- [x] **已知限制**：README「非目标 / 局限」与悬浮窗、粘贴降级一致（不在此重复细则）  
- [ ] **安装包**：未集成 `electron-builder` 一键安装包；采用源码 + 依赖安装作为当前唯一官方路径（符合 SPEC「或声明双路径」中的开发者模式）  

**日期**：2026-05-10  
