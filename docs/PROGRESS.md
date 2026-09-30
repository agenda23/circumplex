# 開発マイルストーン進捗

`docs/circumplex_prd.md` の実装を、依存順（音声→データ→映像→運用→UI→配信連携）に分割したマイルストーン一覧。各マイルストーンの詳細プランは実装時に `EnterPlanMode` で作成し、完了後にこの表を更新する。

**更新ルール:** マイルストーンをコミットしたら、このドキュメントの該当行を更新すること（ステータス・コミットハッシュ・完了日）。新しいマイルストーンに着手する前にもこの表を確認し、依存関係と既に決めた設計判断（例: React/R3F不採用、Valence/Arousalヒューリスティックはプレースホルダー）を踏まえてプランを立てる。

## ステータス一覧

| # | マイルストーン | PRD参照 | ステータス | コミット | 完了日 |
|---|---|---|---|---|---|
| 1 | エンジン基盤(command bus) + 音声帯域パイプライン + 最小限の反応描画 | §2.1, §2.2 | ✅ 完了 | `89585dc` | 2026-09-30 |
| 2 | MIR特徴抽出 + Circumplex(Valence/Arousal)推定 | §2.3 | ✅ 完了 | `5b88a1b` | 2026-09-30 |
| 3 | 本Uber Shader(SDF/Raymarching, HSL/Oklch色マッピング, LFOドリフト) | §3 | ⬜ 未着手 | — | — |
| 4 | 動的処理量調整(FPS監視 + 解像度/エフェクト自動調整) | §4.2 | ⬜ 未着手 | — | — |
| 5 | スリープ回避(Wake Lock) | §4.3 | ⬜ 未着手 | — | — |
| 6 | TUI HUD拡充 + コントロールパネル(設定モーダル) | §5.1, §5.2 | ⬜ 未着手 | — | — |
| 7 | 状態のURL共有(Base64クエリパラメータ, `?ui=false`) | §5.3 | ⬜ 未着手 | — | — |
| 8 | PWA化(Service Worker, オフライン対応) | §1.3 | ⬜ 未着手 | — | — |
| 9 | OBS/配信連携(ブラウザソース, PiPキャプチャ) | §6 | ⬜ 未着手 | — | — |

## マイルストーン詳細

### 1. エンジン基盤 + 音声帯域パイプライン + 最小限の反応描画 ✅
command-bus方式のエンジンコア(`reduce`純関数 + `Effect`実行)。マイクまたはデモ音源(オシレータ)からlow/mid/high 3帯域のRMSレベルを取得し、フルスクリーンクアッドのシェーダーへuniform経由で反映する仮描画で配線を確認。HUDはFPSとレベルを表示。

主要ファイル: `src/engine/Engine.ts`, `src/engine/commands.ts`, `src/engine/audio/{bands,input,synth}.ts`, `src/render/UberShaderStub.ts`

### 2. MIR特徴抽出 + Circumplex推定 ✅
全帯域AnalyserNodeから取得したスペクトルデータを元に、スペクトル重心・フラットネス・フラックス・クロマグラムをWeb Worker上で計算(`features.ts`は純粋関数、`features.worker.ts`は薄いメッセージパッシングのみ)。それらからValence/Arousalをヒューリスティックに算出し、3〜5秒のEMAで平滑化(`circumplex.ts`)。

**申し送り事項:** Valence/Arousalの重み(`AROUSAL_WEIGHTS`, `VALENCE_WEIGHTS`)は根拠のある学習済みモデルではなく、暫定のヒューリスティック。実音源で聴感と比較しながら調整が必要。

主要ファイル: `src/engine/audio/{features,circumplex,features.worker,featureWorkerClient}.ts`

### 3. 本Uber Shader ⬜
現在の`UberShaderStub`(リングの仮描画)を、PRD §3の本来の表現に置き換える: Raymarching/SDFによるソリッドな3D構造、ベクターシンセシス(L/R位相のXY座標マッピング)、HSL/Oklch色空間でのHue(中域ピッチ+Circumplex極角)/Saturation(倍音+Circumplex半径)/Lightness(RMS)マッピング、極低周波LFOによる長尺運用向けの色相・ノイズシードドリフト。`state.circumplex`と`state.levels`を消費する。

### 4. 動的処理量調整 ⬜
過去120フレーム程度の移動平均FPSを監視し、閾値(例: 50fps)を下回ったら`renderer.setPixelRatio`を動的に下げ(最小0.5)、それでも解決しなければUber Shader内の重い処理(フラクタル反復数、高品質AA)を自動オフ。安定すれば復帰。

### 5. スリープ回避 ⬜
`navigator.wakeLock.request('screen')`。`visibilitychange`イベントでの再取得ロジック。

### 6. TUI HUD拡充 + コントロールパネル ⬜
四隅レイアウトのHUD(現状は簡易な2行のみ)。設定モーダルは`` ` ``/`Esc`(PC)またはマルチタッチジェスチャー(iOS)で呼び出し、オーディオデバイス選択、マニュアル・オーバーライド、パフォーマンスプロファイラ、PWAキャッシュクリア/強制アップデート。

### 7. 状態のURL共有 ⬜
UI設定状態をBase64エンコードしてURLクエリパラメータに同期。`?ui=false`でクリーンモード。

### 8. PWA化 ⬜
Cloudflare Pages等での静的ホスティングを見据えたPWA対応(Service Worker、マニフェスト、オフラインキャッシュ)。`ref/age-vd`の`vite-plugin-pwa`構成が参考になる(ただしアイコン等アセットは別途用意が必要)。

### 9. OBS/配信連携 ⬜
`?ui=false`でのブラウザソース直接入力、および`canvas.captureStream(60)` → 隠し`<video>` → Picture-in-Picture APIでのOBSウィンドウキャプチャ連携。
