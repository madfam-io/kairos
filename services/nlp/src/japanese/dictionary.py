"""Japanese dictionary using JMdict data."""

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import structlog

logger = structlog.get_logger()

_dictionary: Optional["JapaneseDictionary"] = None


@dataclass
class JapaneseEntry:
    """A dictionary entry for a Japanese word."""

    kanji: list[str] = field(default_factory=list)
    readings: list[str] = field(default_factory=list)
    senses: list[dict] = field(default_factory=list)  # Contains gloss, pos, etc.

    @property
    def word(self) -> str:
        """Primary word form (kanji if available, else reading)."""
        return self.kanji[0] if self.kanji else (self.readings[0] if self.readings else "")

    @property
    def reading(self) -> str:
        """Primary reading (hiragana/katakana)."""
        return self.readings[0] if self.readings else ""

    @property
    def definitions(self) -> list[str]:
        """Get all English definitions."""
        defs = []
        for sense in self.senses:
            for gloss in sense.get("gloss", []):
                if isinstance(gloss, str):
                    defs.append(gloss)
        return defs

    @property
    def parts_of_speech(self) -> list[str]:
        """Get all parts of speech."""
        pos = []
        for sense in self.senses:
            pos.extend(sense.get("pos", []))
        return list(set(pos))


class JapaneseDictionary:
    """Japanese dictionary with JMdict data."""

    def __init__(self) -> None:
        self._entries: dict[str, JapaneseEntry] = {}
        self._kanji_index: dict[str, list[str]] = {}
        self._reading_index: dict[str, list[str]] = {}
        self._loaded = False

    @property
    def loaded(self) -> bool:
        """Whether dictionary data has been loaded."""
        return self._loaded

    @property
    def entry_count(self) -> int:
        """Number of dictionary entries."""
        return len(self._entries)

    def load_from_json(self, path: str | Path) -> None:
        """Load dictionary from pre-processed JSON file."""
        path = Path(path)

        if not path.exists():
            logger.warning("JMdict JSON file not found", path=str(path))
            return

        logger.info("Loading JMdict from JSON", path=str(path))

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for entry_data in data.get("entries", []):
            entry = JapaneseEntry(
                kanji=entry_data.get("kanji", []),
                readings=entry_data.get("readings", []),
                senses=entry_data.get("senses", []),
            )

            # Index by word
            word = entry.word
            if word:
                self._entries[word] = entry

            # Index by kanji
            for k in entry.kanji:
                if k not in self._kanji_index:
                    self._kanji_index[k] = []
                self._kanji_index[k].append(word)

            # Index by reading
            for r in entry.readings:
                if r not in self._reading_index:
                    self._reading_index[r] = []
                self._reading_index[r].append(word)

        self._loaded = True
        logger.info("JMdict loaded", entries=len(self._entries))

    def lookup(self, word: str) -> Optional[JapaneseEntry]:
        """Look up a word in the dictionary."""
        # Direct lookup
        if word in self._entries:
            return self._entries[word]

        # Try kanji index
        if word in self._kanji_index and self._kanji_index[word]:
            return self._entries.get(self._kanji_index[word][0])

        # Try reading index
        if word in self._reading_index and self._reading_index[word]:
            return self._entries.get(self._reading_index[word][0])

        return None

    def search(self, query: str, limit: int = 10) -> list[JapaneseEntry]:
        """Search dictionary for matching entries."""
        results = []

        # Exact matches first
        if query in self._entries:
            results.append(self._entries[query])

        # Kanji matches
        if query in self._kanji_index:
            for word in self._kanji_index[query][:limit]:
                if word in self._entries and self._entries[word] not in results:
                    results.append(self._entries[word])

        # Reading matches
        if query in self._reading_index:
            for word in self._reading_index[query][:limit]:
                if word in self._entries and self._entries[word] not in results:
                    results.append(self._entries[word])

        # Prefix search
        for word in self._entries:
            if len(results) >= limit:
                break
            if word.startswith(query) and self._entries[word] not in results:
                results.append(self._entries[word])

        return results[:limit]


def get_dictionary() -> JapaneseDictionary:
    """Get the global Japanese dictionary instance."""
    global _dictionary
    if _dictionary is None:
        _dictionary = JapaneseDictionary()
    return _dictionary


def load_dictionary(path: str | Path) -> None:
    """Load the Japanese dictionary from a JSON file."""
    get_dictionary().load_from_json(path)
