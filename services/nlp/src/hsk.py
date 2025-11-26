"""HSK vocabulary level classification."""

import json
from pathlib import Path

import structlog

logger = structlog.get_logger()


class HSKClassifier:
    """Classify words by HSK level."""

    def __init__(self) -> None:
        self._word_levels: dict[str, int] = {}
        self._level_words: dict[int, set[str]] = {i: set() for i in range(1, 7)}
        self._loaded = False

    @property
    def loaded(self) -> bool:
        """Check if HSK data is loaded."""
        return self._loaded

    def load(self, path: str | Path) -> None:
        """Load HSK vocabulary from JSON file.

        Expected format:
        {
            "1": ["你", "好", "我", ...],
            "2": ["因为", "所以", ...],
            ...
        }
        """
        path = Path(path)
        if not path.exists():
            logger.warning("HSK file not found, using embedded data", path=str(path))
            self._load_embedded()
            return

        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        for level_str, words in data.items():
            level = int(level_str)
            for word in words:
                self._word_levels[word] = level
                self._level_words[level].add(word)

        self._loaded = True
        total = sum(len(words) for words in self._level_words.values())
        logger.info("HSK vocabulary loaded", total_words=total)

    def _load_embedded(self) -> None:
        """Load minimal embedded HSK data for testing."""
        # HSK 1 core vocabulary (most common)
        hsk1 = [
            "的", "一", "是", "不", "了", "在", "人", "有", "我", "他",
            "这", "中", "大", "来", "上", "国", "个", "到", "说", "们",
            "为", "子", "和", "你", "地", "出", "道", "也", "时", "年",
            "得", "就", "那", "要", "下", "以", "生", "会", "自", "着",
            "去", "之", "过", "家", "学", "对", "可", "她", "里", "后",
            "小", "么", "心", "多", "天", "而", "能", "好", "都", "然",
            "没", "日", "于", "起", "还", "发", "成", "事", "只", "作",
            "当", "想", "看", "文", "无", "开", "手", "十", "用", "主",
            "行", "方", "又", "如", "前", "所", "本", "见", "经", "头",
            "面", "外", "两", "高", "几", "老", "东", "很", "问", "最",
        ]

        # HSK 2 vocabulary
        hsk2 = [
            "但", "因", "从", "或", "新", "什", "让", "相", "定", "已",
            "把", "次", "此", "路", "门", "比", "第", "等", "向", "间",
            "明", "其", "些", "现", "表", "原", "加", "被", "点", "名",
            "少", "给", "系", "气", "月", "话", "位", "应", "进", "力",
        ]

        # HSK 3 vocabulary
        hsk3 = [
            "虽然", "但是", "如果", "因为", "所以", "可能", "应该", "已经", "正在", "一直",
            "关于", "通过", "根据", "除了", "对于", "关系", "影响", "发展", "研究", "问题",
            "情况", "条件", "结果", "原因", "方法", "方面", "部分", "需要", "认为", "觉得",
        ]

        # HSK 4 vocabulary
        hsk4 = [
            "即使", "尽管", "无论", "否则", "另外", "然而", "不仅", "而且", "或者", "以及",
            "由于", "因此", "于是", "从而", "进而", "甚至", "尤其", "特别", "具体", "实际",
            "主要", "重要", "必须", "基本", "一般", "普通", "正常", "简单", "复杂", "困难",
        ]

        # HSK 5 vocabulary
        hsk5 = [
            "倘若", "假如", "假使", "既然", "鉴于", "基于", "况且", "何况", "与其", "宁可",
            "诚然", "固然", "纵然", "尽管", "倒是", "反而", "毕竟", "究竟", "未必", "未免",
            "不免", "难免", "难怪", "怪不得", "以免", "以便", "以致", "从而", "进而", "继而",
        ]

        # HSK 6 vocabulary
        hsk6 = [
            "倘使", "设若", "设使", "要是", "若是", "若非", "除非", "一旦", "万一", "即便",
            "纵使", "即令", "即或", "虽说", "虽则", "固然", "诚然", "当然", "自然", "显然",
            "居然", "竟然", "果然", "忽然", "突然", "偶然", "必然", "当然", "天然", "自然",
        ]

        for level, words in enumerate([hsk1, hsk2, hsk3, hsk4, hsk5, hsk6], 1):
            for word in words:
                self._word_levels[word] = level
                self._level_words[level].add(word)

        self._loaded = True
        logger.info("Embedded HSK vocabulary loaded", total_words=len(self._word_levels))

    def get_level(self, word: str) -> int | None:
        """Get HSK level for a word (1-6), or None if not in HSK."""
        return self._word_levels.get(word)

    def is_above_level(self, word: str, level: int) -> bool:
        """Check if a word is above the given HSK level."""
        word_level = self.get_level(word)
        if word_level is None:
            return True  # Unknown words are considered above any level
        return word_level > level

    def get_words_at_level(self, level: int) -> set[str]:
        """Get all words at a specific HSK level."""
        return self._level_words.get(level, set())

    def get_words_up_to_level(self, level: int) -> set[str]:
        """Get all words up to and including a specific HSK level."""
        words = set()
        for lvl in range(1, level + 1):
            words.update(self._level_words.get(lvl, set()))
        return words


# Global HSK classifier instance
_classifier: HSKClassifier | None = None


def get_hsk_classifier() -> HSKClassifier:
    """Get the global HSK classifier instance."""
    global _classifier
    if _classifier is None:
        _classifier = HSKClassifier()
    return _classifier


def load_hsk(path: str | Path) -> HSKClassifier:
    """Load HSK vocabulary from a file."""
    classifier = get_hsk_classifier()
    classifier.load(path)
    return classifier
