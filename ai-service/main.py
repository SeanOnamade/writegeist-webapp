from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import re
import sqlite3

# LangGraph integration - loads environment variables
from chapter_ingest_graph import run_chapter_ingest

from pathlib import Path
from dotenv import load_dotenv
import json

# Load .env file (for development)
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


# Load user config file (for production)
def load_user_config():
    """Load configuration from user's AppData directory"""
    try:
        config_dir = Path.home() / "AppData" / "Roaming" / "Writegeist"
        config_file = config_dir / "config.json"

        if config_file.exists():
            print(f"Loading config from: {config_file}")
            with open(config_file, "r") as f:
                config = json.load(f)

            # Set environment variables from config
            for key, value in config.items():
                if value:  # Only set if value is not empty
                    os.environ[key] = str(value)
                    print(f"Loaded config: {key}")
        else:
            print(f"No config file found at: {config_file}")
    except Exception as e:
        print(f"Error loading user config: {e}")


# Load user configuration
load_user_config()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


class EchoReq(BaseModel):
    text: str


class ChapterIngestReq(BaseModel):
    title: str
    text: str


class Patch(BaseModel):
    section: str                # e.g. "Characters"
    h2: str | None = None       # optional sub-header
    replace: str                # the full markdown block


# Remove regex helper functions - now using OpenAI via LangGraph


@app.post("/echo")
def echo(req: EchoReq):
    return {"echo": req.text}


@app.post("/ingest_chapter")
def ingest_chapter(req: ChapterIngestReq):
    """
    Ingest a chapter and extract metadata using OpenAI GPT-4o via LangGraph workflow.
    """
    # Check if OpenAI API key is configured
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=501, detail={"error": "No API key"})

    try:
        # Run the LangGraph workflow with OpenAI
        result = run_chapter_ingest(req.title, req.text)
        return {"log": result.get("log", []), **result}
    except Exception as e:
        # Handle any errors gracefully
        raise HTTPException(
            status_code=500, detail={"error": f"Chapter ingestion failed: {str(e)}"}
        )


@app.get("/project/section/{section_name}")
def get_project_section(section_name: str):
    """
    Get a specific section from the project markdown file.
    """
    try:
        markdown_content = load_markdown()
        section_content = extract_section(markdown_content, section_name)
        return {"markdown": section_content}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to load project section: {str(e)}"},
        )


@app.post("/n8n/proposal", status_code=202)
def accept_patch(patch: Patch):
    """
    n8n sends a complete markdown block that should replace the
    current block (or be queued for manual approval).
    
    For now we just write it to a temporary file so you can see it worked.
    In the future, this could trigger a diff/approval workflow.
    """
    try:
        # Create data directory if it doesn't exist
        data_dir = Path(__file__).parent / "data"
        data_dir.mkdir(exist_ok=True)
        
        # Write the patch to a temporary file for now
        outfile = data_dir / "n8n_proposal.md"
        outfile.write_text(
            f"### {patch.section} / {patch.h2 or '(root)'}\n\n{patch.replace}",
            encoding="utf-8",
        )
        
        # Log the received patch
        print(f"Received n8n patch for section '{patch.section}': {len(patch.replace)} characters")
        
        return {"status": "queued", "section": patch.section, "file": str(outfile)}
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail={"error": f"Failed to process patch: {str(e)}"}
        )


# Helper functions
def load_markdown():
    """Load the project markdown from the SQLite database (same as frontend)"""
    try:
        # Use the same database file as the frontend
        db_path = Path(__file__).parent.parent / "writegeist.db"

        # If database doesn't exist, create it with default content
        if not db_path.exists():
            return create_default_project_doc(db_path)

        # Connect to database and get the project markdown
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Get the project markdown from project_pages table
        cursor.execute("SELECT markdown FROM project_pages WHERE id = 1")
        result = cursor.fetchone()

        if result:
            markdown_content = result[0]
        else:
            # No project document exists, create default
            markdown_content = create_default_project_doc(db_path)

        conn.close()
        return markdown_content

    except Exception as e:
        print(f"Error loading from database: {e}")
        # Fallback to default content
        return """# My Project

## Ideas-Notes

## Setting

## Full Outline

## Characters"""


def create_default_project_doc(db_path):
    """Create default project document in database"""
    default_markdown = """# My Project

## Ideas-Notes

## Setting

## Full Outline

## Characters"""

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Create tables if they don't exist (same as frontend)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_pages (
                id INTEGER PRIMARY KEY,
                markdown TEXT NOT NULL
            )
        """
        )

        # Insert default project document
        cursor.execute(
            "INSERT OR REPLACE INTO project_pages (id, markdown) VALUES (1, ?)",
            (default_markdown,),
        )

        conn.commit()
        conn.close()
        return default_markdown

    except Exception as e:
        print(f"Error creating default project: {e}")
        return default_markdown


def extract_section(markdown_content: str, section_name: str):
    """
    Extract the block under the matching ## <section_name> header (case-insensitive)
    until the next ## or EOF using regex.
    """
    # Create regex pattern to match the section header (case-insensitive)
    pattern = rf"^## {re.escape(section_name)}\s*$"

    # Find all ## headers and their positions
    lines = markdown_content.split("\n")
    section_start = None

    for i, line in enumerate(lines):
        if re.match(pattern, line.strip(), re.IGNORECASE):
            section_start = i
            break

    if section_start is None:
        return ""  # Section not found

    # Find the end of the section (next ## header or EOF)
    section_end = len(lines)
    for i in range(section_start + 1, len(lines)):
        if lines[i].strip().startswith("## "):
            section_end = i
            break

    # Extract the section content (excluding the header)
    section_lines = lines[section_start + 1 : section_end]

    # Remove leading/trailing empty lines
    while section_lines and not section_lines[0].strip():
        section_lines.pop(0)
    while section_lines and not section_lines[-1].strip():
        section_lines.pop()

    return "\n".join(section_lines)
