# Circumplex

WebGLベースのオーディオビジュアライザー / VJアプリケーション。ラッセルの円環モデル（Valence/Arousal）を用いて曲調をリアルタイム推定し、長尺のライブ運用でも視覚的な「飽き」が生じない映像を生成する。

詳細な仕様は [`docs/circumplex_prd.md`](docs/circumplex_prd.md) を参照。

## スタック

TypeScript + Three.js（Vite）。React / React Three Fiber は不採用（理由は PRD 1.3 節を参照）。

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm run build      # 型チェック + ビルド
npm run typecheck  # 型チェックのみ
npm test           # vitest（test/**/*.test.ts）
npm run preview    # ビルド結果のプレビュー
```

## ディレクトリ

- `docs/` — PRD等の設計資料
- `src/` — アプリ本体
- `test/` — vitest
- `ref/` — 参考用に別途クローンした過去アプリ（git管理外、`.gitignore`済み）。UI/操作系の参考のみで、映像・設定項目はこのプロジェクトと無関係。詳細は `CLAUDE.md` を参照。
