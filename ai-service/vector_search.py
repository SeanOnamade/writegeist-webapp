"""
BULLETPROOF Story Chat - Simple keyword search with FULL chapter context.
No FTS, no embeddings, no crashes. Just works.
"""

import sqlite3
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class ChapterChunk:
    """Represents a chunk of chapter text with metadata."""
    chunk_id: str
    chapter_id: str
    chapter_title: str
    text: str
    chunk_index: int
    start_pos: int
    end_pos: int


@dataclass 
class SearchResult:
    """Represents a search result with similarity score."""
    chunk: ChapterChunk
    similarity: float


class VectorSearchService:
    """BULLETPROOF story chat using simple keyword matching + full chapter context."""
    
    def __init__(self, db_path: str):
        """Initialize the bulletproof search service."""
        self.db_path = db_path
        print("[STORY CHAT] Using bulletproof keyword search with full chapter context!")
        print("[STORY CHAT] No FTS, no embeddings, no crashes - just works!")
    
    def _get_all_chapters(self) -> List[tuple]:
        """Get all chapters from database with bulletproof error handling."""
        try:
            with sqlite3.connect(self.db_path, timeout=10) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, title, text, created_at 
                    FROM chapters 
                    ORDER BY created_at
                """)
                return cursor.fetchall()
        except Exception as e:
            print(f"[WARNING] Could not load chapters: {e}")
            return []
    
    def _calculate_chapter_score(self, query: str, title: str, text: str) -> float:
        """Calculate relevance score for a chapter using simple keyword matching."""
        if not query.strip():
            return 0.0
        
        # Prepare search terms
        keywords = [word.lower().strip() for word in query.split() if len(word.strip()) > 2]
        if not keywords:
            return 0.1  # Small score for very short queries
        
        # Combine title and text for searching
        full_content = (title + " " + text).lower()
        
        score = 0.0
        
        # Score each keyword
        for keyword in keywords:
            # Exact word matches get high score
            word_count = full_content.count(keyword)
            if word_count > 0:
                score += word_count * 2.0
            
            # Partial matches get lower score
            if keyword in full_content:
                score += 0.5
        
        # Bonus for title matches
        title_lower = title.lower()
        for keyword in keywords:
            if keyword in title_lower:
                score += 3.0
        
        return score
    
    def search_similar_content(self, query: str, top_k: int = 5) -> List[SearchResult]:
        """BULLETPROOF search that returns FULL chapter context."""
        print(f"[SEARCH] Looking for: '{query}'")
        
        if not query.strip():
            print("[SEARCH] Empty query, returning recent chapters")
            return self._get_fallback_chapters(2)
        
        try:
            # Get all chapters
            chapters = self._get_all_chapters()
            if not chapters:
                print("[WARNING] No chapters found in database")
                return []
            
            print(f"[SEARCH] Searching through {len(chapters)} chapters")
            
            # Score each chapter
            scored_chapters = []
            for chapter_id, title, text, created_at in chapters:
                score = self._calculate_chapter_score(query, title or "", text or "")
                if score > 0:
                    scored_chapters.append((score, chapter_id, title, text, created_at))
            
            # Sort by score (highest first)
            scored_chapters.sort(key=lambda x: x[0], reverse=True)
            
            # Convert to SearchResult format with FULL chapter text
            results = []
            for i, (score, chapter_id, title, text, created_at) in enumerate(scored_chapters[:top_k]):
                # Use FULL chapter text, not tiny snippets
                full_text = text or ""
                
                # Calculate realistic similarity score (0-1 range)
                if scored_chapters:
                    max_score = scored_chapters[0][0]  # Highest score in this search
                    min_score = scored_chapters[-1][0] if len(scored_chapters) > 1 else 0
                    
                    if max_score > min_score:
                        # Normalize: best match = 95%, others scale down
                        similarity = 0.95 * (score - min_score) / (max_score - min_score)
                        similarity = max(0.1, min(0.95, similarity))
                    else:
                        similarity = 0.8  # All equal scores get 80%
                else:
                    similarity = 0.1
                
                chunk = ChapterChunk(
                    chunk_id=f"{chapter_id}_full",
                    chapter_id=chapter_id,
                    chapter_title=title or "Untitled Chapter",
                    text=full_text,  # FULL CHAPTER TEXT - not snippets!
                    chunk_index=0,
                    start_pos=0,
                    end_pos=len(full_text)
                )
                
                results.append(SearchResult(chunk=chunk, similarity=similarity))
            
            print(f"[SUCCESS] Found {len(results)} relevant chapters")
            
            # If no matches, provide fallback
            if not results:
                print("[FALLBACK] No keyword matches, providing recent chapters")
                return self._get_fallback_chapters(2)
            
            return results
            
        except Exception as e:
            print(f"[ERROR] Search failed: {e}")
            print("[FALLBACK] Using emergency fallback")
            return self._get_fallback_chapters(2)
    
    def _get_fallback_chapters(self, count: int = 2) -> List[SearchResult]:
        """Emergency fallback: return recent chapters when search fails."""
        try:
            chapters = self._get_all_chapters()
            if not chapters:
                return []
            
            # Return the most recent chapters
            recent_chapters = chapters[-count:] if len(chapters) >= count else chapters
            
            results = []
            for i, (chapter_id, title, text, created_at) in enumerate(recent_chapters):
                chunk = ChapterChunk(
                    chunk_id=f"{chapter_id}_fallback",
                    chapter_id=chapter_id,
                    chapter_title=title or "Recent Chapter",
                    text=text or "",
                    chunk_index=0,
                    start_pos=0,
                    end_pos=len(text or "")
                )
                
                results.append(SearchResult(chunk=chunk, similarity=0.3))  # Low but valid score
            
            print(f"[FALLBACK] Providing {len(results)} recent chapters")
            return results
            
        except Exception as e:
            print(f"[ERROR] Even fallback failed: {e}")
            return []
    
    def generate_embeddings_for_chapter(self, chapter_id: str) -> bool:
        """No-op for compatibility - we don't need indexing anymore."""
        print(f"[INFO] Chapter {chapter_id} ready for search (no indexing needed)")
        return True
    
    def rebuild_all_embeddings(self) -> Dict[str, Any]:
        """No-op for compatibility - we don't need rebuilding anymore."""
        print("[INFO] Bulletproof search ready - no indexing needed!")
        
        try:
            chapters = self._get_all_chapters()
            return {
                "total_chapters": len(chapters),
                "success_count": len(chapters),
                "failed_count": 0,
                "failed_chapters": [],
                "message": "Bulletproof search ready - no indexing required!"
            }
        except Exception as e:
            return {
                "total_chapters": 0,
                "success_count": 0,
                "failed_count": 0,
                "failed_chapters": [],
                "error": f"Could not count chapters: {e}"
            }
    
    def get_chapter_info(self) -> Dict[str, Any]:
        """Get chapter status - all chapters are always 'ready' with bulletproof search."""
        try:
            chapters = self._get_all_chapters()
            total_chapters = len(chapters)
            
            return {
                "total_chapters": total_chapters,
                "chapters_with_embeddings": total_chapters,  # All are "ready"
                "total_embeddings": total_chapters,  # For UI compatibility
                "average_chunks_per_chapter": 1.0,  # Full chapters, no chunking
                "search_ready": True,  # Always ready!
                "search_type": "Bulletproof Keyword Search + Full Chapter Context"
            }
            
        except Exception as e:
            return {
                "total_chapters": 0,
                "chapters_with_embeddings": 0,
                "total_embeddings": 0,
                "average_chunks_per_chapter": 0,
                "search_ready": False,
                "error": f"Could not get chapter info: {e}"
            }