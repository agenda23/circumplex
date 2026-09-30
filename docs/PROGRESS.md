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
| 6 | スリープ回避(Wake Lock) | §4.3 | ✅ 完了 | `f8ab66f` | 2026-09-30 |
| 7 | TUI HUD拡充(音声レベルメーター含む) + コントロールパネル(設定モーダル) | §5.1, §5.2 | ✅ 完了(一部) | `b6677c6` | 2026-09-30 |
| 8 | 状態のURL共有(Base64クエリパラメータ, `?ui=false`) | §5.3 | ✅ 完了 | `1e57295` | 2026-09-30 |
| 9 | PWA化(Service Worker, オフライン対応) | §1.3 | ✅ 完了 | `2ea30db` | 2026-09-30 |
| 10 | OBS/配信連携(ブラウザソース, PiPキャプチャ) | §6 | ✅ 完了 | `16aaff5` | 2026-09-30 |

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

### 6. スリープ回避 ✅
`WakeLockController`が`navigator.wakeLock.request('screen')`をfeature-detect付きでラップ(未対応環境で例外を投げない)。Wake Lock APIはユーザージェスチャーを要求するため、Enter/Mキー押下ハンドラの同期呼び出しスタック内からリクエストする。`visibilitychange`でタブが再表示されロックが無い場合は再取得。Chrome実機で確認: リクエスト周りでコンソールエラーが出ないことを確認(自動テスト環境では実際のロック取得可否は検証できないため、対応環境での動作は今後の実機確認事項)。

### 7. TUI HUD拡充 + コントロールパネル ✅(一部)
`formatHud`が4隅の構造体を返すよう変更(`ref/age-vd`のUI規約に準拠): 左上=STATUS/Circumplex、右上=FPS/SCALING、右下=**音声レベルメーター**(`levelBar()`ヘルパーでUnicodeブロック文字化、`L▇ M▄ H▂ R▅`形式)、左下=キー操作ヒント。`SettingsPanel`(素のDOM、`` ` ``/`Esc`で開閉)を追加: オーディオ入力デバイス選択(`enumerateDevices` → 特定deviceIdでのマイク起動。`session.start`コマンドに`deviceId`を追加し`createMicAudioGraph`まで貫通)、`AutoScaler.enabled`と連動するチェックボックス(Milestone 5で用意したフラグをようやくUIから操作可能に)。`bindKeyboard`に`isBlocked`述語を追加し、パネル開時はEnter/Mが発火しないようにした。Chrome実機で確認: 4隅が独立して表示、レベルメーターがデモ音声に反応、パネルの開閉・デバイス選択・チェックボックス切替が動作、コンソールエラーなし。

**申し送り事項:** PRD §5.2の「マニュアル・オーバーライド(色/エフェクト固定)」「パフォーマンスプロファイラ詳細」「PWAキャッシュクリア/強制アップデート」は未実装 — 前者2つはより詳細なパラメータ/プロファイラ基盤が必要、後者はPWA自体が未実装(Milestone 9)のため。必要になった時点で追加する。

### 8. 状態のURL共有 ✅
`urlState.ts`は純粋関数のみ(ブラウザ環境なしでテスト可能): URL-safe base64でのエンコード/デコード(壊れた入力は例外を投げずデフォルト値にフォールバック)、`?ui=false`判定。現状永続化する設定は`AutoScaler.enabled`のみ(Milestone 5/7で追加したが永続化されていなかったもの)だが、チェックボックス変更→`history.replaceState`でURL同期→リロードで復元、という一連の流れをエンドツーエンドで実装。`?ui=false`時は設定パネル自体が開かなくなる(誤操作防止)。Chrome実機で確認: チェックボックス切替でURLの`?p=`が更新、そのURLで再読込するとチェック状態が復元、`?ui=false`でHUD非表示かつEsc操作がブロックされることを確認。

**申し送り事項:** 永続化対象は現状1項目のみ。今後マニュアル・カラー/エフェクトオーバーライド等が追加された際は`PersistedSettings`型を拡張する。

### 9. PWA化 ✅
`vite-plugin-pwa`を`ref/age-vd`と同様の構成(`registerType: 'prompt'`、workboxプリキャッシュ + `navigateFallback`)で導入。アイコン素材が無かったため、`zlib`のみで手書きしたPNGエンコーダ(新規依存追加なし)でプレースホルダー(単色正方形)のicon-192/512/maskable-512/apple-touch-iconを生成 — Valence/Arousalの重みやベクタースコープの色と同じ「正直なプレースホルダーとして明記し、後で差し替える」方針。Chrome実機で確認: `npm run build`後、manifestが3アイコン付きで解決し、previewサーバーを完全に停止してもService Workerのプリキャッシュからアプリが機能することを確認(検証中に別プロジェクト由来の古いService Workerがlocalhost:4173を掴んでいるのを発見し、退避のため`unregister`する一幕もあった)。

**申し送り事項:** アイコンは実ブランディング未定のプレースホルダー。`registerType:'prompt'`だが、保留中の更新を適用するUI(`updateSW()`呼び出し)は未実装 — 現状は更新が来ても自動適用されない(次回起動まで待つ形)。設定パネルに「更新を適用」ボタンを追加するのは将来の拡張。

### 10. OBS/配信連携 ✅
`?ui=false`(Milestone 8)がブラウザソース直接入力パスをカバー済み。追加でPiPキャプチャパス: 設定パネルの「Start PiP capture」ボタンから`canvas.captureStream(60)` → 隠し`<video>` → Picture-in-Picture APIでOBSの軽量ウィンドウキャプチャに対応。

実装中にChrome実機検証で2つの実バグを発見・修正:
1. `requestPictureInPicture()`はクリックのユーザーアクティベーション猶予内で呼ぶ必要があるが、先に`video.play()`を`await`するとその猶予を失い`NotAllowedError`になる → `play()`を`await`せずにPiPリクエストを呼ぶよう修正。
2. `requestPictureInPicture()`はvideoのメタデータ読み込み済みも要求する(`InvalidStateError`)が、クリックハンドラ内では間に合わない → 隠しvideoをページ読み込み時に先行生成・再生開始(ミュート付き自動再生はジェスチャー不要)しておき、ボタンクリック時には同期的にPiPリクエストのみ行う構成に変更。

Chrome実機で確認: `document.pictureInPictureElement`が設定されPiPが実際にアクティブ化、`exitPictureInPicture()`で正常終了することを確認。
