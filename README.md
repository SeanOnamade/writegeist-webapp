# Writegeist Desktop

A Windows desktop writing assistant built with Electron and React.

## Day-1 Setup

```bash
npm install
npm run start   # runs Electron
```

### AI Service Setup

```bash
cd ai-service
.venv\Scripts\activate
uvicorn main:app --reload
```

The AI service should be running at http://127.0.0.1:8000 with a POST /echo endpoint.

## Development

- **Frontend**: React + TypeScript + Electron
- **Backend**: FastAPI (Python) 
- **Database**: SQLite with Drizzle ORM

## First Commit

After setup, run:
```bash
git add .
git commit -m "Day-1 scaffold complete"
``` 