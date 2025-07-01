from pathlib import Path
from dotenv import load_dotenv

# project_root/ai-service/__init__.py  → climb one level up to find .env
root_env = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=root_env, override=False)
