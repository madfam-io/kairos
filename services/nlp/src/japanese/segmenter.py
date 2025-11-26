"""Japanese text segmentation using SudachiPy."""

import re
from dataclasses import dataclass, field
from typing import Optional

import structlog

try:
    from sudachipy import tokenizer
    from sudachipy import dictionary as sudachi_dict

    SUDACHI_AVAILABLE = True
except ImportError:
    SUDACHI_AVAILABLE = False

logger = structlog.get_logger()

_segmenter: Optional["JapaneseSegmenter"] = None


@dataclass
class JapaneseWordSegment:
    """A segmented Japanese word with analysis."""

    text: str
    reading: str = ""
    reading_katakana: str = ""
    dictionary_form: str = ""
    part_of_speech: str = ""
    definitions: list[str] = field(default_factory=list)
    jlpt_level: Optional[int] = None
    is_punctuation: bool = False

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "text": self.text,
            "reading": self.reading,
            "reading_katakana": self.reading_katakana,
            "dictionary_form": self.dictionary_form,
            "part_of_speech": self.part_of_speech,
            "definitions": self.definitions,
            "jlpt_level": self.jlpt_level,
            "is_punctuation": self.is_punctuation,
        }


# Common Japanese punctuation
JP_PUNCTUATION = set("。、！？「」『』【】（）・…ー〜―")
ASCII_PUNCTUATION = set(".,!?()[]{}\"'-:;/\\")
ALL_PUNCTUATION = JP_PUNCTUATION | ASCII_PUNCTUATION


class JapaneseSegmenter:
    """Japanese text segmenter using SudachiPy."""

    def __init__(self) -> None:
        self._tokenizer: Optional[tokenizer.Tokenizer] = None
        self._loaded = False
        self._mode = "C"  # SplitMode.C = smallest unit

    @property
    def loaded(self) -> bool:
        """Whether the segmenter is loaded."""
        return self._loaded

    def load(self, mode: str = "C") -> None:
        """Load the SudachiPy tokenizer."""
        if not SUDACHI_AVAILABLE:
            logger.warning("SudachiPy not installed, segmentation will be limited")
            return

        try:
            self._mode = mode
            dict_obj = sudachi_dict.Dictionary()

            # Map mode string to SplitMode enum
            mode_map = {"A": tokenizer.Tokenizer.SplitMode.A, "B": tokenizer.Tokenizer.SplitMode.B, "C": tokenizer.Tokenizer.SplitMode.C}

            self._tokenizer = dict_obj.create(mode=mode_map.get(mode, tokenizer.Tokenizer.SplitMode.C))
            self._loaded = True
            logger.info("SudachiPy tokenizer loaded", mode=mode)
        except Exception as e:
            logger.error("Failed to load SudachiPy", error=str(e))

    def segment(self, text: str) -> list[JapaneseWordSegment]:
        """Segment Japanese text into words."""
        if not text:
            return []

        if self._tokenizer is None:
            # Fallback: character-by-character
            return self._fallback_segment(text)

        segments = []

        try:
            tokens = self._tokenizer.tokenize(text)

            for token in tokens:
                surface = token.surface()

                # Check if punctuation
                is_punct = all(c in ALL_PUNCTUATION or c.isspace() for c in surface)

                if is_punct:
                    segments.append(JapaneseWordSegment(text=surface, is_punctuation=True))
                else:
                    # Get reading (katakana)
                    reading_kata = token.reading_form()
                    # Convert to hiragana
                    reading_hira = self._kata_to_hira(reading_kata)

                    # Get part of speech
                    pos = token.part_of_speech()
                    pos_str = "-".join(pos[:2]) if pos else ""

                    # Get dictionary form
                    dict_form = token.dictionary_form()

                    segments.append(
                        JapaneseWordSegment(
                            text=surface,
                            reading=reading_hira,
                            reading_katakana=reading_kata,
                            dictionary_form=dict_form,
                            part_of_speech=pos_str,
                        )
                    )
        except Exception as e:
            logger.error("Segmentation failed, using fallback", error=str(e))
            return self._fallback_segment(text)

        return segments

    def _fallback_segment(self, text: str) -> list[JapaneseWordSegment]:
        """Fallback segmentation when SudachiPy is not available."""
        segments = []

        # Simple character-based segmentation
        for char in text:
            is_punct = char in ALL_PUNCTUATION or char.isspace()
            segments.append(JapaneseWordSegment(text=char, is_punctuation=is_punct))

        return segments

    @staticmethod
    def _kata_to_hira(text: str) -> str:
        """Convert katakana to hiragana."""
        result = []
        for char in text:
            code = ord(char)
            # Katakana range: 0x30A0-0x30FF
            # Hiragana range: 0x3040-0x309F
            if 0x30A1 <= code <= 0x30F6:
                result.append(chr(code - 0x60))
            else:
                result.append(char)
        return "".join(result)

    def analyze(
        self,
        text: str,
        include_reading: bool = True,
        include_definitions: bool = True,
        include_jlpt: bool = True,
    ) -> list[JapaneseWordSegment]:
        """Segment and analyze Japanese text."""
        from .dictionary import get_dictionary
        from .jlpt import get_jlpt_classifier

        segments = self.segment(text)

        dictionary = get_dictionary() if include_definitions else None
        jlpt = get_jlpt_classifier() if include_jlpt else None

        for segment in segments:
            if segment.is_punctuation:
                continue

            # Look up definitions
            if dictionary and dictionary.loaded:
                # Try dictionary form first, then surface form
                entry = dictionary.lookup(segment.dictionary_form) or dictionary.lookup(segment.text)
                if entry:
                    segment.definitions = entry.definitions[:3]  # Limit definitions

            # Look up JLPT level
            if jlpt:
                level = jlpt.get_level(segment.dictionary_form) or jlpt.get_level(segment.text)
                segment.jlpt_level = level

        return segments


def get_segmenter() -> JapaneseSegmenter:
    """Get the global Japanese segmenter instance."""
    global _segmenter
    if _segmenter is None:
        _segmenter = JapaneseSegmenter()
    return _segmenter


def load_segmenter(mode: str = "C") -> None:
    """Load the Japanese segmenter."""
    get_segmenter().load(mode=mode)
