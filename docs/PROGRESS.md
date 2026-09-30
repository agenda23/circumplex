# 開発マイルストーン進捗

`docs/circumplex_prd.md` の実装を、依存順（音声→データ→映像→運用→UI→配信連携）に分割したマイルストーン一覧。各マイルストーンの詳細プランは実装時に `EnterPlanMode` で作成し、完了後にこの表を更新する。

**更新ルール:** マイルストーンをコミットしたら、このドキュメントの該当行を更新すること（ステータス・コミットハッシュ・完了日）。新しいマイルストーンに着手する前にもこの表を確認し、依存関係と既に決めた設計判断（例: React/R3F不採用、Valence/Arousalヒューリスティックはプレースホルダー）を踏まえてプランを立てる。

## ステータス一覧

| # | マイルストーン | PRD参照 | ステータス | コミット | 完了日 |
|---|---|---|---|---|---|
| 1 | エンジン基盤(command bus) + 音声帯域パイプライン + 最小限の反応描画 | §2.1, §2.2 | ✅ 完了 | `89585dc` | 2026-09-30 |
| 2 | MIR特徴抽出 + Circumplex(Valence/Arousal)推定 | §2.3 | ✅ 完了 | `5b88a1b` | 2026-09-30 |
| 3 | 本Uber Shader(SDF/Raymarching, Oklch色マッピング, LFOドリフト) | §3 | ✅ 完了(一部) | `8d583f4` | 2026-09-30 |
| 4 | ベクターシンセシス(L/R位相 → XY Lissajous マッピング) **必須** | §3.2 | ✅ 完了 | `cf50ce9` | 2026-09-30 |
| 5 | 動的処理量調整(FPS監視 + 解像度/エフェクト自動調整) | §4.2 | ✅ 完了 | `4a40ec5` | 2026-09-30 |
| 6 | スリープ回避(Wake Lock) | §4.3 | ⬜ 未着手 | — | — |
| 7 | TUI HUD拡充(音声レベルメーター含む) + コントロールパネル(設定モーダル) | §5.1, §5.2 | ⬜ 未着手 | — | — |
| 8 | 状態のURL共有(Base64クエリパラメータ, `?ui=false`) | §5.3 | ⬜ 未着手 | — | — |
| 9 | PWA化(Service Worker, オフライン対応) | §1.3 | ⬜ 未着手 | — | — |
| 10 | OBS/配信連携(ブラウザソース, PiPキャプチャ) | §6 | ⬜ 未着手 | — | — |

## マイルストーン詳細

### 1. エンジン基盤 + 音声帯域パイプライン + 最小限の反応描画 ✅
command-bus方式のエンジンコア(`reduce`純関数 + `Effect`実行)。マイクまたはデモ音源(オシレータ)からlow/mid/high 3帯域のRMSレベルを取得し、フルスクリーンクアッドのシェーダーへuniform経由で反映する仮描画で配線を確認。HUDはFPSとレベルを表示。

主要ファイル: `src/engine/Engine.ts`, `src/engine/commands.ts`, `src/engine/audio/{bands,input,synth}.ts`, `src/render/UberShaderStub.ts`

### 2. MIR特徴抽出 + Circumplex推定 ✅
全帯域AnalyserNodeから取得したスペクトルデータを元に、スペクトル重心・フラットネス・フラックス・クロマグラムをWeb Worker上で計算(`features.ts`は純粋関数、`features.worker.ts`は薄いメッセージパッシングのみ)。それらからValence/Arousalをヒューリスティックに算出し、3〜5秒のEMAで平滑化(`circumplex.ts`)。

**申し送り事項:** Valence/Arousalの重み(`AROUSAL_WEIGHTS`, `VALENCE_WEIGHTS`)は根拠のある学習済みモデルではなく、暫定のヒューリスティック。実音源で聴感と比較しながら調整が必要。

主要ファイル: `src/engine/audio/{features,circumplex,features.worker,featureWorkerClient}.ts`

### 3. 本Uber Shader ✅(一部)
`UberShaderStub`(リングの仮描画)を、Raymarching/SDFベースの本描画(`UberShader`)に置き換えた。sphere-tracingコア、noise-displacedブロブとトーラスをuniform経由でsmooth-minブレンド(Uber Shaderのクロスフェード方式の実証)、low→スケール/pulse、mid→ドメインワープ変形、high→リムライト強度、Oklch色空間でのHue(Circumplex極角+スペクトル重心)/Saturation(Circumplex半径+harmonic richness)/Lightness(RMS)マッピング、~0.01Hz LFOによる色相・ノイズシードドリフト、UnrealBloomPass。Chrome実機で確認: 形状が音声反応し、回転・モーフし続けることを確認。

**申し送り事項:** ベクターシンセシス(L/R位相のXY座標マッピング)はスコープ外 — 現在の音声パイプラインは`AnalyserNode`がモノラルにダウンミックスするため、真のステレオ位相取得には`ChannelSplitterNode`での左右分離が別途必要(音声パイプライン側の変更)。今後のフォローアップ課題。Bloom/モザイクのFPS反応化はMilestone 4。SDF形状は現状ブロブ+トーラスの2種のみ(将来拡張可能)。

### 4. ベクターシンセシス ✅ **必須**
`ChannelSplitterNode`で左右チャンネルを分離し、専用`AnalyserNode`(L/R)で時間領域波形を取得(マイク入力・デモ音源の両方。デモ音源は各帯域トーンに`StereoPannerNode`でパンを振り、実際にL/R差のある信号にした)。`Engine.getVectorSamples()`はcommand busを経由せず直接波形を返す(MIRの生スペクトルと同じ理由: 毎フレームの描画入力であり、シリアライズ可能なapp stateではないため)。`UberShader`が加算合成の`THREE.Line`としてLissajous軌跡を描画。あわせて、ラインが通常のカメラ座標変換を使うため、Orthographicカメラのleft/rightをアスペクト比に追従させる修正も実施(フルスクリーンクアッド自体はカメラを経由しないため影響なし)。Chrome実機で確認: デモ音源で動くLissajous軌跡がブロブに重なって表示されることを確認。

### 5. 動的処理量調整 ✅
`AutoScaler`(純粋なヒステリシス付き状態機械)がEMA平滑化済みfpsを監視し、閾値(50fps)を下回る状態が持続したら品質レベルを1段階ずつ下げる: レベル0-3は`renderer.setPixelRatio`のみ低下(最小0.5)、フロア到達後(レベル4+)はUber Shaderの`uMaxSteps`/`uFbmOctaves`を低下。fps回復が持続すれば自動で復帰。Chrome実機で確認: デモ音源(重いシェーダーで常時30fps未満)でレベル0→4まで段階的に低下することを確認。

**申し送り事項:** 自動調整の無効化トグル(マニュアル・オーバーライド)はMilestone 7(設定モーダル)で追加予定。`AutoScaler.enabled`フラグは実装済み。

### 6. スリープ回避 ⬜
`navigator.wakeLock.request('screen')`。`visibilitychange`イベントでの再取得ロジック。

### 7. TUI HUD拡充 + コントロールパネル ⬜
四隅レイアウトのHUD(現状は簡易な2行のみ)。**`ref/age-vd`の右下オーディオレベルメーター(`L▇ M▄ H▂ ●`形式)を、本プロジェクトの帯域仕様(low/mid/high)に合わせて組み込む**(ユーザー指示によりこのマイルストーンに含める)。設定モーダルは`` ` ``/`Esc`(PC)またはマルチタッチジェスチャー(iOS)で呼び出し、オーディオデバイス選択、マニュアル・オーバーライド、パフォーマンスプロファイラ、PWAキャッシュクリア/強制アップデート。

### 8. 状態のURL共有 ⬜
UI設定状態をBase64エンコードしてURLクエリパラメータに同期。`?ui=false`でクリーンモード。

### 9. PWA化 ⬜
Cloudflare Pages等での静的ホスティングを見据えたPWA対応(Service Worker、マニフェスト、オフラインキャッシュ)。`ref/age-vd`の`vite-plugin-pwa`構成が参考になる(ただしアイコン等アセットは別途用意が必要)。

### 10. OBS/配信連携 ⬜
`?ui=false`でのブラウザソース直接入力、および`canvas.captureStream(60)` → 隠し`<video>` → Picture-in-Picture APIでのOBSウィンドウキャプチャ連携。
