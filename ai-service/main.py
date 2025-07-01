from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

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
            with open(config_file, 'r') as f:
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
        raise HTTPException(
            status_code=501, 
            detail={"error": "No API key"}
        )
    
    try:
        # Run the LangGraph workflow with OpenAI
        result = run_chapter_ingest(req.title, req.text)
        return {"log": result.get("log", []), **result}
    except Exception as e:
        # Handle any errors gracefully
        raise HTTPException(
            status_code=500, 
            detail={"error": f"Chapter ingestion failed: {str(e)}"}
        )