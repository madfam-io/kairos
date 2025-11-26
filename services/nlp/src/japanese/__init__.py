"""Japanese language processing module."""

from .dictionary import JapaneseDictionary, load_dictionary as load_japanese_dictionary
from .segmenter import JapaneseSegmenter, load_segmenter as load_japanese_segmenter
from .jlpt import JLPTClassifier, load_jlpt

__all__ = [
    "JapaneseDictionary",
    "load_japanese_dictionary",
    "JapaneseSegmenter",
    "load_japanese_segmenter",
    "JLPTClassifier",
    "load_jlpt",
]
