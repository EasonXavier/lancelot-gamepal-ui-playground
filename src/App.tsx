import { buildInfo } from './buildInfo';
import './styles/checkpoint.css';

export function App() {
  return (
    <main className="checkpoint-shell">
      <div className="checkpoint-character" aria-hidden="true" />
      <header className="checkpoint-header">
        <span className="checkpoint-mark" aria-hidden="true">
          L
        </span>
        <span className="checkpoint-brand">朗世乐</span>
      </header>

      <section className="checkpoint-panel" aria-labelledby="checkpoint-title">
        <p className="checkpoint-state">工程基础检查点</p>
        <h1 id="checkpoint-title">移动 UI 性能试验场</h1>
        <p className="checkpoint-copy">
          当前页面用于验证独立构建与 GitHub Pages 发布链路。完整交互界面与性能实验仍在开发中。
        </p>
        <dl className="checkpoint-build">
          <div>
            <dt>品牌</dt>
            <dd>朗世乐</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>开发中</dd>
          </div>
          <div>
            <dt>构建</dt>
            <dd>{buildInfo.buildVersion}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default App;
