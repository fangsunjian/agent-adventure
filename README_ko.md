# Agent Adventure

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[English](./README.md) | [简体中文](./README_zh.md) | [日本語](./README_ja.md) | 한국어

Agent Adventure는 AI 기반의 다이내믹 텍스트 어드벤처 게임 커뮤니티 플랫폼입니다. Google Gemini의 스토리 생성 기능과 Imagen의 일러스트 생성을 활용하여 독특하고 몰입감 있는 스토리텔링 경험을 제공합니다.

## 🎬 미리보기

### 게임 플레이
![Gameplay Screenshot](./docs/media/gameplay.png)

### 데모 비디오
[데모 비디오](./docs/media/demo_video.mp4)

### 상점
![Store Screenshot](./docs/media/store.png)

### 캐릭터 및 장면 편집기
![Character Editor 1](./docs/media/character_editor_1.png)
![Character Editor 2](./docs/media/character_editor_2.png)

## ✨ 주요 기능

**🎮 다이내믹 스토리 생성**
- 플레이어의 선택에 따라 AI가 실시간으로 풍부한 스토리를 생성
- 다중 턴 대화 및 복잡한 스토리 분기 지원
- 지능형 스토리 요약 및 마일스톤 기록 시스템

**🎨 AI 생성 시각 콘텐츠**
- 각 장면에 맞춘 아름다운 AI 생성 이미지 제공
- 동적 배경 및 커버 이미지 지원
- 우아한 이미지 로딩 및 오류 처리

**👥 커뮤니티 플랫폼**
- 사용자 등록, 로그인, 프로필 관리
- 스토리 생성, 편집, 게시 및 공유
- 캐릭터, 장소, 아이템, 퀘스트를 관리하는 라이브러리 시스템

**⚙️ 고도의 사용자 정의**
- 유연한 AI 백엔드 설정 (Gemini 및 OpenAI 호환 API 지원)
- 개인화된 UI 설정: 테마, 크기 조절, 투명도
- 다국어 인터페이스 지원

## 🛠 기술 스택

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI
- **State Management**: TanStack Query (React Query) + Zustand
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **AI SDK**: Vercel AI SDK

## 🚀 빠른 시작

### 사전 준비 사항
- Node.js 18+
- npm 또는 yarn
- 설정이 완료된 Supabase 프로젝트 및 계정

### 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone https://github.com/fangsunjian/agent-adventure.git
   cd agent-adventure
   ```

2. **종속성 설치**
   ```bash
   npm install
   ```

3. **환경 설정**
   예제 환경 파일을 복사하고 Supabase 자격 증명을 입력합니다:
   ```bash
   cp .env.example .env.local
   ```
   `.env.local` 파일을 열고 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 입력합니다.

4. **개발 서버 시작**
   ```bash
   npm run dev
   ```

### 데이터베이스 설정

이 프로젝트는 특정한 Supabase 테이블 구조에 의존합니다:
- `profiles` - 사용자 프로필 테이블
- `stories` - 스토리 콘텐츠 테이블
- `playthroughs` - 게임 진행 상황 테이블

Supabase 프로젝트에 해당 테이블과 RLS(Row Level Security) 정책을 생성하려면 `supabase/migrations/` 디렉토리의 SQL 스크립트를 참조하세요.

## 🤝 기여하기

커뮤니티의 기여를 진심으로 환영합니다! Issue 및 Pull Request 제출 방법은 [기여 가이드](./CONTRIBUTING.md)를 참조하세요.

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](./LICENSE) 하에 오픈 소스로 제공됩니다.

---

**Agent Adventure** - 누구나 스토리 창작자이자 모험가가 될 수 있는 곳 🚀
