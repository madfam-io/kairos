/**
 * Japanese Grammar Service
 * Provides grammar pattern explanations for Japanese text
 */

import { db, grammarPatterns } from '../db';
import { eq, ilike, or, sql } from 'drizzle-orm';

export interface JapaneseGrammarExample {
  japanese: string;
  romaji: string;
  english: string;
  highlighted: string;
}

export interface JapaneseGrammarPattern {
  id: string;
  pattern: string;
  name: string;
  nameJp: string;
  explanation: string;
  explanationJp?: string;
  structure: string;
  jlptLevel: number | null;
  examples: JapaneseGrammarExample[];
  relatedPatterns?: string[];
  tags?: string[];
}

/**
 * Common Japanese grammar patterns (seed data)
 * JLPT levels: 1=N5 (easiest), 5=N1 (hardest)
 */
export const JAPANESE_GRAMMAR_PATTERNS: Omit<JapaneseGrammarPattern, 'id'>[] = [
  // N5 Patterns
  {
    pattern: 'です/ます',
    name: 'Polite form',
    nameJp: '丁寧形',
    explanation:
      'The polite/formal form used in everyday conversation. です follows nouns/adjectives, ます follows verbs.',
    explanationJp: '日常会話で使う丁寧な形式。名詞・形容詞には「です」、動詞には「ます」を使う。',
    structure: 'Noun/Adj + です / Verb stem + ます',
    jlptLevel: 1,
    examples: [
      {
        japanese: '私は学生です。',
        romaji: 'Watashi wa gakusei desu.',
        english: 'I am a student.',
        highlighted: '私は学生<em>です</em>。',
      },
      {
        japanese: '毎日勉強します。',
        romaji: 'Mainichi benkyou shimasu.',
        english: 'I study every day.',
        highlighted: '毎日勉強<em>します</em>。',
      },
    ],
    relatedPatterns: ['だ/である', 'ている'],
    tags: ['polite', 'formal', 'basic'],
  },
  {
    pattern: 'は...が',
    name: 'Topic and subject markers',
    nameJp: '主題と主語',
    explanation:
      'は marks the topic (what we are talking about), が marks the subject (who/what does the action). は gives context, が identifies.',
    explanationJp:
      '「は」は話題（何について話しているか）を示し、「が」は主語（誰が/何が動作をするか）を示す。',
    structure: 'Topic は Subject が Predicate',
    jlptLevel: 1,
    examples: [
      {
        japanese: '私は頭が痛いです。',
        romaji: 'Watashi wa atama ga itai desu.',
        english: 'I have a headache. (As for me, my head hurts.)',
        highlighted: '私<em>は</em>頭<em>が</em>痛いです。',
      },
      {
        japanese: '象は鼻が長い。',
        romaji: 'Zou wa hana ga nagai.',
        english: 'Elephants have long noses.',
        highlighted: '象<em>は</em>鼻<em>が</em>長い。',
      },
    ],
    relatedPatterns: ['も', 'の'],
    tags: ['particle', 'basic'],
  },
  {
    pattern: 'たい',
    name: 'Want to (verb)',
    nameJp: '希望を表す',
    explanation:
      'Expresses desire to do something. Attach to verb stem. Note: Only used for first person or questions to second person.',
    explanationJp: '何かをしたいという希望を表す。動詞の語幹に付ける。一人称または二人称への質問のみに使用。',
    structure: 'Verb stem + たい',
    jlptLevel: 1,
    examples: [
      {
        japanese: '日本に行きたいです。',
        romaji: 'Nihon ni ikitai desu.',
        english: 'I want to go to Japan.',
        highlighted: '日本に行き<em>たい</em>です。',
      },
      {
        japanese: '何を食べたいですか？',
        romaji: 'Nani wo tabetai desu ka?',
        english: 'What do you want to eat?',
        highlighted: '何を食べ<em>たい</em>ですか？',
      },
    ],
    relatedPatterns: ['たがる', 'ほしい'],
    tags: ['desire', 'volition'],
  },
  // N4 Patterns
  {
    pattern: 'てform',
    name: 'Te-form (連用形)',
    nameJp: 'て形',
    explanation:
      'Versatile verb form used for connecting actions, making requests, ongoing states, and more. Foundation for many grammar patterns.',
    explanationJp: '動作の接続、依頼、継続状態などに使う汎用的な動詞形式。多くの文法パターンの基礎。',
    structure: 'Verb て-form + various endings',
    jlptLevel: 2,
    examples: [
      {
        japanese: '食べて寝ました。',
        romaji: 'Tabete nemashita.',
        english: 'I ate and then slept.',
        highlighted: '食べ<em>て</em>寝ました。',
      },
      {
        japanese: '窓を開けてください。',
        romaji: 'Mado wo akete kudasai.',
        english: 'Please open the window.',
        highlighted: '窓を開け<em>て</em>ください。',
      },
    ],
    relatedPatterns: ['ている', 'てから', 'ても'],
    tags: ['verb form', 'connecting'],
  },
  {
    pattern: 'ている',
    name: 'Progressive/Resultative state',
    nameJp: 'ている形',
    explanation:
      "Indicates ongoing action (progressive) or resultant state. 食べている = eating (in progress), 知っている = know (state resulting from having learned).",
    explanationJp: '進行中の動作または結果状態を示す。食べている＝食べている最中、知っている＝知った結果の状態。',
    structure: 'Verb て-form + いる',
    jlptLevel: 2,
    examples: [
      {
        japanese: '今、本を読んでいます。',
        romaji: 'Ima, hon wo yondeimasu.',
        english: 'I am reading a book now.',
        highlighted: '今、本を読ん<em>でいます</em>。',
      },
      {
        japanese: '東京に住んでいます。',
        romaji: 'Toukyou ni sundeimasu.',
        english: 'I live in Tokyo.',
        highlighted: '東京に住ん<em>でいます</em>。',
      },
    ],
    relatedPatterns: ['てある', 'ていく', 'てくる'],
    tags: ['progressive', 'state', 'aspect'],
  },
  {
    pattern: 'なければならない',
    name: 'Must/Have to',
    nameJp: '義務・必要',
    explanation:
      "Expresses obligation or necessity. Literally: 'if not X, it won't do.' Various contractions exist: なきゃ, なくちゃ.",
    explanationJp: '義務や必要性を表す。「～しないと、いけない」という意味。なきゃ、なくちゃなどの短縮形がある。',
    structure: 'Verb negative stem + なければならない',
    jlptLevel: 2,
    examples: [
      {
        japanese: '宿題をしなければなりません。',
        romaji: 'Shukudai wo shinakereba narimasen.',
        english: 'I have to do my homework.',
        highlighted: '宿題をし<em>なければなりません</em>。',
      },
      {
        japanese: '早く起きなきゃ。',
        romaji: 'Hayaku okinakya.',
        english: 'I gotta wake up early.',
        highlighted: '早く起き<em>なきゃ</em>。',
      },
    ],
    relatedPatterns: ['べき', 'ないといけない', 'ざるを得ない'],
    tags: ['obligation', 'necessity'],
  },
  // N3 Patterns
  {
    pattern: 'ようにする',
    name: 'Make sure to / Try to',
    nameJp: '習慣化・努力',
    explanation: 'Expresses effort to make something happen or to establish a habit. Focus is on the process of trying.',
    explanationJp: '何かを実現させる努力や習慣化を表す。努力の過程に焦点がある。',
    structure: 'Verb dictionary form + ようにする',
    jlptLevel: 3,
    examples: [
      {
        japanese: '毎日運動するようにしています。',
        romaji: 'Mainichi undou suru you ni shiteimasu.',
        english: 'I make sure to exercise every day.',
        highlighted: '毎日運動する<em>ようにしています</em>。',
      },
      {
        japanese: '遅刻しないようにしてください。',
        romaji: 'Chikoku shinai you ni shite kudasai.',
        english: 'Please make sure not to be late.',
        highlighted: '遅刻しない<em>ようにして</em>ください。',
      },
    ],
    relatedPatterns: ['ようになる', 'ことにする'],
    tags: ['effort', 'habit'],
  },
  {
    pattern: 'ようになる',
    name: 'Come to be able to / Start to',
    nameJp: '変化・能力獲得',
    explanation:
      'Expresses a change in state or ability over time. Indicates gradual change or acquisition of new ability.',
    explanationJp: '時間の経過による状態や能力の変化を表す。徐々の変化や新しい能力の獲得を示す。',
    structure: 'Verb dictionary form + ようになる',
    jlptLevel: 3,
    examples: [
      {
        japanese: '日本語が話せるようになりました。',
        romaji: 'Nihongo ga hanaseru you ni narimashita.',
        english: 'I became able to speak Japanese.',
        highlighted: '日本語が話せる<em>ようになりました</em>。',
      },
      {
        japanese: '朝早く起きるようになった。',
        romaji: 'Asa hayaku okiru you ni natta.',
        english: 'I started waking up early in the morning.',
        highlighted: '朝早く起きる<em>ようになった</em>。',
      },
    ],
    relatedPatterns: ['ようにする', 'ことになる'],
    tags: ['change', 'ability'],
  },
  // N2 Patterns
  {
    pattern: 'わけではない',
    name: "It's not that / Doesn't mean",
    nameJp: '部分否定',
    explanation:
      "Partially denies something. Acknowledges a fact but denies a conclusion. 'It's not that X' / 'X doesn't mean Y'.",
    explanationJp: '部分的に否定する。事実は認めるが結論は否定する。「～というわけではない」という意味。',
    structure: 'Plain form + わけではない',
    jlptLevel: 4,
    examples: [
      {
        japanese: '嫌いなわけではないけど、あまり食べない。',
        romaji: 'Kirai na wake dewa nai kedo, amari tabenai.',
        english: "It's not that I dislike it, but I don't eat it much.",
        highlighted: '嫌いな<em>わけではない</em>けど、あまり食べない。',
      },
      {
        japanese: '反対しているわけではありません。',
        romaji: 'Hantai shiteiru wake dewa arimasen.',
        english: "It's not that I'm opposed to it.",
        highlighted: '反対している<em>わけではありません</em>。',
      },
    ],
    relatedPatterns: ['わけがない', 'というわけではない', 'ないわけではない'],
    tags: ['negation', 'nuance'],
  },
  {
    pattern: 'ばかりでなく',
    name: 'Not only... but also',
    nameJp: '添加・列挙',
    explanation: 'Indicates that something is not limited to X but also includes Y. Emphasizes addition.',
    explanationJp: '「～だけでなく～も」という意味。追加を強調する。',
    structure: 'X + ばかりでなく + Y + も',
    jlptLevel: 4,
    examples: [
      {
        japanese: '彼は英語ばかりでなく、中国語も話せる。',
        romaji: 'Kare wa eigo bakari de naku, chuugokugo mo hanaseru.',
        english: 'He can speak not only English but also Chinese.',
        highlighted: '彼は英語<em>ばかりでなく</em>、中国語も話せる。',
      },
    ],
    relatedPatterns: ['だけでなく', 'のみならず', 'に加えて'],
    tags: ['addition', 'emphasis'],
  },
  // N1 Patterns
  {
    pattern: 'ざるを得ない',
    name: "Can't help but / Have no choice but",
    nameJp: '不可避・仕方ない',
    explanation:
      "Expresses that one has no choice but to do something, even if reluctant. Formal expression implying inevitability.",
    explanationJp: '不本意でもするしかないことを表す。不可避性を暗示するフォーマルな表現。',
    structure: 'Verb negative stem + ざるを得ない',
    jlptLevel: 5,
    examples: [
      {
        japanese: '事情があって、参加を断らざるを得なかった。',
        romaji: 'Jijou ga atte, sanka wo kotowara zaru wo enakatta.',
        english: 'Due to circumstances, I had no choice but to decline participation.',
        highlighted: '事情があって、参加を断ら<em>ざるを得なかった</em>。',
      },
      {
        japanese: '彼の意見を認めざるを得ない。',
        romaji: 'Kare no iken wo mitome zaru wo enai.',
        english: "I can't help but acknowledge his opinion.",
        highlighted: '彼の意見を認め<em>ざるを得ない</em>。',
      },
    ],
    relatedPatterns: ['ないわけにはいかない', 'しかない'],
    tags: ['obligation', 'inevitability', 'formal'],
  },
  {
    pattern: 'とあれば',
    name: 'If it is the case that / When it comes to',
    nameJp: '条件・場合',
    explanation:
      'Sets up a special condition that leads to a particular action or result. Often used for exceptional circumstances.',
    explanationJp: '特定の行動や結果につながる特別な条件を設定する。例外的な状況によく使われる。',
    structure: 'Noun/Plain form + とあれば',
    jlptLevel: 5,
    examples: [
      {
        japanese: '子供のためとあれば、何でもする。',
        romaji: 'Kodomo no tame to areba, nan demo suru.',
        english: "If it's for my children, I'll do anything.",
        highlighted: '子供のため<em>とあれば</em>、何でもする。',
      },
      {
        japanese: '必要とあれば、いつでも協力します。',
        romaji: 'Hitsuyou to areba, itsudemo kyouryoku shimasu.',
        english: "If it's necessary, I'll cooperate anytime.",
        highlighted: '必要<em>とあれば</em>、いつでも協力します。',
      },
    ],
    relatedPatterns: ['となると', 'とすれば', 'とあって'],
    tags: ['conditional', 'formal'],
  },
];

/**
 * Seed Japanese grammar patterns into database
 */
export async function seedJapaneseGrammarPatterns(): Promise<number> {
  let inserted = 0;

  for (const pattern of JAPANESE_GRAMMAR_PATTERNS) {
    try {
      await db
        .insert(grammarPatterns)
        .values({
          pattern: pattern.pattern,
          patternZh: pattern.pattern, // Using same for consistency
          name: pattern.name,
          nameZh: pattern.nameJp,
          explanation: pattern.explanation,
          explanationZh: pattern.explanationJp,
          structure: pattern.structure,
          hskLevel: pattern.jlptLevel, // Reusing hskLevel field for JLPT
          examples: pattern.examples,
          relatedPatterns: pattern.relatedPatterns || [],
          tags: [...(pattern.tags || []), 'japanese'],
        })
        .onConflictDoNothing();
      inserted++;
    } catch (error) {
      // Pattern already exists, skip
    }
  }

  return inserted;
}

/**
 * Get Japanese grammar patterns by JLPT level
 */
export async function getJapaneseGrammarByLevel(level: number): Promise<JapaneseGrammarPattern[]> {
  const results = await db
    .select()
    .from(grammarPatterns)
    .where(eq(grammarPatterns.hskLevel, level));

  return results
    .filter((r) => (r.tags as string[])?.includes('japanese'))
    .map((r) => ({
      id: r.id,
      pattern: r.pattern,
      name: r.name,
      nameJp: r.nameZh,
      explanation: r.explanation,
      explanationJp: r.explanationZh || undefined,
      structure: r.structure,
      jlptLevel: r.hskLevel,
      examples: r.examples as JapaneseGrammarExample[],
      relatedPatterns: r.relatedPatterns as string[] | undefined,
      tags: r.tags as string[] | undefined,
    }));
}

/**
 * Search Japanese grammar patterns
 */
export async function searchJapaneseGrammarPatterns(query: string): Promise<JapaneseGrammarPattern[]> {
  const results = await db
    .select()
    .from(grammarPatterns)
    .where(
      or(
        ilike(grammarPatterns.pattern, `%${query}%`),
        ilike(grammarPatterns.name, `%${query}%`),
        ilike(grammarPatterns.nameZh, `%${query}%`),
        ilike(grammarPatterns.explanation, `%${query}%`)
      )
    )
    .limit(20);

  return results
    .filter((r) => (r.tags as string[])?.includes('japanese'))
    .map((r) => ({
      id: r.id,
      pattern: r.pattern,
      name: r.name,
      nameJp: r.nameZh,
      explanation: r.explanation,
      explanationJp: r.explanationZh || undefined,
      structure: r.structure,
      jlptLevel: r.hskLevel,
      examples: r.examples as JapaneseGrammarExample[],
      relatedPatterns: r.relatedPatterns as string[] | undefined,
      tags: r.tags as string[] | undefined,
    }));
}
