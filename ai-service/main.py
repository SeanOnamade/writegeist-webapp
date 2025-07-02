from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import re

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


# Helper functions
def load_markdown():
    """Load the entire project markdown from data/project.md"""
    project_md_path = Path(__file__).parent / "data" / "project.md"

    # Create folder and file if they don't exist
    project_md_path.parent.mkdir(exist_ok=True)
    if not project_md_path.exists():
        project_md_path.write_text("# Project\n\nThis is your project file.\n")

    return project_md_path.read_text(encoding="utf-8")


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
