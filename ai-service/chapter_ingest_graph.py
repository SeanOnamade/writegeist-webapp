"""
LangGraph-based chapter ingestion workflow with OpenAI GPT-4o integration.
"""

from typing import List, Dict, Any, TypedDict
from langgraph.graph import StateGraph, START, END
import json
import os
from langchain_openai import ChatOpenAI


class ChapterState(TypedDict):
    """State object passed between graph nodes."""
    title: str
    text: str
    characters: List[str]
    locations: List[str]
    pov: List[str]
    metadata: Dict[str, Any]
    log: List[str]  # Add log field to track processing steps


# Initialize OpenAI LLM
def get_llm():
    """Get OpenAI LLM instance with error handling."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    
    return ChatOpenAI(model="gpt-4o-mini", temperature=0)


def extract_characters_node(state: ChapterState) -> ChapterState:
    """Extract character names using OpenAI GPT-4o."""
    print("[LangGraph] node extract_characters", flush=True)
    log_entry = f"[LangGraph] node extract_characters - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        prompt = f"""
        Extract all named characters from this chapter text. Return only a JSON list of character names.
        
        Chapter Title: {state['title']}
        
        Text: {state['text'][:2000]}...
        
        Return format: ["Character1", "Character2", ...]
        Only include proper names of people, not titles or descriptions.
        """
        
        response = llm.invoke(prompt)
        
        # Parse the response content
        content = str(response.content).strip()
        if content.startswith('[') and content.endswith(']'):
            characters = json.loads(content)
        else:
            # Fallback: extract from content if not properly formatted
            import re
            matches = re.findall(r'"([^"]+)"', content)
            characters = matches[:10]  # Limit to 10 characters
        
        log_entry += f" - Found {len(characters)} characters: {characters[:3]}..."
        print(f"[LangGraph] extract_characters found: {characters}", flush=True)
            
        return {
            **state,
            "characters": characters,
            "log": state.get("log", []) + [log_entry]
        }
    except Exception as e:
        # Fallback to simple extraction if OpenAI fails
        error_msg = f"Character extraction failed: {e}"
        print(error_msg, flush=True)
        characters = []
        log_entry += f" - ERROR: {error_msg}"
        return {
            **state,
            "characters": characters,
            "log": state.get("log", []) + [log_entry]
        }


def extract_locations_node(state: ChapterState) -> ChapterState:
    """Extract location names using OpenAI GPT-4o."""
    print("[LangGraph] node extract_locations", flush=True)
    log_entry = f"[LangGraph] node extract_locations - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        prompt = f"""
        Extract all named locations from this chapter text. Return only a JSON list of location names.
        
        Chapter Title: {state['title']}
        
        Text: {state['text'][:2000]}...
        
        Return format: ["Location1", "Location2", ...]
        Include cities, countries, buildings, rooms, geographic features, etc.
        Only include specific named places, not generic descriptions.
        """
        
        response = llm.invoke(prompt)
        
        # Parse the response content
        content = str(response.content).strip()
        if content.startswith('[') and content.endswith(']'):
            locations = json.loads(content)
        else:
            # Fallback: extract from content if not properly formatted
            import re
            matches = re.findall(r'"([^"]+)"', content)
            locations = matches[:5]  # Limit to 5 locations
        
        log_entry += f" - Found {len(locations)} locations: {locations[:3]}..."
        print(f"[LangGraph] extract_locations found: {locations}", flush=True)
            
        return {
            **state,
            "locations": locations,
            "log": state.get("log", []) + [log_entry]
        }
    except Exception as e:
        # Fallback to empty if OpenAI fails
        error_msg = f"Location extraction failed: {e}"
        print(error_msg, flush=True)
        locations = []
        log_entry += f" - ERROR: {error_msg}"
        return {
            **state,
            "locations": locations,
            "log": state.get("log", []) + [log_entry]
        }


def extract_pov_node(state: ChapterState) -> ChapterState:
    """Extract point of view using OpenAI GPT-4o."""
    print("[LangGraph] node extract_pov", flush=True)
    log_entry = f"[LangGraph] node extract_pov - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        prompt = f"""
        Analyze the point of view (POV) of this chapter text. Return only a JSON list with the POV type.
        
        Chapter Title: {state['title']}
        
        Text: {state['text'][:1500]}...
        
        Return format: ["First Person"] or ["Second Person"] or ["Third Person Limited"] or ["Third Person Omniscient"]
        
        Guidelines:
        - First Person: Uses "I", "me", "my" from narrator's perspective
        - Second Person: Uses "you" addressing the reader
        - Third Person Limited: Uses "he/she" with one character's perspective
        - Third Person Omniscient: Uses "he/she" with multiple characters' thoughts
        """
        
        response = llm.invoke(prompt)
        
        # Parse the response content
        content = str(response.content).strip()
        if content.startswith('[') and content.endswith(']'):
            pov = json.loads(content)
        else:
            # Fallback: simple analysis
            text_lower = state["text"].lower()
            first_person = text_lower.count(" i ") + text_lower.count("my") + text_lower.count("me")
            third_person = text_lower.count(" he ") + text_lower.count(" she ")
            
            if first_person > third_person:
                pov = ["First Person"]
            else:
                pov = ["Third Person"]
        
        log_entry += f" - Detected POV: {pov[0] if pov else 'Unknown'}"
        print(f"[LangGraph] extract_pov found: {pov}", flush=True)
            
        return {
            **state,
            "pov": pov,
            "log": state.get("log", []) + [log_entry]
        }
    except Exception as e:
        # Fallback to simple analysis if OpenAI fails
        error_msg = f"POV extraction failed: {e}"
        print(error_msg, flush=True)
        text_lower = state["text"].lower()
        first_person = text_lower.count(" i ") + text_lower.count("my") + text_lower.count("me")
        third_person = text_lower.count(" he ") + text_lower.count(" she ")
        
        if first_person > third_person:
            pov = ["First Person"]
        else:
            pov = ["Third Person"]
        
        log_entry += f" - ERROR: {error_msg} - Fallback POV: {pov[0] if pov else 'Unknown'}"
        return {
            **state,
            "pov": pov,
            "log": state.get("log", []) + [log_entry]
        }


def generate_metadata_node(state: ChapterState) -> ChapterState:
    """Generate enhanced metadata using OpenAI analysis."""
    print("[LangGraph] node generate_metadata", flush=True)
    log_entry = f"[LangGraph] node generate_metadata - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        prompt = f"""
        Analyze this chapter and return metadata in JSON format:
        
        Chapter Title: {state['title']}
        Text: {state['text'][:1000]}...
        
        Return JSON with:
        - sentiment: "positive", "negative", or "neutral"
        - tone: brief description
        - reading_time_minutes: estimated time
        - complexity: "simple", "moderate", or "complex"
        
        Format: {{"sentiment": "...", "tone": "...", "reading_time_minutes": X, "complexity": "..."}}
        """
        
        response = llm.invoke(prompt)
        
        # Parse AI response
        content = str(response.content).strip()
        if content.startswith('{') and content.endswith('}'):
            ai_metadata = json.loads(content)
        else:
            ai_metadata = {"sentiment": "neutral", "tone": "unknown"}
        
        # Combine with basic stats
        metadata = {
            "word_count": len(state["text"].split()),
            "character_count": len(state["characters"]),
            "location_count": len(state["locations"]),
            "reading_time_minutes": max(1, len(state["text"].split()) // 200),  # ~200 WPM
            **ai_metadata
        }
        
        log_entry += f" - Generated metadata: {len(metadata)} fields, sentiment: {metadata.get('sentiment', 'unknown')}"
        print(f"[LangGraph] generate_metadata created: {metadata}", flush=True)
        
        return {
            **state,
            "metadata": metadata,
            "log": state.get("log", []) + [log_entry]
        }
    except Exception as e:
        # Fallback to basic metadata if OpenAI fails
        error_msg = f"Metadata generation failed: {e}"
        print(error_msg, flush=True)
        metadata = {
            "word_count": len(state["text"].split()),
            "character_count": len(state["characters"]),
            "location_count": len(state["locations"]),
            "reading_time_minutes": max(1, len(state["text"].split()) // 200),
            "sentiment": "neutral",
            "tone": "unknown"
        }
        
        log_entry += f" - ERROR: {error_msg} - Using basic metadata"
        return {
            **state,
            "metadata": metadata,
            "log": state.get("log", []) + [log_entry]
        }


def create_chapter_ingest_graph():
    """
    Creates the LangGraph workflow for chapter ingestion.
    
    Flow: Input → Extract Characters → Extract Locations → Extract POV → Generate Metadata → Output
    """
    graph = StateGraph(ChapterState)
    
    # Add nodes
    graph.add_node("extract_characters", extract_characters_node)
    graph.add_node("extract_locations", extract_locations_node)
    graph.add_node("extract_pov", extract_pov_node)
    graph.add_node("generate_metadata", generate_metadata_node)
    
    # Define the flow
    graph.add_edge(START, "extract_characters")
    graph.add_edge("extract_characters", "extract_locations")
    graph.add_edge("extract_locations", "extract_pov")
    graph.add_edge("extract_pov", "generate_metadata")
    graph.add_edge("generate_metadata", END)
    
    return graph.compile()


def run_chapter_ingest(title: str, text: str) -> Dict[str, Any]:
    """
    Run the chapter ingestion graph and return structured results.
    
    Args:
        title: Chapter title
        text: Chapter content
        
    Returns:
        Dict with extracted metadata in the same format as before, plus logs
    """
    print(f"[LangGraph] Starting chapter ingestion for: {title}", flush=True)
    # Initialize state
    initial_state: ChapterState = {
        "title": title,
        "text": text,
        "characters": [],
        "locations": [],
        "pov": [],
        "metadata": {},
        "log": [f"[LangGraph] Starting processing for chapter: {title}"]
    }
    
    # Run the graph
    graph = create_chapter_ingest_graph()
    result = graph.invoke(initial_state)
    
    print(f"[LangGraph] Completed chapter ingestion for: {title}", flush=True)
    
    # Return in expected format with logs
    return {
        "id": f"chapter_{title.lower().replace(' ', '_')}_{len(text)}",
        "title": result["title"],
        "text": result["text"],
        "characters": result["characters"],
        "locations": result["locations"],
        "pov": result["pov"],
        "metadata": result["metadata"],
        "log": result.get("log", []) + [f"[LangGraph] Completed processing for chapter: {title}"]
    }


# TODO: Future enhancements:
# 1. Add character relationship mapping
# 2. Implement caching for repeated extractions
# 3. Add configuration for different OpenAI models
# 4. Add retry logic with exponential backoff
# 5. Implement function calling for more structured extraction
# 6. Add writing style analysis (readability, complexity metrics)
# 7. Create character arc tracking across chapters 