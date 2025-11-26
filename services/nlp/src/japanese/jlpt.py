"""JLPT (Japanese Language Proficiency Test) vocabulary classifier."""

import json
from pathlib import Path
from typing import Optional

import structlog

logger = structlog.get_logger()

_classifier: Optional["JLPTClassifier"] = None


class JLPTClassifier:
    """Classify Japanese words by JLPT level (N5-N1)."""

    def __init__(self) -> None:
        # JLPT levels: N5 (easiest) to N1 (hardest)
        # We store as 1-5 where 1=N5 (beginner) and 5=N1 (advanced)
        self._vocab: dict[str, int] = {}
        self._loaded = False

    @property
    def loaded(self) -> bool:
        """Whether JLPT data has been loaded."""
        return self._loaded

    def load_from_json(self, path: str | Path) -> None:
        """Load JLPT vocabulary from JSON file."""
        path = Path(path)

        if not path.exists():
            logger.warning("JLPT file not found, using built-in vocabulary", path=str(path))
            self._load_builtin()
            return

        logger.info("Loading JLPT vocabulary", path=str(path))

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Expecting format: {"N5": ["word1", "word2"], "N4": [...], ...}
        for level_str, words in data.items():
            # Convert N5->1, N4->2, N3->3, N2->4, N1->5
            level_num = 6 - int(level_str[1])  # N5=1, N4=2, N3=3, N2=4, N1=5

            for word in words:
                if word not in self._vocab:
                    self._vocab[word] = level_num

        self._loaded = True
        logger.info("JLPT vocabulary loaded", words=len(self._vocab))

    def _load_builtin(self) -> None:
        """Load built-in common vocabulary."""
        # Common N5 (beginner) vocabulary
        n5_words = [
            # Numbers
            "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "万",
            # Time
            "今日", "明日", "昨日", "今", "朝", "昼", "夜", "午前", "午後",
            "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日",
            # People
            "私", "僕", "あなた", "彼", "彼女", "人", "男", "女", "子供", "友達", "先生", "学生",
            # Basic verbs
            "行く", "来る", "帰る", "食べる", "飲む", "見る", "聞く", "読む", "書く", "話す",
            "買う", "売る", "待つ", "作る", "使う", "歩く", "走る", "泳ぐ", "遊ぶ", "働く",
            "寝る", "起きる", "入る", "出る", "開ける", "閉める", "始まる", "終わる",
            # I-adjectives
            "大きい", "小さい", "高い", "安い", "新しい", "古い", "良い", "悪い",
            "長い", "短い", "多い", "少ない", "暑い", "寒い", "難しい", "易しい",
            # Na-adjectives
            "元気", "静か", "綺麗", "便利", "大切", "大丈夫", "有名", "好き", "嫌い",
            # Nouns
            "家", "学校", "会社", "店", "駅", "道", "電車", "車", "飛行機",
            "本", "新聞", "雑誌", "映画", "音楽", "テレビ", "電話", "パソコン",
            "水", "お茶", "コーヒー", "ご飯", "パン", "肉", "魚", "野菜", "果物",
        ]

        # Common N4 vocabulary
        n4_words = [
            "始める", "終わる", "変わる", "決める", "選ぶ", "届く", "届ける", "運ぶ",
            "調べる", "考える", "教える", "習う", "覚える", "忘れる", "思い出す",
            "比べる", "集める", "並ぶ", "続く", "続ける", "止まる", "止める",
            "必要", "特別", "普通", "簡単", "複雑", "正確", "危険", "安全",
            "社会", "経済", "政治", "文化", "歴史", "科学", "技術", "医学",
            "説明", "質問", "答え", "意見", "理由", "結果", "関係", "違い",
        ]

        # Common N3 vocabulary
        n3_words = [
            "参加する", "発表する", "報告する", "提案する", "討論する", "交渉する",
            "影響", "効果", "印象", "感想", "評価", "批判", "主張", "反対",
            "具体的", "抽象的", "積極的", "消極的", "客観的", "主観的",
            "条件", "状況", "環境", "背景", "要因", "原因", "問題点",
        ]

        # Common N2 vocabulary
        n2_words = [
            "把握する", "分析する", "検討する", "対応する", "対処する", "克服する",
            "傾向", "動向", "推移", "変遷", "展開", "進展", "発展",
            "本質", "核心", "要点", "論点", "争点", "焦点",
            "妥当", "適切", "合理的", "効率的", "現実的", "建設的",
        ]

        # Common N1 vocabulary
        n1_words = [
            "網羅する", "凌駕する", "彷彿する", "凝縮する", "昇華する", "醸成する",
            "萌芽", "黎明", "隆盛", "衰退", "瓦解", "崩壊",
            "俯瞰", "洞察", "省察", "検証", "考察", "吟味",
            "秀逸", "卓越", "超越", "絶妙", "至高", "極致",
        ]

        # Add all words with their levels
        for word in n5_words:
            self._vocab[word] = 1  # N5 = level 1
        for word in n4_words:
            self._vocab[word] = 2  # N4 = level 2
        for word in n3_words:
            self._vocab[word] = 3  # N3 = level 3
        for word in n2_words:
            self._vocab[word] = 4  # N2 = level 4
        for word in n1_words:
            self._vocab[word] = 5  # N1 = level 5

        self._loaded = True
        logger.info("Built-in JLPT vocabulary loaded", words=len(self._vocab))

    def get_level(self, word: str) -> Optional[int]:
        """
        Get JLPT level for a word.
        Returns 1-5 where 1=N5 (beginner) and 5=N1 (advanced).
        Returns None if word not found.
        """
        return self._vocab.get(word)

    def get_level_name(self, level: int) -> str:
        """Convert numeric level to JLPT name (N5-N1)."""
        if 1 <= level <= 5:
            return f"N{6 - level}"
        return "Unknown"

    def is_at_level(self, word: str, target_level: int) -> bool:
        """Check if word is at or below a target level."""
        level = self.get_level(word)
        if level is None:
            return True  # Unknown words considered accessible
        return level <= target_level


def get_jlpt_classifier() -> JLPTClassifier:
    """Get the global JLPT classifier instance."""
    global _classifier
    if _classifier is None:
        _classifier = JLPTClassifier()
    return _classifier


def load_jlpt(path: Optional[str | Path] = None) -> None:
    """Load JLPT vocabulary data."""
    classifier = get_jlpt_classifier()
    if path:
        classifier.load_from_json(path)
    else:
        classifier._load_builtin()
