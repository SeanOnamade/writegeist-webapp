from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import re
import sqlite3
import asyncio

# LangGraph integration - loads environment variables
from chapter_ingest_graph import run_chapter_ingest

# Markdown normalization utility
from utils.normalize_md import normalize_markdown, clean_html_artifacts

# Vector search service for Story Query Chat
from vector_search import VectorSearchService

# TTS service for audio generation
from tts_service import TTSService

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

# Add CORS middleware - SECURE: Only allow localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Webpack dev server
        "http://127.0.0.1:3000",  # Webpack dev server (alt)
        "http://localhost:9876",  # Audio server
        "http://127.0.0.1:9876",  # Audio server (alt)
    ],
    allow_credentials=False,  # No credentials needed for localhost
    allow_methods=["GET", "POST"],  # Only needed methods
    allow_headers=["Content-Type", "Authorization"],  # Only needed headers
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


class StoryQueryRequest(BaseModel):
    """Request model for story query chat."""
    message: str
    top_k: int = 5  # Number of search results to include


class StoryQueryResponse(BaseModel):
    """Response model for story query chat."""
    response: str
    citations: List[Dict[str, Any]]
    search_results: List[Dict[str, Any]]
    query_used: str


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
        # Validate section name
        if not section_name or not section_name.strip():
            raise HTTPException(
                status_code=400,
                detail={"error": "Section name cannot be empty"}
            )
        
        # Sanitize section name
        section_name = section_name.strip()
        
        # Load markdown with error handling
        try:
            markdown_content = load_markdown()
        except Exception as db_error:
            raise HTTPException(
                status_code=500,
                detail={"error": f"Database connection failed: {str(db_error)}"}
            )
        
        if not markdown_content:
            raise HTTPException(
                status_code=404,
                detail={"error": "No project document found"}
            )
        
        section_content = extract_section(markdown_content, section_name)
        
        # Check if section exists
        if section_content is None:
            raise HTTPException(
                status_code=404,
                detail={"error": f"Section '{section_name}' not found"}
            )
        
        # Normalize the content before returning
        normalized_content = normalize_markdown(section_content)
        return {"markdown": normalized_content}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to load project section: {str(e)}"},
        )


@app.get("/project/raw")
def get_raw_project_doc():
    """
    Get the raw project document from the database.
    """
    try:
        # Load markdown with error handling
        try:
            markdown_content = load_markdown()
        except Exception as db_error:
            raise HTTPException(
                status_code=500,
                detail={"error": f"Database connection failed: {str(db_error)}"}
            )
        
        if not markdown_content:
            # Return default markdown if none exists
            markdown_content = create_default_project_markdown()
        
        return {"raw_markdown": markdown_content}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to load project document: {str(e)}"},
        )


@app.post("/project/raw")
def update_raw_project_doc(request: dict):
    """
    Update the entire project document in the database.
    Used for syncing local changes to cloud before idea processing.
    """
    try:
        # Validate request
        if not request or "raw_markdown" not in request:
            raise HTTPException(
                status_code=400,
                detail={"error": "raw_markdown field is required"}
            )
        
        raw_markdown = request["raw_markdown"]
        
        # Validate content
        if not isinstance(raw_markdown, str):
            raise HTTPException(
                status_code=400,
                detail={"error": "raw_markdown must be a string"}
            )
        
        # Normalize the markdown before saving
        try:
            normalized_markdown = normalize_markdown(raw_markdown)
        except Exception as norm_error:
            raise HTTPException(
                status_code=400,
                detail={"error": f"Failed to normalize markdown: {str(norm_error)}"}
            )
        
        # Save to database
        try:
            save_markdown_to_database(normalized_markdown)
        except Exception as save_error:
            raise HTTPException(
                status_code=500,
                detail={"error": f"Failed to save to database: {str(save_error)}"}
            )
        
        return {
            "success": True,
            "message": "Project document updated successfully",
            "content_length": len(normalized_markdown)
        }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to update project document: {str(e)}"},
        )


@app.post("/project/cleanup", status_code=200)
def cleanup_project_doc():
    """
    Clean up HTML artifacts and normalize the entire project document.
    This fixes corrupted markdown with mixed HTML tags.
    """
    try:
        # Load current project markdown
        db_path = Path(__file__).parent.parent / "writegeist.db"
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT markdown FROM project_pages WHERE id = 1")
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {"error": "No project document found"}
        
        original_markdown = result[0]
        
        # Clean HTML artifacts and normalize
        cleaned_markdown = clean_html_artifacts(original_markdown)
        final_markdown = normalize_markdown(cleaned_markdown)
        
        # Save back to database
        cursor.execute(
            "UPDATE project_pages SET markdown = ? WHERE id = 1",
            (final_markdown,)
        )
        conn.commit()
        conn.close()
        
        return {
            "status": "cleaned",
            "original_length": len(original_markdown),
            "cleaned_length": len(final_markdown),
            "html_artifacts_removed": original_markdown != cleaned_markdown,
            "formatting_normalized": cleaned_markdown != final_markdown
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to clean project: {str(e)}"}
        )


@app.post("/project/normalize", status_code=200)
def normalize_project_doc():
    """
    Manually normalize the entire project document to fix formatting issues.
    This is a utility endpoint for debugging and fixing formatting problems.
    """
    try:
        # Load current project markdown
        current_markdown = load_markdown()
        
        # Apply normalization
        normalized_markdown = normalize_markdown(current_markdown)
        
        # Save back to database
        save_markdown_to_database(normalized_markdown)
        
        return {
            "status": "normalized",
            "original_length": len(current_markdown),
            "normalized_length": len(normalized_markdown),
            "changes_made": current_markdown != normalized_markdown
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to normalize project: {str(e)}"}
        )


@app.post("/n8n/proposal", status_code=202)
def accept_patch(patch: Patch):
    """
    n8n sends a complete markdown block that should replace the
    current block and update the project database.
    Also handles full document sync when section is "FULL_DOCUMENT_SYNC".
    """
    try:
        # Validate patch input
        if not patch.section or not patch.section.strip():
            raise HTTPException(
                status_code=400,
                detail={"error": "Section name is required and cannot be empty"}
            )
        
        if not patch.replace and patch.replace != "":
            raise HTTPException(
                status_code=400,
                detail={"error": "Replace content is required"}
            )
        
        # Sanitize section name
        section_name = patch.section.strip()
        
        # Special case: Full document sync
        if section_name == "FULL_DOCUMENT_SYNC":
            # Replace the entire document with the provided content
            try:
                normalized_content = normalize_markdown(patch.replace)
                save_markdown_to_database(normalized_content)
                print(f"Full document sync completed: {len(normalized_content)} characters")
                return {"status": "success", "message": "Full document synced successfully"}
            except Exception as sync_error:
                raise HTTPException(
                    status_code=500,
                    detail={"error": f"Failed to sync full document: {str(sync_error)}"}
                )
        
        # Normal section-based processing
        # Validate section name against known sections
        valid_sections = ["Ideas-Notes", "Setting", "Full Outline", "Characters", "Plot", "Themes"]
        if section_name not in valid_sections:
            # Log warning but don't fail - allow dynamic sections
            print(f"Warning: Unknown section '{section_name}'. Valid sections: {valid_sections}")
        
        # Load current project markdown with error handling
        try:
            current_markdown = load_markdown()
        except Exception as db_error:
            raise HTTPException(
                status_code=500,
                detail={"error": f"Failed to load current project: {str(db_error)}"}
            )
        
        if not current_markdown:
            # Create default markdown if none exists
            current_markdown = create_default_project_markdown()
        
        # Normalize the patch content before applying
        try:
            normalized_patch = normalize_markdown(patch.replace)
        except Exception as norm_error:
            raise HTTPException(
                status_code=400,
                detail={"error": f"Failed to normalize patch content: {str(norm_error)}"}
            )
        
        # Apply the patch to the specified section
        try:
            updated_markdown = apply_patch_to_section(current_markdown, section_name, normalized_patch)
        except Exception as patch_error:
            raise HTTPException(
                status_code=500,
                detail={"error": f"Failed to apply patch to section '{section_name}': {str(patch_error)}"}
            )
        
        # Normalize the entire document before saving
        try:
            final_markdown = normalize_markdown(updated_markdown)
        except Exception as final_norm_error:
            print(f"[ERROR] Final document normalization failed: {str(final_norm_error)}")
            raise HTTPException(
                status_code=500,
                detail={"error": "Document processing failed"}
            )
        
        # Save the updated markdown back to the database
        try:
            save_markdown_to_database(final_markdown)
        except Exception as save_error:
            print(f"[ERROR] Database save operation failed: {str(save_error)}")
            raise HTTPException(
                status_code=500,
                detail={"error": "Failed to save changes"}
            )
        
        # Also write to temporary file for debugging
        try:
            data_dir = Path(__file__).parent / "data"
            data_dir.mkdir(exist_ok=True)
            outfile = data_dir / "n8n_proposal.md"
            outfile.write_text(
                f"### {section_name} / {patch.h2 or '(root)'}\n\n{normalized_patch}",
                encoding="utf-8",
            )
        except Exception as file_error:
            # Don't fail the request if debug file can't be written
            print(f"Warning: Could not write debug file: {file_error}")
        
        # Log the received patch
        print(f"Applied n8n patch for section '{section_name}': {len(normalized_patch)} characters")
        
        return {"status": "accepted"}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"[ERROR] Patch processing failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to process request"},
        )


# Helper functions
def load_markdown():
    """Load the project markdown from the SQLite database (same as frontend)"""
    try:
        # Use the same database file as the frontend (in project root)
        db_path = Path(__file__).parent.parent / "writegeist.db"

        # Check if database file exists and is readable
        if not db_path.exists():
            print(f"Database file not found at {db_path}, creating default project")
            return create_default_project_doc(db_path)
        
        if not os.access(db_path, os.R_OK):
            print(f"[ERROR] Database file not readable: {db_path}")
            raise Exception("Database file access denied")

        # Connect to database with timeout and error handling
        try:
            conn = sqlite3.connect(str(db_path), timeout=10.0)  # 10 second timeout
            conn.execute("PRAGMA busy_timeout = 10000")  # 10 second busy timeout
            cursor = conn.cursor()
        except sqlite3.OperationalError as db_error:
            raise Exception(f"Failed to connect to database: {str(db_error)}")
        except Exception as conn_error:
            print(f"[ERROR] Database connection failed: {str(conn_error)}")
            raise Exception("Database connection failed")

        try:
            # Test database integrity
            cursor.execute("PRAGMA integrity_check")
            integrity_result = cursor.fetchone()
            if integrity_result[0] != 'ok':
                raise Exception(f"Database integrity check failed: {integrity_result[0]}")

            # Get the project markdown from project_pages table
            cursor.execute("SELECT markdown FROM project_pages WHERE id = 1")
            result = cursor.fetchone()

            if result:
                markdown_content = result[0]
                if not markdown_content:
                    print("Warning: Empty markdown content in database, using default")
                    markdown_content = create_default_project_markdown()
            else:
                # No project document exists, create default
                print("No project document found in database, creating default")
                markdown_content = create_default_project_doc(db_path)

            # Normalize the markdown before returning
            normalized_content = normalize_markdown(markdown_content)
            return normalized_content

        except sqlite3.Error as sql_error:
            print(f"[ERROR] Database query failed: {str(sql_error)}")
            raise Exception("Database query failed")
        except Exception as query_error:
            print(f"[ERROR] Database query execution failed: {str(query_error)}")
            raise Exception("Database operation failed")
        finally:
            try:
                conn.close()
            except:
                pass  # Ignore close errors

    except Exception as e:
        print(f"Error loading from database: {e}")
        # Fallback to default content with detailed error info
        fallback_content = create_default_project_markdown()
        print(f"Using fallback content due to database error: {str(e)}")
        return fallback_content


def create_default_project_doc(db_path):
    """Create default project document in database with enhanced error handling"""
    default_markdown = create_default_project_markdown()

    try:
        # Ensure directory exists
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(str(db_path), timeout=10.0)
        conn.execute("PRAGMA busy_timeout = 10000")
        cursor = conn.cursor()

        # Create tables if they don't exist (same as frontend)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_pages (
                id INTEGER PRIMARY KEY,
                markdown TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        print(f"Created default project document in database: {db_path}")
        return default_markdown

    except sqlite3.Error as sql_error:
        print(f"SQLite error creating default project: {sql_error}")
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
    
    # Clean up extra asterisks that might be added by n8n processing
    # If the entire section starts with a standalone asterisk, remove it
    if content_lines and content_lines[0].strip() == '*':
        content_lines.pop(0)
        # Also remove any empty lines after the asterisk
        while content_lines and not content_lines[0].strip():
            content_lines.pop(0)
    
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
    """Save the updated markdown to the database with enhanced error handling"""
    try:
        # Validate input
        if markdown is None:
            raise ValueError("Markdown content cannot be None")
        
        # Use the same database file as the frontend (in project root)
        db_path = Path(__file__).parent.parent / "writegeist.db"
        
        # Ensure directory exists
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Connect to database with timeout and error handling
        try:
            conn = sqlite3.connect(str(db_path), timeout=10.0)
            conn.execute("PRAGMA busy_timeout = 10000")
            cursor = conn.cursor()
        except sqlite3.OperationalError as db_error:
            raise Exception(f"Failed to connect to database for save: {str(db_error)}")
        
        try:
            # Create tables if they don't exist (match frontend schema exactly)
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS project_pages (
                    id INTEGER PRIMARY KEY,
                    markdown TEXT NOT NULL
                )
            """
            )
            
            # Update the project markdown (match frontend approach)
            cursor.execute(
                """
                INSERT OR REPLACE INTO project_pages (id, markdown) 
                VALUES (1, ?)
                """,
                (markdown,),
            )
            
            conn.commit()
            print(f"Successfully saved updated markdown to database ({len(markdown)} characters)")
            
        except sqlite3.Error as sql_error:
            conn.rollback()
            raise Exception(f"Database save error: {str(sql_error)}")
        except Exception as save_error:
            conn.rollback()
            raise Exception(f"Error saving to database: {str(save_error)}")
        finally:
            try:
                conn.close()
            except:
                pass  # Ignore close errors
        
    except Exception as e:
        print(f"Error saving to database: {e}")
        raise  # Re-raise to be handled by caller


# Initialize vector search service
def get_vector_search_service():
    """Get or create vector search service instance."""
    db_path = Path(__file__).parent.parent / "writegeist.db"
    return VectorSearchService(str(db_path))


# Initialize TTS service (singleton pattern)
_tts_service_instance = None

def get_tts_service():
    """Get or create TTS service instance (singleton)."""
    global _tts_service_instance
    if _tts_service_instance is None:
        _tts_service_instance = TTSService()
        # print("TTS Service singleton initialized")  # Verbose: commented out
    return _tts_service_instance


@app.post("/story_query_chat")
def story_query_chat(request: StoryQueryRequest):
    """
    Chat with your story using vector search + GPT-4o.
    Searches for relevant content and generates contextual responses.
    """
    # Check if OpenAI API key is configured
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=501, detail={"error": "No API key"})

    try:
        # Initialize vector search service
        vector_service = get_vector_search_service()
        
        # Search for relevant content
        search_results = vector_service.search_similar_content(
            request.message, 
            top_k=request.top_k
        )
        
        if not search_results:
            return StoryQueryResponse(
                response="I couldn't find any relevant content in your story to answer that question. Try asking about specific characters, locations, or events that might be mentioned in your chapters.",
                citations=[],
                search_results=[],
                query_used=request.message
            )
        
        # Build context from search results
        context_parts = []
        citations = []
        
        for result in search_results:
            chunk = result.chunk
            context_parts.append(f"From Chapter '{chunk.chapter_title}':\n{chunk.text}\n")
            
            citations.append({
                "chapter_id": chunk.chapter_id,
                "chapter_title": chunk.chapter_title,
                "relevant_text": chunk.text[:200] + "..." if len(chunk.text) > 200 else chunk.text,
                "similarity": round(result.similarity, 3),
                "chunk_index": chunk.chunk_index
            })
        
        context = "\n".join(context_parts)
        
        # Generate response using GPT-4o
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
        
        prompt = f"""
        You are a helpful AI assistant that answers questions about a user's story based on the provided context from their chapters.

        Context from the story:
        {context}

        User Question: {request.message}

        Instructions:
        1. Answer the question based ONLY on the provided context
        2. Be conversational and helpful
        3. If the context doesn't contain enough information, say so
        4. Reference specific details from the chapters when possible
        5. Keep your response concise but informative

        Response:
        """
        
        response = llm.invoke(prompt)
        
        return StoryQueryResponse(
            response=str(response.content),
            citations=citations,
            search_results=[{
                "chapter_id": result.chunk.chapter_id,
                "chapter_title": result.chunk.chapter_title,
                "text": result.chunk.text,
                "similarity": round(result.similarity, 3)
            } for result in search_results],
            query_used=request.message
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail={"error": f"Story query chat failed: {str(e)}"}
        )


@app.post("/rebuild_embeddings")
def rebuild_embeddings():
    """
    Rebuild embeddings for all chapters. This is useful after adding new chapters
    or when the embedding model has been updated.
    """
    try:
        vector_service = get_vector_search_service()
        result = vector_service.rebuild_all_embeddings()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to rebuild embeddings: {str(e)}"}
        )


@app.get("/embeddings/status")
def get_embeddings_status():
    """
    Get information about the current state of embeddings.
    """
    try:
        vector_service = get_vector_search_service()
        return vector_service.get_chapter_info()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to get embeddings status: {str(e)}"}
        )


@app.delete("/embeddings/cleanup/{chapter_id}")
def cleanup_embeddings_for_chapter(chapter_id: str):
    """
    Clean up embeddings for a deleted chapter.
    """
    try:
        vector_service = get_vector_search_service()
        
        # Delete embeddings for the chapter
        db_path = Path(__file__).parent.parent / "writegeist.db"
        with sqlite3.connect(str(db_path)) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            cursor = conn.cursor()
            cursor.execute("DELETE FROM chapter_embeddings WHERE chapter_id = ?", (chapter_id,))
            deleted_count = cursor.rowcount
            conn.commit()
        
        return {
            "success": True, 
            "message": f"Cleaned up {deleted_count} embeddings for chapter {chapter_id}",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to clean up embeddings: {str(e)}"}
        )

@app.post("/embeddings/generate/{chapter_id}")
def generate_embeddings_for_chapter(chapter_id: str):
    """
    Generate embeddings for a specific chapter.
    """
    try:
        vector_service = get_vector_search_service()
        success = vector_service.generate_embeddings_for_chapter(chapter_id)
        
        if success:
            return {"success": True, "message": f"Generated embeddings for chapter {chapter_id}"}
        else:
            raise HTTPException(
                status_code=404,
                detail={"error": f"Chapter {chapter_id} not found or failed to process"}
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to generate embeddings: {str(e)}"}
        )


# TTS Endpoints
class AudioGenerateRequest(BaseModel):
    chapter_id: str


class AudioStatusRequest(BaseModel):
    chapter_id: str


@app.post("/audio/generate")
async def generate_audio(request: AudioGenerateRequest, background_tasks: BackgroundTasks):
    """
    Generate audio for a chapter (runs in background).
    """
    try:
        tts_service = get_tts_service()
        
        # Create audio record
        audio_id = tts_service.create_audio_record(request.chapter_id)
        
        # Add background task to generate audio
        background_tasks.add_task(
            tts_service.process_chapter,
            request.chapter_id,
            audio_id
        )
        
        return {
            "success": True,
            "audio_id": audio_id,
            "message": "Audio generation started"
        }
    except Exception as e:
        print(f"[ERROR] Audio generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to start audio generation"}
        )


@app.get("/audio/status/{chapter_id}")
def get_audio_status(chapter_id: str):
    """
    Get audio generation status for a chapter.
    """
    try:
        tts_service = get_tts_service()
        status = tts_service.get_audio_status(chapter_id)
        
        if status:
            return {
                "success": True,
                "audio": status
            }
        else:
            return {
                "success": False,
                "message": "No audio found for chapter"
            }
    except Exception as e:
        print(f"[ERROR] Audio status retrieval failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to get audio status"}
        )


@app.post("/audio/cleanup")
def cleanup_audio_files():
    """
    Clean up old audio files to save disk space.
    """
    try:
        tts_service = get_tts_service()
        tts_service.cleanup_old_audio_files(keep_count=100)
        
        return {
            "success": True,
            "message": "Audio cleanup completed"
        }
    except Exception as e:
        print(f"[ERROR] Audio cleanup failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to cleanup audio files"}
        )


@app.delete("/audio/cleanup/{chapter_id}")
def cleanup_audio_for_chapter(chapter_id: str):
    """
    Clean up audio files for a specific deleted chapter.
    """
    try:
        tts_service = get_tts_service()
        
        # Get audio info before cleanup
        audio_data = tts_service.get_audio_status(chapter_id)
        
        if audio_data and audio_data.get('audio_url'):
            audio_path = Path(audio_data['audio_url'])
            
            # Delete the audio file if it exists
            if audio_path.exists():
                audio_path.unlink()
                print(f"Audio file deleted: {audio_path}")
            
            # Delete database record (should already be handled by CASCADE, but being explicit)
            conn = sqlite3.connect(tts_service.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM chapter_audio WHERE chapter_id = ?", (chapter_id,))
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "message": f"Audio cleaned up for chapter {chapter_id}",
                "deleted_file": str(audio_path),
                "deleted_records": deleted_count
            }
        else:
            return {
                "success": True,
                "message": f"No audio found for chapter {chapter_id}",
                "deleted_records": 0
            }
            
    except Exception as e:
        print(f"[ERROR] Audio cleanup for chapter {chapter_id} failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to cleanup audio for chapter"}
        )


def create_default_project_markdown():
    """Create default project markdown structure"""
    return """# My Project

## Ideas-Notes

## Setting

## Full Outline

## Characters"""
