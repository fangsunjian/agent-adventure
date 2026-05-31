# Agent Adventure

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[English](./README.md) | [简体中文](./README_zh.md) | 日本語 | [한국어](./README_ko.md)

Agent Adventure は、AI を活用したダイナミックなテキストアドベンチャーゲームコミュニティプラットフォームです。Google Gemini によるシナリオ生成と Imagen によるイラスト生成を活用し、ユニークで没入感のあるストーリー体験を創出します。

## 🎬 プレビュー

### ゲームプレイ
![Gameplay Screenshot](./docs/media/gameplay.png)

### デモ動画
![Demo Video](./docs/media/demo_video.mp4)

### キャラクター＆シーンエディター
![Character Editor 1](./docs/media/character_editor_1.png)
![Character Editor 2](./docs/media/character_editor_2.png)

## ✨ 主な機能

**🎮 ダイナミックなストーリー生成**
- プレイヤーの選択に基づき、AI がリアルタイムで豊かなストーリーを生成
- 複数ターンの会話と複雑なシナリオ分岐に対応
- インテリジェントなストーリーの要約とマイルストーン記録システム

**🎨 AI 生成のビジュアルコンテンツ**
- 各シーンに合わせて AI が美しい画像を生成
- ダイナミックな背景とカバー画像に対応
- エレガントな画像読み込みとエラーハンドリング

**👥 コミュニティプラットフォーム**
- ユーザー登録、ログイン、プロフィール管理
- ストーリーの作成、編集、公開、共有
- キャラクター、場所、アイテム、クエストを管理するライブラリシステム

**⚙️ 高度なカスタマイズ性**
- 柔軟な AI バックエンド設定（Gemini および OpenAI 互換 API をサポート）
- パーソナライズされた UI 設定：テーマ、スケーリング、透明度
- 多言語インターフェースのサポート

## 🛠 技術スタック

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI
- **State Management**: TanStack Query (React Query) + Zustand
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **AI SDK**: Vercel AI SDK

## 🚀 クイックスタート

### 前提条件
- Node.js 18+
- npm または yarn
- 設定済みの Supabase プロジェクトおよびアカウント

### インストールと実行

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/fangsunjian/agent-adventure.git
   cd agent-adventure
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **環境設定**
   サンプル環境ファイルをコピーし、Supabase の認証情報を入力します：
   ```bash
   cp .env.example .env.local
   ```
   `.env.local` ファイルを編集し、`VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を入力します。

4. **開発サーバーの起動**
   ```bash
   npm run dev
   ```

### データベースの設定

このプロジェクトは特定の Supabase テーブル構造に依存しています：
- `profiles` - ユーザープロフィール表
- `stories` - ストーリーコンテンツ表
- `playthroughs` - ゲームの進行状況表

Supabase プロジェクトに対応するテーブルと RLS (Row Level Security) ポリシーを作成するには、`supabase/migrations/` ディレクトリ内の SQL スクリプトを参照してください。

## 🤝 コントリビューション

コミュニティからの貢献を歓迎します！Issue や Pull Request の提出方法については、[コントリビューションガイド](./CONTRIBUTING.md) をお読みください。

## 📄 ライセンス

このプロジェクトは [MIT ライセンス](./LICENSE) の下でオープンソース化されています。

---

**Agent Adventure** - 誰もがストーリーの創作者であり、冒険者になれる場所 🚀
