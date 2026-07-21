# BFT Consensus Interactive Simulator

ネットワークアルゴリズムおよび分散システムの学習教材として開発された、**PBFT (Practical Byzantine Fault Tolerance) インタラクティブ・シミュレータ** です。

受講生や学習者がパラメータ（ノード数 $N$、ビザンチン障害ノード数 $F$、ノードごとの挙動）を自由に変更し、リアルタイムのメッセージパッシング（`Pre-Prepare`, `Prepare`, `Commit`, `Reply`）と合意形成プロセスを視覚的に観察・理解できます。

---

## 🌟 主な機能・特徴

1. **リアルタイム・ネットワークグラフィック**
   - HTML5 Canvas による動的なノード網の描写と、メッセージパケットの移動アニメーション。
   - リーダーノード（Primary）、正常ノード（Honest）、障害ノード（Byzantine）の視覚的識別。

2. **パラメータ & 挙動のカスタマイズ**
   - 総ノード数 $N$ (3〜12) および プライマリノードの変更。
   - 個別ノードの挙動設定（正常 / 応答なし(Crash) / 一部に嘘をつく(Split Vote) / データ改ざん）。
   - ワンクリックで試せるプリセット（標準合意、合意崩壊、裏切りリーダー、沈黙ノード）。

3. **合意マトリクス & リアルタイムログ**
   - 各ノードがどの段階でクオラム（$2f+1$ の賛成票）に達したかをリアルタイム表示。
   - 詳細なメッセージ通信ログ。

4. **理論学習 & インタラクティブ計算機**
   - $N \ge 3f + 1$ の数式根拠と PBFT 3フェーズの解説。
   - 閾値リアルタイム計算機および理解度確認クイズ。

5. **GitHub Pages 直接公開対応**
   - ビルドステップ不要のピュア HTML5/CSS3/JavaScript (ES Modules) 構成。

---

## 🚀 ローカルでの実行方法

本アプリは外部依存関係（ビルドツールやライブラリ）が不要なため、以下のいずれかの方法で即座に実行できます。

### 方法1: ブラウザで直接開く
`index.html` をダブルクリックして Web ブラウザ（Chrome / Edge / Firefox / Safari）で開きます。

### 方法2: ローカルローカルサーバーを起動する (推奨)
```bash
# Python を使用する場合
python -m http.server 8000

# Node.js (npx) を使用する場合
npx serve .
```
ブラウザで `http://localhost:8000` または表示されたローカルURLにアクセスします。

---

## 🌐 GitHub Pages での公開方法

1. **リポジトリの作成とプッシュ**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for BFT Simulator"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **GitHub Pages の設定**:
   - GitHub のリポジトリ設定画面（**Settings**）を開きます。
   - 左サイドバーの **Pages** を選択します。
   - **Branch** を `main` / `/(root)` に設定し、**Save** を押します。

3. **アクセス**:
   数分で `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/` にて公開されます。

---

## 📚 参考文献
- Lamport, L., Shostak, R., & Pease, M. (1982). *The Byzantine Generals Problem*.
- Castro, M., & Liskov, B. (1999). *Practical Byzantine Fault Tolerance*.
