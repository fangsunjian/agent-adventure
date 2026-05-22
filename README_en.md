# Agent Adventure

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

English | [简体中文](./README.md)

Agent Adventure is an AI-driven dynamic text adventure game community platform. It leverages Google Gemini for narrative generation and Imagen for illustrations to create a unique and immersive storytelling experience.

## 🎬 Previews

### Gameplay
![Gameplay Screenshot](./docs/media/gameplay.png)

### Demo Video
<video src="https://github.com/fangsunjian/agent-adventure/raw/main/docs/media/demo_video.mp4" controls="controls" muted="muted" style="max-width: 100%;"></video>

### Character and Scene Editor
![Character Editor 1](./docs/media/character_editor_1.png)
![Character Editor 2](./docs/media/character_editor_2.png)

## ✨ Core Features

**🎮 Dynamic Story Generation**
- AI generates rich story content in real-time based on player choices
- Supports multi-turn dialogues and complex plot branches
- Intelligent story summarization and milestone tracking system

**🎨 AI-Generated Visuals**
- Beautiful, AI-generated images tailored to each scene
- Dynamic backgrounds and cover images
- Elegant image loading and error handling

**👥 Community Platform**
- User registration, login, and profile management
- Story creation, editing, publishing, and sharing
- Library system for managing characters, locations, items, and quests

**⚙️ Highly Customizable**
- Flexible AI backend configuration (supports Gemini and OpenAI-compatible APIs)
- Personalized UI settings: themes, scaling, transparency
- Full English and Chinese bilingual support

## 🛠 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI
- **State Management**: TanStack Query (React Query) + Zustand
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **AI SDK**: Vercel AI SDK

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- A configured Supabase project and account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/agent-adventure.git
   cd agent-adventure
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy the example environment file and fill in your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` to include your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

4. **Start the development server**
   ```bash
   npm run dev
   ```

### Database Setup

This project relies on a specific Supabase table structure:
- `profiles` - User profiles
- `stories` - Story content
- `playthroughs` - Game progress

Please refer to the SQL scripts in the `supabase/migrations/` directory to create the corresponding tables and Row Level Security (RLS) policies in your Supabase project.

## 🤝 Contributing

We welcome community contributions! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to learn how to submit Issues and Pull Requests.

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

**Agent Adventure** - Empowering everyone to be a story creator and adventurer 🚀
