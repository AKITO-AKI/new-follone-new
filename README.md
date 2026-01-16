<h1>CanSee - Social Lens with friends -</h1>

本拡張機能は、ユーザーのSNS活動をより健全・安全に行えるよう補助することを目的に作られた、Manifest V3（MV3）対応のブラウザ拡張機能です。<br>
タイムライン上の投稿を解析し、注意が必要な情報を見える化（CanSee＝見える）することで、ユーザーが落ち着いて判断できるように支援します。<br>
実際に本拡張機能を使いたい場合は、以下の指示に従って導入していただくとスムーズです。ご参照ください。<br>

<h2>対応環境</h2>
Chromium系ブラウザ：Google Chrome / Microsoft Edge / Brave / Vivaldi / Opera など<br>
OS：Windows / macOS / Linux<br>
※Firefox/Safariは導入方法・対応状況が異なります（下記参照）<br>

<h2>主な機能（簡単な内容紹介）</h2>
タイムライン投稿の解析：投稿内容を読み取り、危険度やジャンル傾向などを推定します<br>
Overlay表示：画面上にキャラクター付きのUIを表示し、解析状況・タスク・注意喚起などを見やすく提示します<br>
BIASグラフ：ユーザーが普段触れている情報の傾向をグラフで見える化します<br>
チュートリアル / GAME（ティアシステム）：使い方や継続利用の楽しさを高める体験要素を用意しています<br>

<h2>導入方法（開発版 / ローカル導入）</h2>
<h3>Google Chrome</h3>
配布されたZIPを展開（フォルダの状態にする）<br>
chrome://extensions を開く<br>
右上の Developer mode（デベロッパーモード） をON<br>
Load unpacked（パッケージ化されていない拡張機能を読み込む） を押す<br>
展開したフォルダを選択
<h3>Microsoft Edge</h3>
ZIPを展開<br>
edge://extensions を開く<br>
Developer mode をON<br>
Load unpacked → 展開フォルダを選択<br>
<h3>Brave / Vivaldi / Opera（Chromium系）</h3>
基本はChromeと同じ手順です。<br>
Brave: brave://extensions<br>
Vivaldi: vivaldi://extensions<br>
Opera: opera://extensions<br>
<h3>Firefox</h3>
Firefoxは「一時導入（再起動で解除）」が基本です。<br>
about:debugging → This Firefox → Load Temporary Add-on<br>
※MV3対応状況や制限があるため、動作は環境により異なる場合があります。<br>
<h3>Safari</h3>
Safariは通常、XcodeでSafari Web Extensionとしてアプリに同梱して配布する形式になります。<br>
<h2>データの扱い（プライバシー / 安心して使える工夫）</h2>
本拡張機能は、ユーザーの心理的負担を減らすために、可能な限り 「端末内で処理を完結させる」設計を重視しています。<br>
解析はローカル中心：投稿の解析・集計・表示に必要な処理を、可能な範囲で端末内で行います<br>
保存するデータ：設定値、解析結果の要約（傾向グラフ用の集計）、進捗（レベル/ティア等）など、拡張機能の動作に必要な情報を保存します<br>
保存しない/目的外利用しない：ユーザーの操作を監視する目的では使用しません（CanSee＝監視ではなく見える化）<br>
透明性：必要に応じてログ表示機能を通し、何が行われているか確認できるようにしています<br>
