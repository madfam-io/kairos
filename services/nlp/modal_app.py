"""Modal deployment configuration for Kairos NLP service.

Deploy with: modal deploy modal_app.py
"""

import modal

# Define the Modal app
app = modal.App("kairos-nlp")

# Create a volume for dictionary data
data_volume = modal.Volume.from_name("kairos-nlp-data", create_if_missing=True)

# Define the container image
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi>=0.109.0",
        "uvicorn[standard]>=0.27.0",
        "paddlepaddle>=2.6.0",
        "paddlenlp>=2.7.0",
        "LAC>=2.1.2",
        "pypinyin>=0.50.0",
        "pydantic>=2.5.0",
        "pydantic-settings>=2.1.0",
        "orjson>=3.9.0",
        "structlog>=24.1.0",
    )
    .run_commands(
        # Download CC-CEDICT dictionary
        "mkdir -p /data",
        "curl -L https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz -o /data/cedict.txt.gz",
        "gunzip /data/cedict.txt.gz",
        "mv /data/cedict.txt /data/cedict_ts.u8",
    )
)


@app.cls(
    image=image,
    gpu="T4",  # Use T4 for cost-effective inference
    memory=4096,
    timeout=300,
    volumes={"/data": data_volume},
    allow_concurrent_inputs=10,
)
class NLPService:
    """Modal class for the NLP service."""

    @modal.enter()
    def load_models(self):
        """Load models when container starts."""
        import os
        import sys

        # Add src to path
        sys.path.insert(0, "/root")

        # Set environment variables
        os.environ["NLP_CEDICT_PATH"] = "/data/cedict_ts.u8"
        os.environ["NLP_HSK_PATH"] = "/data/hsk.json"

        # Import and initialize
        from src.dictionary import load_dictionary
        from src.hsk import load_hsk
        from src.segmenter import load_segmenter

        print("Loading dictionary...")
        load_dictionary("/data/cedict_ts.u8")

        print("Loading HSK vocabulary...")
        load_hsk("/data/hsk.json")

        print("Loading LAC segmenter...")
        load_segmenter(mode="lac")

        print("All models loaded!")

    @modal.method()
    def segment(self, text: str, include_pinyin: bool = True, include_definitions: bool = True, include_hsk: bool = True) -> dict:
        """Segment Chinese text."""
        from src.segmenter import get_segmenter

        segmenter = get_segmenter()
        segments = segmenter.analyze(
            text=text,
            include_pinyin=include_pinyin,
            include_definitions=include_definitions,
            include_hsk=include_hsk,
        )

        return {
            "segments": [s.model_dump() for s in segments],
            "original_text": text,
            "word_count": sum(1 for s in segments if not s.is_punctuation),
        }

    @modal.method()
    def lookup(self, word: str) -> dict:
        """Look up a word in the dictionary."""
        from src.dictionary import get_dictionary
        from src.hsk import get_hsk_classifier

        dictionary = get_dictionary()
        hsk = get_hsk_classifier()

        entry = dictionary.lookup(word)
        if not entry:
            return {"word": word, "found": False}

        return {
            "word": entry.simplified,
            "traditional": entry.traditional if entry.traditional != entry.simplified else None,
            "pinyin": entry.pinyin,
            "definitions": entry.definitions,
            "hsk_level": hsk.get_level(entry.simplified),
            "found": True,
        }

    @modal.method()
    def health(self) -> dict:
        """Health check."""
        from src.dictionary import get_dictionary
        from src.segmenter import get_segmenter

        return {
            "status": "ok",
            "models_loaded": get_segmenter().loaded,
            "dictionary_entries": get_dictionary().entry_count,
        }


@app.function(image=image, volumes={"/data": data_volume})
@modal.asgi_app()
def web_app():
    """Create FastAPI ASGI app for web endpoint."""
    import os
    import sys

    sys.path.insert(0, "/root")
    os.environ["NLP_CEDICT_PATH"] = "/data/cedict_ts.u8"
    os.environ["NLP_HSK_PATH"] = "/data/hsk.json"

    from src.main import app
    return app


# Local entrypoint for testing
@app.local_entrypoint()
def main():
    """Test the deployed service."""
    service = NLPService()

    # Test segmentation
    result = service.segment.remote("你好，我正在学习中文。")
    print("Segmentation result:")
    for seg in result["segments"]:
        if not seg["is_punctuation"]:
            print(f"  {seg['text']} - {seg['pinyin']} - HSK {seg['hsk_level']}")

    # Test lookup
    lookup = service.lookup.remote("学习")
    print(f"\nLookup '学习': {lookup}")

    # Health check
    health = service.health.remote()
    print(f"\nHealth: {health}")
