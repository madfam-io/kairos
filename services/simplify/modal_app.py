"""Modal deployment for Kairos AI Simplification Service.

Deploy with: modal deploy modal_app.py
"""

import modal

# Define the Modal app
app = modal.App("kairos-simplify")

# Model configuration
MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"
MODEL_REVISION = "main"

# Create image with vLLM and dependencies
vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm>=0.6.0",
        "transformers>=4.44.0",
        "torch>=2.4.0",
        "fastapi>=0.109.0",
        "pydantic>=2.5.0",
        "orjson>=3.9.0",
        "structlog>=24.1.0",
        "tiktoken>=0.8.0",
    )
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "VLLM_ATTENTION_BACKEND": "FLASH_ATTN",
    })
)

# Volume for model cache
model_volume = modal.Volume.from_name("kairos-model-cache", create_if_missing=True)


@app.cls(
    image=vllm_image,
    gpu="A10G",  # or "A100" for faster inference
    timeout=600,
    container_idle_timeout=300,
    volumes={"/root/.cache/huggingface": model_volume},
    allow_concurrent_inputs=16,
    secrets=[modal.Secret.from_name("huggingface-secret", required=False)],
)
class SimplificationModel:
    """vLLM-powered simplification model."""

    @modal.enter()
    def load_model(self):
        """Load the model when container starts."""
        from vllm import LLM, SamplingParams

        print(f"Loading model: {MODEL_ID}")

        self.llm = LLM(
            model=MODEL_ID,
            revision=MODEL_REVISION,
            trust_remote_code=True,
            tensor_parallel_size=1,
            gpu_memory_utilization=0.90,
            max_model_len=4096,
        )

        self.sampling_params = SamplingParams(
            temperature=0.3,
            top_p=0.9,
            max_tokens=512,
            stop=["</s>", "\n\n"],
        )

        print("Model loaded successfully!")

    @modal.method()
    def simplify(
        self,
        text: str,
        target_level: int = 3,
        preserve_names: bool = True,
        context: str | None = None,
    ) -> dict:
        """Simplify a Chinese sentence to target HSK level."""
        from src.prompts import build_messages

        messages = build_messages(text, target_level, context)

        # Format for vLLM chat
        prompt = self._format_chat_prompt(messages)

        outputs = self.llm.generate([prompt], self.sampling_params)
        result = outputs[0].outputs[0].text.strip()

        # Extract just the simplified sentence (remove any extra text)
        simplified = result.split("\n")[0].strip()

        return {
            "original": text,
            "simplified": simplified,
            "target_level": target_level,
            "confidence": 0.9,  # Placeholder
            "tokens_used": len(outputs[0].outputs[0].token_ids),
        }

    @modal.method()
    def simplify_batch(
        self,
        sentences: list[str],
        target_level: int = 3,
        preserve_names: bool = True,
    ) -> list[dict]:
        """Simplify multiple sentences in batch."""
        from src.prompts import build_messages

        prompts = []
        for text in sentences:
            messages = build_messages(text, target_level)
            prompts.append(self._format_chat_prompt(messages))

        outputs = self.llm.generate(prompts, self.sampling_params)

        results = []
        for text, output in zip(sentences, outputs):
            result = output.outputs[0].text.strip()
            simplified = result.split("\n")[0].strip()

            results.append({
                "original": text,
                "simplified": simplified,
                "target_level": target_level,
                "confidence": 0.9,
                "tokens_used": len(output.outputs[0].token_ids),
            })

        return results

    def _format_chat_prompt(self, messages: list[dict]) -> str:
        """Format messages for Qwen chat template."""
        prompt_parts = []

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            if role == "system":
                prompt_parts.append(f"<|im_start|>system\n{content}<|im_end|>")
            elif role == "user":
                prompt_parts.append(f"<|im_start|>user\n{content}<|im_end|>")
            elif role == "assistant":
                prompt_parts.append(f"<|im_start|>assistant\n{content}<|im_end|>")

        # Add assistant prefix for generation
        prompt_parts.append("<|im_start|>assistant\n")

        return "\n".join(prompt_parts)

    @modal.method()
    def health(self) -> dict:
        """Health check."""
        return {
            "status": "ok",
            "model": MODEL_ID,
            "gpu_available": True,
        }


# FastAPI web endpoint
@app.function(
    image=vllm_image,
    volumes={"/root/.cache/huggingface": model_volume},
)
@modal.asgi_app()
def web_app():
    """FastAPI web application."""
    from fastapi import FastAPI, HTTPException, Depends
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field

    app = FastAPI(
        title="Kairos Simplification API",
        description="AI-powered Chinese sentence simplification",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class SimplifyRequest(BaseModel):
        text: str = Field(..., min_length=1, max_length=1000)
        target_level: int = Field(3, ge=1, le=6)
        preserve_names: bool = True
        context: str | None = None

    class BatchRequest(BaseModel):
        sentences: list[str] = Field(..., min_length=1, max_length=50)
        target_level: int = Field(3, ge=1, le=6)
        preserve_names: bool = True

    @app.get("/health")
    async def health():
        model = SimplificationModel()
        return model.health.remote()

    @app.post("/simplify")
    async def simplify(request: SimplifyRequest):
        model = SimplificationModel()
        result = model.simplify.remote(
            text=request.text,
            target_level=request.target_level,
            preserve_names=request.preserve_names,
            context=request.context,
        )
        return {"success": True, "data": result}

    @app.post("/simplify/batch")
    async def simplify_batch(request: BatchRequest):
        model = SimplificationModel()
        results = model.simplify_batch.remote(
            sentences=request.sentences,
            target_level=request.target_level,
            preserve_names=request.preserve_names,
        )
        return {
            "success": True,
            "data": {
                "results": results,
                "total_tokens": sum(r["tokens_used"] for r in results),
            },
        }

    return app


# Local testing entrypoint
@app.local_entrypoint()
def main():
    """Test the deployed model."""
    model = SimplificationModel()

    # Test single simplification
    test_sentences = [
        "这部电影的情节跌宕起伏，令人叹为观止。",
        "他毅然决然地放弃了高薪工作，投身于慈善事业。",
        "这个问题错综复杂，需要从多个角度来分析。",
    ]

    print("Testing single simplification:")
    for sentence in test_sentences:
        result = model.simplify.remote(sentence, target_level=3)
        print(f"Original: {result['original']}")
        print(f"Simplified: {result['simplified']}")
        print(f"Tokens: {result['tokens_used']}")
        print()

    print("\nTesting batch simplification:")
    results = model.simplify_batch.remote(test_sentences, target_level=3)
    for r in results:
        print(f"{r['original']} → {r['simplified']}")

    print("\nHealth check:")
    print(model.health.remote())
