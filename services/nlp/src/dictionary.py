"""CC-CEDICT dictionary loader and lookup service."""

import re
from dataclasses import dataclass
from pathlib import Path

import structlog

logger = structlog.get_logger()


@dataclass
class DictEntry:
    """A single dictionary entry."""

    traditional: str
    simplified: str
    pinyin: str
    definitions: list[str]


class Dictionary:
    """CC-CEDICT dictionary service."""

    def __init__(self) -> None:
        self._entries: dict[str, DictEntry] = {}
        self._traditional_map: dict[str, str] = {}
        self._loaded = False

    @property
    def loaded(self) -> bool:
        """Check if dictionary is loaded."""
        return self._loaded

    @property
    def entry_count(self) -> int:
        """Get number of dictionary entries."""
        return len(self._entries)

    def load(self, path: str | Path) -> None:
        """Load CC-CEDICT dictionary from file.

        File format: Traditional Simplified [pinyin] /definition1/definition2/.../
        Example: 中國 中国 [Zhong1 guo2] /China/
        """
        path = Path(path)
        if not path.exists():
            logger.warning("Dictionary file not found", path=str(path))
            return

        pattern = re.compile(r"^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$")

        count = 0
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue

                match = pattern.match(line)
                if match:
                    traditional, simplified, pinyin, definitions = match.groups()
                    defs = [d.strip() for d in definitions.split("/") if d.strip()]

                    entry = DictEntry(
                        traditional=traditional,
                        simplified=simplified,
                        pinyin=self._normalize_pinyin(pinyin),
                        definitions=defs,
                    )

                    self._entries[simplified] = entry
                    if traditional != simplified:
                        self._traditional_map[traditional] = simplified

                    count += 1

        self._loaded = True
        logger.info("Dictionary loaded", entries=count)

    def _normalize_pinyin(self, pinyin: str) -> str:
        """Normalize pinyin to lowercase with tone numbers."""
        return pinyin.lower().replace(" ", "")

    def lookup(self, word: str) -> DictEntry | None:
        """Look up a word in the dictionary."""
        # Try simplified first
        if word in self._entries:
            return self._entries[word]

        # Try traditional -> simplified mapping
        if word in self._traditional_map:
            simplified = self._traditional_map[word]
            return self._entries.get(simplified)

        return None

    def lookup_all(self, word: str) -> list[DictEntry]:
        """Look up all entries for a word (handles multiple meanings)."""
        entries = []
        entry = self.lookup(word)
        if entry:
            entries.append(entry)
        return entries

    def has_word(self, word: str) -> bool:
        """Check if word exists in dictionary."""
        return word in self._entries or word in self._traditional_map

    def get_definition(self, word: str) -> list[str]:
        """Get definitions for a word."""
        entry = self.lookup(word)
        return entry.definitions if entry else []

    def get_pinyin(self, word: str) -> str | None:
        """Get pinyin for a word."""
        entry = self.lookup(word)
        return entry.pinyin if entry else None


# Global dictionary instance
_dictionary: Dictionary | None = None


def get_dictionary() -> Dictionary:
    """Get the global dictionary instance."""
    global _dictionary
    if _dictionary is None:
        _dictionary = Dictionary()
    return _dictionary


def load_dictionary(path: str | Path) -> Dictionary:
    """Load the dictionary from a file."""
    dictionary = get_dictionary()
    dictionary.load(path)
    return dictionary
