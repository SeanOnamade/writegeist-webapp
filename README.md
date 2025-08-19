# Writegeist Platform

A comprehensive AI-powered writing platform available as both desktop and web applications. Create, manage, and enhance your books with intelligent chapter organization, contextual AI chat, and professional audio generation.

## 🌟 **Platform Overview**

### 🖥️ **Desktop Application**
- **Local SQLite storage** with full offline capabilities
- **Bundled Python backend** - no setup required
- **Rich text editor** with real-time formatting
- **Cross-platform installer** for Windows

### 🌐 **Web Application** 
- **Cloud-native architecture** with Supabase backend
- **Real-time collaboration** and multi-user support
- **Professional audio generation** with OpenAI TTS
- **Responsive design** for any device

## 🎵 **Audio System Features**

### **Text-to-Speech Generation**
- **Full-length audio** - Generates 11+ minute narrations from long chapters
- **Intelligent chunking** - Handles unlimited chapter length via 4KB chunking
- **High-quality voices** - OpenAI TTS with multiple voice options
- **Smart truncation** - Finds natural breaking points for optimal audio flow

### **Audio Management**
- **Secure storage** - Audio files stored in Supabase with user isolation
- **Real-time status** - Live updates on generation progress
- **Download functionality** - MP3 files with proper metadata
- **Built-in player** - Stream audio directly in browser

### **Production Ready**
- **Chunking system** - Mirrors desktop version's proven approach
- **Actual duration parsing** - Uses MP3 metadata for accurate timing
- **Error handling** - Comprehensive error states and retry mechanisms
- **Cross-platform** - Works on any device with web browser

## 🚀 **Quick Start**

### **Web Application (Recommended)**

1. **Visit**: https://writegeist-aa24f0db2-seans-projects-9cbbfc68.vercel.app
2. **Sign up** with your email
3. **Add OpenAI API key** in Settings
4. **Create a project** and start writing
5. **Generate audio** from any chapter

### **Desktop Application**

1. **Download** the latest installer from [Releases](../../releases)
2. **Install** and launch Writegeist
3. **Add OpenAI API key** in Settings
4. **Import existing projects** or create new ones

## 🛠️ **Development Setup**

### **Web Application**

```bash
# Clone repository
git clone https://github.com/SeanOnamade/writegeist-webapp.git
cd writegeist-webapp/writegeist-web

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env.local
# Add your Supabase and OpenAI credentials

# Run development server
npm run dev
```

### **Desktop Application**

```bash
# From project root
npm install

# Start development (launches both Electron and Python backend)
npm start

# Build installer
npm run make
```

## 📦 **Deployment**

### **Web Application Deployment**

```bash
# From writegeist-webapp directory (parent):
git add .
git commit -m "your commit message"
git deploy  # Pushes to GitHub AND deploys to Vercel
```

**Alternative (ACPV - separate commands):**
```bash
# From writegeist-webapp directory (parent):
git add .
git commit -m "your commit message"
git push origin main
npx vercel --prod
```

**Why manual deployment?** TailwindCSS v4 uses native modules that don't work on Vercel's Linux servers. Manual deployment builds on your Windows machine where everything works perfectly.

### **Desktop Application Deployment**

```bash
# Build installer
npm run make

# Installers created in /out directory
# Upload to GitHub Releases for distribution
```

## 🔧 **Configuration**

### **Environment Variables**

**Web Application** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

**Desktop Application**:
- Configure through Settings page (no file editing required)
- API keys stored securely in local database

### **Database Setup**

**Web Application** requires Supabase setup:
1. **Create Supabase project**
2. **Run migrations** in `writegeist-web/supabase/migrations/`
3. **Configure RLS policies** (included in migrations)

**Desktop Application** uses local SQLite (no setup required).

## 🎯 **Key Features**

### **Chapter Management**
- **Unlimited chapters** per project
- **Real-time word counting** and statistics
- **Drag-and-drop reordering** 
- **Status tracking** (Draft, In Progress, Completed)

### **AI Integration**
- **Contextual chat** - AI knows your entire project
- **Chapter-aware responses** - References specific content
- **Vector search** - Finds relevant content across all chapters
- **Smart suggestions** - Based on your writing style

### **Audio Generation**
- **Professional narration** - OpenAI TTS with HD quality
- **Multiple voices** - Choose from 6 different voice options
- **Full chapter support** - No length limitations
- **Download & share** - MP3 files for any use

### **Collaboration** (Web Only)
- **Multi-user projects** - Real-time collaboration
- **Secure isolation** - Users only see their own content
- **Cloud sync** - Access from any device
- **Real-time updates** - See changes instantly

## 🔍 **Technical Stack**

### **Web Application**
- **Frontend**: Next.js 15, React 19, TailwindCSS v4
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: OpenAI GPT-4, TTS, Embeddings
- **Deployment**: Vercel with manual builds

### **Desktop Application**
- **Frontend**: Electron, React, TailwindCSS
- **Backend**: Python FastAPI, SQLite
- **AI**: OpenAI GPT-4, TTS, Embeddings  
- **Packaging**: Electron Forge with Squirrel

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/SeanOnamade/writegeist-webapp/issues)
- **Documentation**: See `writegeist-web/` directory for web app docs
- **User Guide**: [USER_GUIDE.md](./USER_GUIDE.md) for desktop app

## 📄 **License**

MIT License - See [LICENSE](./LICENSE) for details.

---

**Writegeist Platform - Where AI meets creative writing.** ✨