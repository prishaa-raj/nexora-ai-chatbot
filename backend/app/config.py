"""
Central application configuration.
All values are read from environment variables / .env file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # MongoDB
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "chatbot_db"

    # JWT
    jwt_secret: str = "2oirhwehflflnsdjlfnshfowhf"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    # LLM providers
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"  
     # or "llama-3.1-8b-instant" for speed
    # Embeddings
    embedding_model_name: str = "models/gemini-embedding-001"

    # ChromaDB
    chroma_persist_dir: str = "./chroma_data"
    chroma_collection_name: str = "knowledge_base"

    # App
    cors_origins: str = "http://localhost:5173"
    seed_demo_data: bool = True
    environment: str = "development"  # "development" | "production"

    # Security / deployment
    max_upload_mb: int = 10
    rate_limit_auth: str = "10/minute"  # applied to login + register

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


settings = Settings()