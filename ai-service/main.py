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
    current block and update the project database.
    """
    try:
        # Load current project markdown
        current_markdown = load_markdown()
        
        # Apply the patch to the specified section
        updated_markdown = apply_patch_to_section(current_markdown, patch.section, patch.replace)
        
        # Save the updated markdown back to the database
        save_markdown_to_database(updated_markdown)
        
        # Also write to temporary file for debugging
        data_dir = Path(__file__).parent / "data"
        data_dir.mkdir(exist_ok=True)
        outfile = data_dir / "n8n_proposal.md"
        outfile.write_text(
            f"### {patch.section} / {patch.h2 or '(root)'}\n\n{patch.replace}",
            encoding="utf-8",
        )
        
        # Log the received patch
        print(f"Applied n8n patch for section '{patch.section}': {len(patch.replace)} characters")
        
        return {"status": "applied", "section": patch.section, "file": str(outfile)}
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail={"error": f"Failed to process patch: {str(e)}"}
        )


# Helper functions
def load_markdown():
    """Load the project markdown from the SQLite database (same as frontend)"""
    try:
        # Use the same database file as the frontend (in project root)
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



def extract_section(markdown: str, section_name: str) -> str:
    """Extract section content between ## headers"""
    lines = markdown.split('\n')
    section_start = None
    section_end = len(lines)
    
    # Find the start of our section
    for i, line in enumerate(lines):
        if re.match(rf'^\s*##\s+{re.escape(section_name)}\s*$', line, re.I):
            section_start = i + 1
            break
    
    if section_start is None:
        return ""
    
    # Find the end (next ## header)
    for i in range(section_start, len(lines)):
        if re.match(r'^\s*##\s+', lines[i]):
            section_end = i
            break
    
    # Extract and clean the content
    content_lines = lines[section_start:section_end]
    # Remove empty lines at start and end
    while content_lines and not content_lines[0].strip():
        content_lines.pop(0)
    while content_lines and not content_lines[-1].strip():
        content_lines.pop()
    
    return '\n'.join(content_lines)


def apply_patch_to_section(markdown: str, section_name: str, new_content: str) -> str:
    """Replace the content of a specific section in the markdown"""
    lines = markdown.split('\n')
    section_header_index = None
    section_start = 0
    section_end = len(lines)
    
    # Find the section header
    for i, line in enumerate(lines):
        if re.match(rf'^\s*##\s+{re.escape(section_name)}\s*$', line, re.I):
            section_header_index = i
            section_start = i + 1
            break
    
    if section_header_index is None:
        # Section doesn't exist, add it at the end
        if lines and lines[-1].strip():
            lines.append('')  # Add blank line before new section
        lines.append(f'## {section_name}')
        lines.append('')
        lines.extend(new_content.split('\n'))
        return '\n'.join(lines)
    
    # Find the end of the section (next ## header)
    for i in range(section_start, len(lines)):
        if re.match(r'^\s*##\s+', lines[i]):
            section_end = i
            break
    
    # Replace the section content
    new_lines = lines[:section_start]
    
    # Add the new content
    if new_content.strip():
        new_lines.extend(new_content.split('\n'))
    
    # Add remaining lines after the section
    if section_end < len(lines):
        new_lines.extend(lines[section_end:])
    
    return '\n'.join(new_lines)


def save_markdown_to_database(markdown: str):
    """Save the updated markdown to the database"""
    try:
        # Use the same database file as the frontend (in project root)
        db_path = Path(__file__).parent.parent / "writegeist.db"
        
        # Connect to database and update the project markdown
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
        
        # Update the project markdown
        cursor.execute(
            "INSERT OR REPLACE INTO project_pages (id, markdown) VALUES (1, ?)",
            (markdown,),
        )
        
        conn.commit()
        conn.close()
        
        print("Successfully saved updated markdown to database")
        
    except Exception as e:
        print(f"Error saving to database: {e}")
        raise
