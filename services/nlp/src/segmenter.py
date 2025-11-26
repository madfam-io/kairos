"""Chinese text segmentation using PaddleNLP LAC."""

import re
from dataclasses import dataclass

import structlog
from LAC import LAC
from pypinyin import Style, pinyin

from .dictionary import Dictionary, get_dictionary
from .hsk import HSKClassifier, get_hsk_classifier
from .models import WordSegment

logger = structlog.get_logger()

# Part of speech mapping from LAC to human-readable
POS_MAP = {
    "n": "noun",
    "f": "direction",
    "s": "place",
    "t": "time",
    "nr": "person name",
    "ns": "place name",
    "nt": "organization",
    "nw": "work name",
    "nz": "other proper noun",
    "v": "verb",
    "vd": "adverb-verb",
    "vn": "noun-verb",
    "a": "adjective",
    "ad": "adverb-adjective",
    "an": "noun-adjective",
    "d": "adverb",
    "m": "numeral",
    "q": "classifier",
    "r": "pronoun",
    "p": "preposition",
    "c": "conjunction",
    "u": "auxiliary",
    "xc": "other function word",
    "w": "punctuation",
    "PER": "person",
    "LOC": "location",
    "ORG": "organization",
    "TIME": "time",
}

# Punctuation pattern
PUNCTUATION_PATTERN = re.compile(r"^[\s\u3000-\u303F\uFF00-\uFFEF\u2000-\u206F.,!?;:\"'()]+$")


@dataclass
class SegmentResult:
    """Result of text segmentation."""

    words: list[str]
    pos_tags: list[str]


class Segmenter:
    """Chinese text segmenter using PaddleNLP LAC."""

    def __init__(self, mode: str = "lac") -> None:
        """Initialize the segmenter.

        Args:
            mode: "lac" for full analysis, "seg" for segmentation only
        """
        self._mode = mode
        self._lac: LAC | None = None
        self._dictionary: Dictionary | None = None
        self._hsk: HSKClassifier | None = None

    def load(self) -> None:
        """Load the LAC model."""
        logger.info("Loading LAC model", mode=self._mode)
        self._lac = LAC(mode=self._mode)
        self._dictionary = get_dictionary()
        self._hsk = get_hsk_classifier()
        logger.info("LAC model loaded")

    @property
    def loaded(self) -> bool:
        """Check if model is loaded."""
        return self._lac is not None

    def segment(self, text: str) -> SegmentResult:
        """Segment Chinese text into words.

        Args:
            text: Chinese text to segment

        Returns:
            SegmentResult with words and POS tags
        """
        if not self._lac:
            raise RuntimeError("Segmenter not loaded. Call load() first.")

        result = self._lac.run(text)

        if self._mode == "lac":
            words, pos_tags = result
        else:
            words = result
            pos_tags = [""] * len(words)

        return SegmentResult(words=words, pos_tags=pos_tags)

    def analyze(
        self,
        text: str,
        include_pinyin: bool = True,
        include_definitions: bool = True,
        include_hsk: bool = True,
    ) -> list[WordSegment]:
        """Segment and analyze Chinese text.

        Args:
            text: Chinese text to analyze
            include_pinyin: Include pinyin pronunciation
            include_definitions: Include dictionary definitions
            include_hsk: Include HSK level

        Returns:
            List of WordSegment objects
        """
        result = self.segment(text)
        segments: list[WordSegment] = []

        for word, pos in zip(result.words, result.pos_tags):
            is_punct = bool(PUNCTUATION_PATTERN.match(word))

            segment = WordSegment(
                text=word,
                pos=POS_MAP.get(pos, pos) if pos else None,
                is_punctuation=is_punct,
            )

            if not is_punct:
                if include_pinyin:
                    segment.pinyin = self._get_pinyin_numbered(word)
                    segment.tone_marks = self._get_pinyin_marks(word)

                if include_definitions and self._dictionary:
                    segment.definitions = self._dictionary.get_definition(word)

                if include_hsk and self._hsk:
                    segment.hsk_level = self._hsk.get_level(word)

            segments.append(segment)

        return segments

    def _get_pinyin_numbered(self, word: str) -> str:
        """Get pinyin with tone numbers (e.g., 'zhong1guo2')."""
        result = pinyin(word, style=Style.TONE3, neutral_tone_with_five=True)
        return "".join([p[0] for p in result])

    def _get_pinyin_marks(self, word: str) -> str:
        """Get pinyin with tone marks (e.g., 'zhōngguó')."""
        result = pinyin(word, style=Style.TONE)
        return "".join([p[0] for p in result])

    def get_word_count(self, text: str) -> int:
        """Count words in text (excluding punctuation)."""
        result = self.segment(text)
        return sum(1 for word in result.words if not PUNCTUATION_PATTERN.match(word))


# Global segmenter instance
_segmenter: Segmenter | None = None


def get_segmenter() -> Segmenter:
    """Get the global segmenter instance."""
    global _segmenter
    if _segmenter is None:
        _segmenter = Segmenter()
    return _segmenter


def load_segmenter(mode: str = "lac") -> Segmenter:
    """Load the segmenter."""
    global _segmenter
    _segmenter = Segmenter(mode=mode)
    _segmenter.load()
    return _segmenter
