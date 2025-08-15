import os
import time
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any
import sqlite3
import uuid
from openai import OpenAI
import requests
import json

class TTSService:
    def __init__(self):
        self.openai_client = None
        # Use the database in the project directory (parent of ai-service)
        self.db_path = Path(__file__).parent.parent / "writegeist.db"
        self.audio_dir = Path.home() / "AppData" / "Roaming" / "Writegeist" / "audio"
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.config = self._load_config()
        self._init_clients()
        # Track chapters currently being processed to prevent concurrent generation
        self.active_generations = set()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from AppData"""
        config_path = Path.home() / "AppData" / "Roaming" / "Writegeist" / "config.json"
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = json.load(f)
                # print(f"Loaded TTS config from {config_path}")  # Verbose: commented out
                return config
        else:
            print(f"No config file found at {config_path}")
        return {}
    
    def _init_clients(self):
        """Initialize TTS API clients based on configuration"""
        if self.config.get('OPENAI_API_KEY'):
            self.openai_client = OpenAI(api_key=self.config['OPENAI_API_KEY'])
    
    def _update_audio_status(self, audio_id: str, status: str, audio_url: Optional[str] = None, duration: Optional[int] = None):
        """Update audio record in database"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=10.0)
            cursor = conn.cursor()
            
            if audio_url and duration is not None:
                cursor.execute("""
                    UPDATE chapter_audio 
                    SET status = ?, audio_url = ?, duration = ?, updated_at = datetime('now')
                    WHERE id = ?
                """, (status, audio_url, duration, audio_id))
            else:
                cursor.execute("""
                    UPDATE chapter_audio 
                    SET status = ?, updated_at = datetime('now')
                    WHERE id = ?
                """, (status, audio_id))
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error updating audio status for {audio_id}: {e}")
            raise
    
    def _get_chapter_text(self, chapter_id: str) -> Optional[str]:
        """Get chapter text from database"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=10.0)
            cursor = conn.cursor()
            
            cursor.execute("SELECT text FROM chapters WHERE id = ?", (chapter_id,))
            result = cursor.fetchone()
            
            conn.close()
            return result[0] if result else None
        except Exception as e:
            print(f"Error getting chapter text for {chapter_id}: {e}")
            return None
    
    def _estimate_duration(self, text: str) -> int:
        """Estimate audio duration in seconds based on text length"""
        # Average speaking rate is about 150 words per minute
        words = len(text.split())
        minutes = words / 150
        return int(minutes * 60)
    
    async def generate_audio_openai(self, text: str, voice: str = "alloy", model: str = "tts-1") -> tuple[bytes, int]:
        """Generate audio using OpenAI TTS"""
        if not self.openai_client:
            # Try to reinitialize if config wasn't available initially
            self.config = self._load_config()
            self._init_clients()
            if not self.openai_client:
                raise ValueError("OpenAI API key not configured - please check settings")
        
        # OpenAI TTS has a 4096 character limit per request
        chunks = []
        chunk_size = 4000  # Leave some buffer
        
        print(f"Generating audio with OpenAI TTS - model: {model}, voice: {voice}, text length: {len(text)}")
        
        for i in range(0, len(text), chunk_size):
            chunk_text = text[i:i + chunk_size]
            
            response = self.openai_client.audio.speech.create(
                model=model,
                voice=voice,
                input=chunk_text
            )
            
            chunks.append(response.content)
        
        # Concatenate all audio chunks
        full_audio = b''.join(chunks)
        duration = self._estimate_duration(text)
        
        print(f"Generated audio successfully - size: {len(full_audio)} bytes, estimated duration: {duration}s")
        return full_audio, duration
    
    async def generate_audio_elevenlabs(self, text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> tuple[bytes, int]:
        """Generate audio using ElevenLabs API"""
        api_key = self.config.get('ELEVENLABS_API_KEY')
        if not api_key:
            raise ValueError("ElevenLabs API key not configured")
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }
        
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        
        duration = self._estimate_duration(text)
        return response.content, duration
    
    async def process_chapter(self, chapter_id: str, audio_id: str) -> Dict[str, Any]:
        """Process a single chapter to generate audio"""
        # Check if already processing this chapter
        if chapter_id in self.active_generations:
            raise ValueError(f"Chapter {chapter_id} is already being processed")
        
        try:
            # Mark as active
            self.active_generations.add(chapter_id)
            
            # Update status to processing
            self._update_audio_status(audio_id, "processing")
            
            # Get chapter text
            text = self._get_chapter_text(chapter_id)
            if not text:
                raise ValueError(f"Chapter {chapter_id} not found")
            
            # Validate text content
            text = text.strip()
            if len(text) < 10:
                raise ValueError(f"Chapter {chapter_id} has insufficient text for audio generation")
            
            # Check available disk space (basic check)
            import shutil
            free_space = shutil.disk_usage(self.audio_dir).free
            if free_space < 100 * 1024 * 1024:  # Less than 100MB
                raise ValueError("Insufficient disk space for audio generation")
            
            # Generate audio based on provider
            provider = self.config.get('TTS_PROVIDER', 'openai')
            voice = self.config.get('TTS_VOICE', 'alloy')
            model = self.config.get('TTS_MODEL', 'tts-1')
            
            print(f"Processing audio with provider: {provider}, voice: {voice}, model: {model}")
            
            if provider == 'openai':
                audio_data, duration = await self.generate_audio_openai(text, voice, model)
            elif provider == 'elevenlabs':
                audio_data, duration = await self.generate_audio_elevenlabs(text)
            else:
                raise ValueError(f"Unknown TTS provider: {provider}")
            
            # Save audio file
            audio_filename = f"{chapter_id}.mp3"
            audio_path = self.audio_dir / audio_filename
            
            # Validate audio data before saving
            if not audio_data or len(audio_data) < 1024:  # Less than 1KB likely corrupted
                raise ValueError(f"Generated audio data appears to be corrupted or empty (size: {len(audio_data) if audio_data else 0} bytes)")
            
            with open(audio_path, 'wb') as f:
                f.write(audio_data)
                f.flush()  # Ensure data is written to disk
                os.fsync(f.fileno())  # Force write to disk
            
            # Verify file was written correctly
            if not audio_path.exists():
                raise ValueError("Audio file was not created")
            
            actual_size = audio_path.stat().st_size
            if actual_size < 1024:
                raise ValueError(f"Audio file is too small (size: {actual_size} bytes)")
            
            if actual_size != len(audio_data):
                raise ValueError(f"Audio file size mismatch (expected: {len(audio_data)}, actual: {actual_size})")
            
            # Update database with success
            self._update_audio_status(audio_id, "completed", str(audio_path), duration)
            
            return {
                "success": True,
                "audio_id": audio_id,
                "audio_url": str(audio_path),
                "duration": duration
            }
            
        except Exception as e:
            # Update status to error
            print(f"[ERROR] Audio processing failed for {audio_id}: {str(e)}")
            self._update_audio_status(audio_id, "error")
            return {
                "success": False,
                "audio_id": audio_id,
                "error": "Audio generation failed"
            }
        finally:
            # Always remove from active generations
            self.active_generations.discard(chapter_id)
    
    def create_audio_record(self, chapter_id: str) -> str:
        """Create a new audio record in the database"""
        try:
            if not self.db_path.exists():
                print(f"[ERROR] Database not found at {self.db_path}")
                raise ValueError("Database not accessible")
                
            audio_id = str(uuid.uuid4())
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if chapter_audio table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_audio'")
            if not cursor.fetchone():
                raise ValueError("chapter_audio table does not exist - database may not be initialized")
            
            cursor.execute("""
                INSERT INTO chapter_audio (id, chapter_id, status, created_at, updated_at)
                VALUES (?, ?, 'pending', datetime('now'), datetime('now'))
            """, (audio_id, chapter_id))
            
            conn.commit()
            conn.close()
            
            print(f"Created audio record {audio_id} for chapter {chapter_id}")
            return audio_id
        except Exception as e:
            print(f"Error creating audio record for chapter {chapter_id}: {e}")
            raise
    
    def get_audio_status(self, chapter_id: str) -> Optional[Dict[str, Any]]:
        """Get audio status for a chapter"""
        try:
            if not self.db_path.exists():
                print(f"Database not found at {self.db_path}")
                return None
                
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if chapter_audio table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_audio'")
            if not cursor.fetchone():
                print("chapter_audio table does not exist")
                conn.close()
                return None
            
            cursor.execute("""
                SELECT id, audio_url, duration, status, created_at, updated_at
                FROM chapter_audio
                WHERE chapter_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (chapter_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                audio_data = {
                    "id": result[0],
                    "audio_url": result[1],
                    "duration": result[2],
                    "status": result[3],
                    "created_at": result[4],
                    "updated_at": result[5]
                }
                # print(f"Audio status for chapter {chapter_id}: {audio_data}")  # Verbose: commented out
                return audio_data
            else:
                # print(f"No audio found for chapter {chapter_id}")  # Verbose: commented out
                return None
        except Exception as e:
            print(f"Error getting audio status for chapter {chapter_id}: {e}")
            return None
    
    def cleanup_old_audio_files(self, keep_count: int = 100):
        """Clean up old audio files to save space"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all audio records sorted by creation date
        cursor.execute("""
            SELECT id, audio_url
            FROM chapter_audio
            WHERE status = 'completed'
            ORDER BY created_at DESC
        """)
        
        results = cursor.fetchall()
        
        # Delete files and records beyond keep_count
        cleaned_count = 0
        for i, (audio_id, audio_url) in enumerate(results):
            if i >= keep_count and audio_url:
                try:
                    # Delete file
                    audio_path = Path(audio_url)
                    if audio_path.exists():
                        audio_path.unlink()
                        print(f"Deleted audio file: {audio_path}")
                    
                    # Delete record
                    cursor.execute("DELETE FROM chapter_audio WHERE id = ?", (audio_id,))
                    cleaned_count += 1
                except Exception as e:
                    print(f"Error cleaning up audio {audio_id}: {e}")
        
        if cleaned_count > 0:
            print(f"Cleaned up {cleaned_count} old audio files")
        
        conn.commit()
        conn.close()
        return cleaned_count