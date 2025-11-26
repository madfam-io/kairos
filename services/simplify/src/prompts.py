"""Prompt templates for the simplification model."""

# System prompt for Qwen2.5
SYSTEM_PROMPT = """You are a Chinese language learning assistant specializing in sentence simplification. Your task is to rewrite Chinese sentences to match a target HSK vocabulary level while preserving the original meaning.

Rules:
1. Replace words above the target HSK level with simpler synonyms
2. Keep the sentence structure similar when possible
3. Preserve proper nouns (names, places) unless instructed otherwise
4. Maintain the original tone and intent
5. If a word has no simpler synonym, keep it but add context clues
6. Output ONLY the simplified sentence, no explanations

HSK Level Guidelines:
- HSK 1-2: Very basic vocabulary, simple sentences
- HSK 3: Common everyday vocabulary
- HSK 4: Intermediate vocabulary, can express opinions
- HSK 5: Advanced vocabulary, can discuss abstract topics
- HSK 6: Near-native vocabulary"""

# User prompt template
USER_PROMPT_TEMPLATE = """Simplify this Chinese sentence to HSK level {target_level}:

Original: {text}
{context_line}
Simplified:"""

# Few-shot examples for better quality
FEW_SHOT_EXAMPLES = [
    {
        "original": "这部电影的情节跌宕起伏，令人叹为观止。",
        "target_level": 3,
        "simplified": "这部电影的故事很精彩，让人觉得很好看。",
    },
    {
        "original": "他毅然决然地放弃了高薪工作，投身于慈善事业。",
        "target_level": 4,
        "simplified": "他决定放弃高工资的工作，去做慈善工作。",
    },
    {
        "original": "这个问题错综复杂，需要从多个角度来分析。",
        "target_level": 3,
        "simplified": "这个问题很复杂，需要从很多方面来看。",
    },
]


def build_prompt(text: str, target_level: int, context: str | None = None) -> str:
    """Build the complete prompt for simplification."""
    context_line = f"Context: {context}" if context else ""

    return USER_PROMPT_TEMPLATE.format(
        target_level=target_level,
        text=text,
        context_line=context_line,
    )


def build_messages(text: str, target_level: int, context: str | None = None) -> list[dict]:
    """Build chat messages for the model."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    # Add few-shot examples for the target level
    for example in FEW_SHOT_EXAMPLES:
        if example["target_level"] <= target_level + 1:
            messages.append({
                "role": "user",
                "content": build_prompt(example["original"], example["target_level"]),
            })
            messages.append({
                "role": "assistant",
                "content": example["simplified"],
            })

    # Add the actual request
    messages.append({
        "role": "user",
        "content": build_prompt(text, target_level, context),
    })

    return messages
