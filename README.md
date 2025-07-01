# Writegeist Desktop

A modern desktop application for writers to manage their books, chapters, and creative projects with AI-powered analysis.

## Features

- **Chapter Management**: Create and manage your book chapters
- **Smart Character Tracking**: Automatically extract and sync character names across chapters and project overview
- **Project Hub**: Notion-style markdown editing for project notes and outlines
- **Auto-scroll Navigation**: Jump to specific sections in your project document
- **Live Updates**: Project page auto-refreshes when new characters are added
- **Smart H2 Sync**: Each new chapter automatically updates any matching H2 heading ('Characters', 'Setting', 'Full Outline') or creates it if missing
- **Dark Theme**: Professional dark interface optimized for writing
- **Dark, Modern UI**: Built with Tailwind CSS and shadcn/ui components
- **AI-Powered Analysis**: OpenAI GPT-4o powered extraction of characters, locations, and POV
- **Project Markdown Editing**: Notion-style project hub with markdown editing for Ideas/Notes, Setting, Full Outline, and Characters
- **Local Database**: SQLite storage with Drizzle ORM
- **Cross-Platform**: Built with Electron for Windows, macOS, and Linux

## Setup

1. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   npm run start   # runs Electron
   ```

2. **AI Service Setup:**
   ```bash
   cd ai-service
   .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

## 🔑 Environment Variables

Before running the AI service, you need to configure your OpenAI API key:

1. **Copy the environment template:**
   ```bash
   cp .env.template .env
   ```

2. **Get your OpenAI API key from**: https://platform.openai.com/api-keys

3. **Edit `.env` file and replace `your_openai_api_key_here` with your actual API key:**
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

4. **Run the AI service:**
   ```bash
   cd ai-service
   .venv\Scripts\activate  # Windows
   # or source .venv/bin/activate  # Linux/Mac
   uvicorn main:app --reload --port 8000
   ```

**Note**: The AI service will return a 501 error with `{"error":"No API key"}` if the OPENAI_API_KEY is not configured.

3. **Initialize shadcn/ui (if needed):**
   ```bash
   npx shadcn-ui@latest init
   ```

## Development

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui + Electron
- **Backend**: FastAPI (Python) with OpenAI GPT-4o integration via LangGraph
- **Database**: SQLite with Drizzle ORM
- **Icons**: Lucide React

The AI service runs at http://127.0.0.1:8000 with endpoints:
- POST `/echo` - Echo service
- POST `/ingest_chapter` - OpenAI GPT-4o powered chapter analysis and metadata extraction

## File Structure

- `src/renderer/` - React frontend components
- `src/components/ui/` - shadcn/ui components  
- `src/renderer/features/` - Feature-specific components
- `ai-service/` - FastAPI backend for AI processing
- `src/db.ts` - Database schema and connection

## Project Markdown Editing

The app features a Notion-style project hub with ProseMirror-style UX for managing your writing project:

- **Unified Project View**: A single markdown document that serves as your project's central hub
- **Structured Sections**: Pre-organized sections for Ideas/Notes, Setting, Full Outline, and Characters
- **Live Preview**: Switch between editing and formatted preview modes
- **Auto-Save**: Changes are automatically persisted to the local SQLite database
- **Expandable Sidebar**: Accordion-style navigation with nested project sections

### Using the Project Page

1. **Navigate to Project**: Click "Project" in the sidebar or create/open a project from the home screen
2. **Edit Mode**: Click the "Edit" button to switch to markdown editing mode
3. **Preview Mode**: Click "Save" to save changes and return to the formatted preview
4. **Smart Navigation**: The sidebar auto-updates from H2 headings inside your Project doc - any new sections you add will automatically appear in the navigation
5. **Auto-scroll**: Click any section in the sidebar to smoothly scroll to that heading in your document
6. **Auto-open**: The app remembers your last project and automatically opens it when you restart

## Day-2 Upgrade Complete

The app now features:
- Dark theme with sidebar navigation
- Chapter ingest form with AI analysis
- Toast notifications
- Full book chapter listing
- Modern shadcn/ui components

## Smart Character Sync

The app features intelligent character management that connects your chapters with your project overview:

- **Auto-detection**: When you add a new chapter, the AI extracts character names
- **Smart Append**: New characters are automatically added to your Project's Characters section
- **Duplicate Prevention**: The system only adds characters that don't already exist
- **Seamless Integration**: Characters from chapter analysis flow directly into your project documentation

### Character Workflow

1. **Write Chapter**: Add content in the "Insert Chapter" page
2. **AI Analysis**: The system extracts characters, locations, and POV
3. **Auto-sync**: New characters are automatically appended to your Project's Characters section
4. **Manual Management**: You can still manually edit the Characters section in your Project page

## Day-3 Upgrade Complete

The app now includes:
- Notion-style project hub with React Router navigation
- Markdown editing with react-markdown and remark-gfm  
- Accordion sidebar navigation with nested project sections
- Project document persistence with SQLite database
- Home screen for project creation/opening

## Chapter Management

The app provides comprehensive chapter management capabilities:

- **Create Chapters**: Add new chapters with AI-powered analysis
- **Edit Chapters**: Click the edit button on any chapter to modify title and content
- **Update Metadata**: When editing, you can update both the title and text content
- **Smart Navigation**: Seamless switching between chapter list and editor views
- **Auto-save**: Changes are immediately saved to the local database

### Chapter Workflow

1. **View Chapters**: Navigate to "Chapters" in the sidebar to see all your chapters
2. **Create New**: Click "Add Chapter" to create a new chapter with AI analysis
3. **Edit Existing**: Click the edit icon (pencil) on any chapter to modify it
4. **Update Content**: Make your changes and click "Update Chapter" to save
5. **Cancel Changes**: Click "Cancel" to discard edits and return to the original content

## Day-4 Upgrade Complete

New navigation polish and smart character sync features:
- Dynamic sidebar navigation that updates from markdown H2 headings
- Smart auto-scroll to document sections with smooth scrolling
- Auto-open last project functionality with localStorage persistence
- Intelligent character sync between chapters and project documentation
- Enhanced routing with dedicated Chapters page

## Day-5 Upgrade Complete

Chapter editing and management features:
- Full chapter editing functionality with title and content modification
- Unified ChapterEditor component for both creating and editing chapters
- Edit buttons on all chapters in the Chapters page
- Seamless UI transitions between viewing and editing modes
- Database update operations with proper error handling 