# 独自実装版の公開前検査

対象は既存の `https://yasojima.github.io/servicelife-ja/`。他の公開プロジェクトを含む公開リポジトリは `yasojima/yasojima.github.io`。

1. `独自実装/build.py` で候補を生成する。生成と公開承認は別であり、生成から許可一覧は更新しない。
2. 全操作検査、PC・スマホ表示の比較、通信・PDF・入れ子データの検査を行う。`migration-ledger.json` の全件に、同じ候補の証拠を付けて `check_release.py` を通す。
3. 差分レビュー後に、その候補だけを `reviewed-independent.json` へ明示的に登録する。`files` は実ファイルのSHA256、`code_sha256` は前後の空白を除いたコード／スタイルのSHA256。コード基準は生成処理・CIから自動更新しない。
4. 公開リポジトリの `servicelife-ja/` を候補で置き換える。他の公開ページは変更せず、全公開ファイルのハッシュを `pages-inventory.json` で照合する。
5. `.github/site-security/independent/` にこの検査一式を配置する。既存の共通パーサー・PDF検査・依存定義は `.github/site-security/` を使用する。ワークフローは `static.yml`。
6. `stage_pages.py REPOSITORY NEW_ARTIFACT` → `check_regressions.py ARTIFACT/servicelife-ja` → `browser_gate.cjs ARTIFACT` → `stage_pages.py --verify ARTIFACT` の順に検査する。CIも同じ順序で、最後に検査した同じディレクトリだけをアップロードする。リポジトリ全体を公開成果物にしない。
7. デプロイ成功後、`tests/verify-public-files.py` で公開内容を読み戻し、`tests/public-browser.cjs` で公開URLを操作する。公開前テストと公開後の確認を混同しない。

`stage_pages.py` は公開ファイルの増減・ハッシュの違い・シンボリックリンクを拒否する。内容検査は入れ子JSON・Base64・PDF原本も確認する。実ブラウザ検査は通信ガードとCSPを動かし、保護コードを無効化した負例も確認する。

ブラウザから許可するのは、この確認版の固定された静的ファイルの読込み。入力値をURL・本文・Cookie・Referrerへ載せない。フォントに付く固定CSSファイルのReferrerだけは測定した2種類を許可する。元ServiceLife、外部API、位置情報、保存・送信・決済の実行は有効化しない。

公開用コード263ファイル、他の公開ページ689ファイルは今回の確認時点の値。将来増減させる場合も、意図した差分をレビューして明示的に基準を更新する。
