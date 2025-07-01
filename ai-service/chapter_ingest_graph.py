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
    """Extract character names with traits using OpenAI GPT-4o."""
    print("[LangGraph] node extract_characters", flush=True)
    log_entry = f"[LangGraph] node extract_characters - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        prompt = f"""
        You are a literary analyst. Extract EVERY distinct character in the passage.
        • For each, include ONE concise trait or role in parentheses.
        • Return a pure JSON array of strings, e.g.
          ["Kane (amnesiac swordsman)", "Tal (telekinetic leader)"]
        
        Chapter Title: {state['title']}
        
        Text: {state['text'][:2000]}...
        
        Return format: ["Character1 (trait/role)", "Character2 (trait/role)", ...]
        Only include proper names of people with their most defining characteristic.
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
        
        log_entry += f" - Found {len(characters)} characters with traits: {characters[:3]}..."
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
    """Extract location names using enhanced OpenAI GPT-4o analysis with post-filtering."""
    print("[LangGraph] node extract_locations", flush=True)
    log_entry = f"[LangGraph] node extract_locations - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        prompt = f"""
        Identify every place, geographic reference, vessel, or room that serves as SETTING.
        Return JSON array of distinct strings (max 8).
        
        Chapter Title: {state['title']}
        
        Text: {state['text'][:2000]}...
        
        Include: cities, countries, buildings, rooms, ships, vehicles, geographic features.
        Focus on specific named places that serve as story settings.
        Return format: ["Location1", "Location2", ...]
        """
        
        response = llm.invoke(prompt)
        
        # Parse the response content
        content = str(response.content).strip()
        if content.startswith('[') and content.endswith(']'):
            raw_locations = json.loads(content)
        else:
            # Fallback: extract from content if not properly formatted
            import re
            matches = re.findall(r'"([^"]+)"', content)
            raw_locations = matches[:8]
        
        # Post-filter locations for quality
        clean_locations = [
            l for l in raw_locations
            if any(c.isupper() for c in l)            # must contain a capital
            and not (len(l.split()) > 3 and " " not in l)  # drop weird long tokens
        ][:8]
        
        log_entry += f" - Found {len(raw_locations)} raw, filtered to {len(clean_locations)} clean settings: {clean_locations[:3]}..."
        print(f"[LangGraph] extract_locations found: {clean_locations}", flush=True)
            
        return {
            **state,
            "locations": clean_locations,
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
    """Extract point of view and tense using OpenAI GPT-4o."""
    print("[LangGraph] node extract_pov", flush=True)
    log_entry = f"[LangGraph] node extract_pov - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        prompt = f"""
        Determine the narrative point-of-view and tense.
        Respond with ONE of:
          "First Person, Past"
          "First Person, Present"
          "Third Person Limited"
          "Third Person Omniscient"
          "Other"
        
        Chapter Title: {state['title']}
        
        Text: {state['text'][:1500]}...
        
        Guidelines:
        - First Person, Past: "I walked", "I had seen"
        - First Person, Present: "I walk", "I see"
        - Third Person Limited: One character's perspective using "he/she"
        - Third Person Omniscient: Multiple characters' thoughts using "he/she"
        - Other: Second person, mixed tenses, or unusual perspectives
        
        Return only one of the exact phrases above.
        """
        
        response = llm.invoke(prompt)
        
        # Parse the response content
        content = str(response.content).strip()
        
        # Validate response is one of the expected formats
        valid_povs = [
            "First Person, Past",
            "First Person, Present", 
            "Third Person Limited",
            "Third Person Omniscient",
            "Other"
        ]
        
        if content in valid_povs:
            pov = [content]
        else:
            # Fallback: analyze text patterns
            text_lower = state["text"].lower()
            first_person = text_lower.count(" i ") + text_lower.count("my") + text_lower.count("me")
            third_person = text_lower.count(" he ") + text_lower.count(" she ")
            
            if first_person > third_person:
                # Check for present vs past tense
                past_indicators = text_lower.count("was") + text_lower.count("had") + text_lower.count("did")
                present_indicators = text_lower.count("am") + text_lower.count("is") + text_lower.count("do")
                
                if present_indicators > past_indicators:
                    pov = ["First Person, Present"]
                else:
                    pov = ["First Person, Past"]
            else:
                pov = ["Third Person Limited"]
        
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
            pov = ["First Person, Past"]
        else:
            pov = ["Third Person Limited"]
        
        log_entry += f" - ERROR: {error_msg} - Fallback POV: {pov[0] if pov else 'Unknown'}"
        return {
            **state,
            "pov": pov,
            "log": state.get("log", []) + [log_entry]
        }


def generate_metadata_node(state: ChapterState) -> ChapterState:
    """Generate enhanced metadata with dedicated prompts for summary, sentiment, and tropes."""
    print("[LangGraph] node generate_metadata", flush=True)
    log_entry = f"[LangGraph] node generate_metadata - Processing chapter: {state['title'][:50]}..."
    
    try:
        llm = get_llm()
        
        # 1. Generate summary with dedicated prompt
        summary_prompt = f"""
        Summarise the passage in ≤ 40 words, 3rd-person, no spoilers.
        Return the raw sentence only.
        
        Text: {state['text'][:1500]}...
        """
        
        summary_response = llm.invoke(summary_prompt)
        summary = str(summary_response.content).strip().strip('"').strip("'")
        
        # 2. Generate sentiment with specific prompt
        sentiment_prompt = f"""
        Return ONE word for the story's overall mood:
          tense, hopeful, tragic, comedic, neutral.
        
        Text: {state['text'][:1000]}...
        """
        
        sentiment_response = llm.invoke(sentiment_prompt)
        sentiment = str(sentiment_response.content).strip().lower()
        
        # Validate sentiment is one of expected values
        valid_sentiments = ["tense", "hopeful", "tragic", "comedic", "neutral"]
        if sentiment not in valid_sentiments:
            sentiment = "neutral"
        
        # 3. Generate tropes with dedicated prompt
        tropes_prompt = f"""
        Name 2-3 literary tropes present
        (e.g. 'heist gone wrong', 'mentor figure', 'time manipulation').
        Return JSON array.
        
        Text: {state['text'][:1500]}...
        
        Format: ["trope1", "trope2", "trope3"]
        """
        
        tropes_response = llm.invoke(tropes_prompt)
        tropes_content = str(tropes_response.content).strip()
        
        # Parse tropes JSON
        if tropes_content.startswith('[') and tropes_content.endswith(']'):
            tropes = json.loads(tropes_content)
        else:
            # Fallback: extract from content if not properly formatted
            import re
            matches = re.findall(r'"([^"]+)"', tropes_content)
            tropes = matches[:3]
        
        # Calculate word count and reading time
        word_count = len(state["text"].split())
        reading_time = max(1, word_count // 200)  # ~200 WPM
        
        # Combine all metadata
        metadata = {
            "word_count": word_count,
            "character_count": len(state["characters"]),
            "location_count": len(state["locations"]),
            "reading_time_minutes": reading_time,
            "sentiment": sentiment,
            "summary": summary,
            "tropes": tropes
        }
        
        log_entry += f" - Generated metadata: sentiment={sentiment}, tropes={len(tropes)}, summary='{summary[:30]}...'"
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
        
        word_count = len(state["text"].split())
        fallback_summary = state["text"][:120] + "..." if len(state["text"]) > 120 else state["text"]
        
        metadata = {
            "word_count": word_count,
            "character_count": len(state["characters"]),
            "location_count": len(state["locations"]),
            "reading_time_minutes": max(1, word_count // 200),
            "sentiment": "neutral",
            "summary": fallback_summary,
            "tropes": []
        }
        
        log_entry += f" - ERROR: {error_msg} - Using fallback metadata"
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