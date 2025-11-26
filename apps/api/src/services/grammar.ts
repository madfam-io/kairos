/**
 * Grammar Service
 * Provides grammar pattern explanations for Chinese text
 */

import { db, grammarPatterns } from '../db';
import { eq, ilike, or, sql } from 'drizzle-orm';

export interface GrammarExample {
  chinese: string;
  pinyin: string;
  english: string;
  highlighted: string;
}

export interface GrammarPattern {
  id: string;
  pattern: string;
  patternZh: string;
  name: string;
  nameZh: string;
  explanation: string;
  explanationZh?: string;
  structure: string;
  hskLevel: number | null;
  examples: GrammarExample[];
  relatedPatterns?: string[];
  tags?: string[];
}

/**
 * Common Chinese grammar patterns (seed data)
 * These are loaded into the database on first run
 */
export const COMMON_GRAMMAR_PATTERNS: Omit<GrammarPattern, 'id'>[] = [
  // HSK 1-2 Patterns
  {
    pattern: '是...的',
    patternZh: '是...的',
    name: 'Shi...de construction',
    nameZh: '是...的结构',
    explanation: 'Used to emphasize when, where, how, or who performed an action. The emphasis is on the circumstances of a completed action, not the action itself.',
    explanationZh: '用于强调动作发生的时间、地点、方式或执行者。强调的是已完成动作的情况,而不是动作本身。',
    structure: '是 + [time/place/manner/agent] + Verb + 的',
    hskLevel: 2,
    examples: [
      { chinese: '我是在北京学的中文。', pinyin: 'Wǒ shì zài Běijīng xué de Zhōngwén.', english: 'I learned Chinese in Beijing.', highlighted: '我<em>是</em>在北京学<em>的</em>中文。' },
      { chinese: '他是昨天来的。', pinyin: 'Tā shì zuótiān lái de.', english: 'He came yesterday.', highlighted: '他<em>是</em>昨天来<em>的</em>。' },
    ],
    relatedPatterns: ['是', '的'],
    tags: ['emphasis', 'past'],
  },
  {
    pattern: '了',
    patternZh: '了',
    name: 'Le - Completed action',
    nameZh: '了 - 完成态',
    explanation: 'Indicates a completed action or a change of state. Placed after the verb for completed actions, or at the end of a sentence for change of state.',
    explanationZh: '表示动作完成或状态变化。动作完成时放在动词后,状态变化时放在句末。',
    structure: 'Verb + 了 (completed) / Sentence + 了 (change)',
    hskLevel: 1,
    examples: [
      { chinese: '我吃了饭。', pinyin: 'Wǒ chī le fàn.', english: 'I ate.', highlighted: '我吃<em>了</em>饭。' },
      { chinese: '下雨了。', pinyin: 'Xià yǔ le.', english: "It's raining now.", highlighted: '下雨<em>了</em>。' },
    ],
    relatedPatterns: ['过', '着'],
    tags: ['aspect', 'completed'],
  },
  {
    pattern: '过',
    patternZh: '过',
    name: 'Guo - Experiential aspect',
    nameZh: '过 - 经历态',
    explanation: 'Indicates that an action has been experienced at least once before. Emphasizes the experience rather than when it happened.',
    explanationZh: '表示某动作曾经发生过至少一次。强调经历而非发生时间。',
    structure: 'Verb + 过',
    hskLevel: 2,
    examples: [
      { chinese: '我去过中国。', pinyin: 'Wǒ qù guo Zhōngguó.', english: 'I have been to China.', highlighted: '我去<em>过</em>中国。' },
      { chinese: '你吃过北京烤鸭吗？', pinyin: 'Nǐ chī guo Běijīng kǎoyā ma?', english: 'Have you ever eaten Peking duck?', highlighted: '你吃<em>过</em>北京烤鸭吗？' },
    ],
    relatedPatterns: ['了', '着'],
    tags: ['aspect', 'experience'],
  },
  {
    pattern: '着',
    patternZh: '着',
    name: 'Zhe - Continuous aspect',
    nameZh: '着 - 持续态',
    explanation: 'Indicates a continuous or ongoing state. Often used to describe the manner in which something is being done.',
    explanationZh: '表示动作或状态的持续。常用于描述做某事的方式。',
    structure: 'Verb + 着',
    hskLevel: 2,
    examples: [
      { chinese: '门开着。', pinyin: 'Mén kāi zhe.', english: 'The door is open.', highlighted: '门开<em>着</em>。' },
      { chinese: '他笑着说。', pinyin: 'Tā xiào zhe shuō.', english: 'He said with a smile.', highlighted: '他笑<em>着</em>说。' },
    ],
    relatedPatterns: ['了', '过', '在'],
    tags: ['aspect', 'continuous'],
  },
  // HSK 3 Patterns
  {
    pattern: '把',
    patternZh: '把',
    name: 'Ba construction',
    nameZh: '把字句',
    explanation: 'Moves the object before the verb to emphasize what happens to it. Used when the action affects or changes the object in some way.',
    explanationZh: '将宾语提到动词前,强调对宾语的处置。用于动作对宾语产生影响或改变时。',
    structure: 'Subject + 把 + Object + Verb + Result',
    hskLevel: 3,
    examples: [
      { chinese: '请把门关上。', pinyin: 'Qǐng bǎ mén guān shàng.', english: 'Please close the door.', highlighted: '请<em>把</em>门关上。' },
      { chinese: '我把作业做完了。', pinyin: 'Wǒ bǎ zuòyè zuò wán le.', english: 'I finished my homework.', highlighted: '我<em>把</em>作业做完了。' },
    ],
    relatedPatterns: ['被', '让', '叫'],
    tags: ['disposal', 'object-front'],
  },
  {
    pattern: '被',
    patternZh: '被',
    name: 'Bei - Passive voice',
    nameZh: '被字句 - 被动语态',
    explanation: 'Forms passive sentences where the subject receives the action. Often used for unpleasant or unexpected events.',
    explanationZh: '构成被动句,主语是动作的承受者。常用于不愉快或意外事件。',
    structure: 'Subject + 被 + (Agent) + Verb + Result',
    hskLevel: 3,
    examples: [
      { chinese: '我的手机被偷了。', pinyin: 'Wǒ de shǒujī bèi tōu le.', english: 'My phone was stolen.', highlighted: '我的手机<em>被</em>偷了。' },
      { chinese: '蛋糕被吃完了。', pinyin: 'Dàngāo bèi chī wán le.', english: 'The cake was eaten up.', highlighted: '蛋糕<em>被</em>吃完了。' },
    ],
    relatedPatterns: ['把', '让', '叫', '给'],
    tags: ['passive', 'voice'],
  },
  {
    pattern: '比',
    patternZh: '比',
    name: 'Bi - Comparison',
    nameZh: '比较句',
    explanation: 'Used to compare two things. A is compared to B, showing A has more/less of a quality than B.',
    explanationZh: '用于比较两个事物。A与B相比,表示A在某方面多于或少于B。',
    structure: 'A + 比 + B + Adjective (+ degree)',
    hskLevel: 3,
    examples: [
      { chinese: '他比我高。', pinyin: 'Tā bǐ wǒ gāo.', english: 'He is taller than me.', highlighted: '他<em>比</em>我高。' },
      { chinese: '今天比昨天冷多了。', pinyin: 'Jīntiān bǐ zuótiān lěng duō le.', english: 'Today is much colder than yesterday.', highlighted: '今天<em>比</em>昨天冷多了。' },
    ],
    relatedPatterns: ['没有', '跟...一样', '越来越'],
    tags: ['comparison'],
  },
  // HSK 4 Patterns
  {
    pattern: '越...越...',
    patternZh: '越...越...',
    name: 'Yue...yue - The more...the more',
    nameZh: '越...越... - 递进关系',
    explanation: 'Expresses that as one thing increases, another increases proportionally. Can use the same or different adjectives/verbs.',
    explanationZh: '表示一件事随另一件事增加而成比例增加。可用相同或不同的形容词/动词。',
    structure: '越 + A + 越 + B',
    hskLevel: 4,
    examples: [
      { chinese: '越学越有意思。', pinyin: 'Yuè xué yuè yǒu yìsi.', english: 'The more you study, the more interesting it gets.', highlighted: '<em>越</em>学<em>越</em>有意思。' },
      { chinese: '雨越下越大。', pinyin: 'Yǔ yuè xià yuè dà.', english: 'The rain is getting heavier and heavier.', highlighted: '雨<em>越</em>下<em>越</em>大。' },
    ],
    relatedPatterns: ['越来越', '比'],
    tags: ['correlation', 'progressive'],
  },
  {
    pattern: '不但...而且...',
    patternZh: '不但...而且...',
    name: 'Budan...erqie - Not only...but also',
    nameZh: '不但...而且... - 递进复句',
    explanation: 'Connects two clauses to show progression. The second clause adds to or intensifies the first.',
    explanationZh: '连接两个分句表示递进关系。第二个分句对第一个分句进行补充或加强。',
    structure: '不但 + Clause 1 + 而且 + Clause 2',
    hskLevel: 4,
    examples: [
      { chinese: '他不但会说中文,而且会说日文。', pinyin: 'Tā búdàn huì shuō Zhōngwén, érqiě huì shuō Rìwén.', english: 'He can not only speak Chinese, but also Japanese.', highlighted: '他<em>不但</em>会说中文,<em>而且</em>会说日文。' },
    ],
    relatedPatterns: ['不仅...还...', '既...又...'],
    tags: ['conjunction', 'progressive'],
  },
  {
    pattern: '虽然...但是...',
    patternZh: '虽然...但是...',
    name: 'Suiran...danshi - Although...but',
    nameZh: '虽然...但是... - 转折复句',
    explanation: 'Expresses contrast or concession. Acknowledges one fact while presenting a contrasting one.',
    explanationZh: '表示转折或让步关系。承认一个事实同时提出相反的情况。',
    structure: '虽然 + Clause 1 + 但是 + Clause 2',
    hskLevel: 4,
    examples: [
      { chinese: '虽然很累,但是很开心。', pinyin: 'Suīrán hěn lèi, dànshì hěn kāixīn.', english: "Although I'm tired, I'm happy.", highlighted: '<em>虽然</em>很累,<em>但是</em>很开心。' },
    ],
    relatedPatterns: ['尽管...还是...', '即使...也...'],
    tags: ['conjunction', 'contrast'],
  },
  // HSK 5 Patterns
  {
    pattern: '无论...都...',
    patternZh: '无论...都...',
    name: 'Wulun...dou - No matter...all',
    nameZh: '无论...都... - 条件复句',
    explanation: 'Expresses that the result is the same regardless of the condition. Similar to "no matter what/how/where".',
    explanationZh: '表示无论什么条件,结果都相同。类似"不管怎样/哪里"。',
    structure: '无论 + Question word/Choice + 都 + Result',
    hskLevel: 5,
    examples: [
      { chinese: '无论多难,我都会坚持。', pinyin: 'Wúlùn duō nán, wǒ dōu huì jiānchí.', english: 'No matter how difficult, I will persist.', highlighted: '<em>无论</em>多难,我<em>都</em>会坚持。' },
      { chinese: '无论你去哪儿,我都跟着你。', pinyin: 'Wúlùn nǐ qù nǎr, wǒ dōu gēn zhe nǐ.', english: 'No matter where you go, I will follow you.', highlighted: '<em>无论</em>你去哪儿,我<em>都</em>跟着你。' },
    ],
    relatedPatterns: ['不管...都...', '即使...也...'],
    tags: ['conjunction', 'unconditional'],
  },
  {
    pattern: '之所以...是因为...',
    patternZh: '之所以...是因为...',
    name: 'Zhisuoyi...shi yinwei - The reason...is because',
    nameZh: '之所以...是因为... - 因果复句',
    explanation: 'Emphasizes the reason for something. Used to provide explanation after stating a result or situation.',
    explanationZh: '强调某事的原因。用于陈述结果或情况后提供解释。',
    structure: '之所以 + Result + 是因为 + Reason',
    hskLevel: 5,
    examples: [
      { chinese: '我之所以学中文,是因为我喜欢中国文化。', pinyin: 'Wǒ zhī suǒyǐ xué Zhōngwén, shì yīnwèi wǒ xǐhuān Zhōngguó wénhuà.', english: 'The reason I study Chinese is because I like Chinese culture.', highlighted: '我<em>之所以</em>学中文,<em>是因为</em>我喜欢中国文化。' },
    ],
    relatedPatterns: ['因为...所以...', '由于'],
    tags: ['conjunction', 'cause-effect'],
  },
  {
    pattern: '与其...不如...',
    patternZh: '与其...不如...',
    name: 'Yuqi...buru - Rather than...better to',
    nameZh: '与其...不如... - 选择复句',
    explanation: 'Compares two options and expresses preference for the second. Indicates the second choice is better.',
    explanationZh: '比较两个选项并表示倾向于第二个。表示第二个选择更好。',
    structure: '与其 + Option A + 不如 + Option B',
    hskLevel: 5,
    examples: [
      { chinese: '与其抱怨,不如行动。', pinyin: 'Yǔqí bàoyuàn, bùrú xíngdòng.', english: "Rather than complaining, it's better to take action.", highlighted: '<em>与其</em>抱怨,<em>不如</em>行动。' },
    ],
    relatedPatterns: ['宁可...也不...', '还是...吧'],
    tags: ['conjunction', 'preference'],
  },
];

/**
 * Find grammar patterns in text
 */
export async function findGrammarInText(text: string): Promise<GrammarPattern[]> {
  // Get all patterns from database
  const patterns = await db.select().from(grammarPatterns);

  // Find matching patterns
  const matches: GrammarPattern[] = [];
  for (const pattern of patterns) {
    if (text.includes(pattern.pattern) || text.includes(pattern.patternZh)) {
      matches.push({
        id: pattern.id,
        pattern: pattern.pattern,
        patternZh: pattern.patternZh,
        name: pattern.name,
        nameZh: pattern.nameZh,
        explanation: pattern.explanation,
        explanationZh: pattern.explanationZh || undefined,
        structure: pattern.structure,
        hskLevel: pattern.hskLevel,
        examples: pattern.examples as GrammarExample[],
        relatedPatterns: pattern.relatedPatterns as string[] | undefined,
        tags: pattern.tags as string[] | undefined,
      });
    }
  }

  return matches;
}

/**
 * Get grammar explanation for a specific pattern
 */
export async function getGrammarExplanation(
  pattern: string
): Promise<GrammarPattern | null> {
  const [result] = await db
    .select()
    .from(grammarPatterns)
    .where(
      or(
        eq(grammarPatterns.pattern, pattern),
        eq(grammarPatterns.patternZh, pattern),
        ilike(grammarPatterns.pattern, `%${pattern}%`)
      )
    )
    .limit(1);

  if (!result) return null;

  return {
    id: result.id,
    pattern: result.pattern,
    patternZh: result.patternZh,
    name: result.name,
    nameZh: result.nameZh,
    explanation: result.explanation,
    explanationZh: result.explanationZh || undefined,
    structure: result.structure,
    hskLevel: result.hskLevel,
    examples: result.examples as GrammarExample[],
    relatedPatterns: result.relatedPatterns as string[] | undefined,
    tags: result.tags as string[] | undefined,
  };
}

/**
 * Get all grammar patterns by HSK level
 */
export async function getGrammarByLevel(level: number): Promise<GrammarPattern[]> {
  const results = await db
    .select()
    .from(grammarPatterns)
    .where(eq(grammarPatterns.hskLevel, level));

  return results.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    patternZh: r.patternZh,
    name: r.name,
    nameZh: r.nameZh,
    explanation: r.explanation,
    explanationZh: r.explanationZh || undefined,
    structure: r.structure,
    hskLevel: r.hskLevel,
    examples: r.examples as GrammarExample[],
    relatedPatterns: r.relatedPatterns as string[] | undefined,
    tags: r.tags as string[] | undefined,
  }));
}

/**
 * Seed grammar patterns into database
 */
export async function seedGrammarPatterns(): Promise<number> {
  let inserted = 0;

  for (const pattern of COMMON_GRAMMAR_PATTERNS) {
    try {
      await db
        .insert(grammarPatterns)
        .values({
          pattern: pattern.pattern,
          patternZh: pattern.patternZh,
          name: pattern.name,
          nameZh: pattern.nameZh,
          explanation: pattern.explanation,
          explanationZh: pattern.explanationZh,
          structure: pattern.structure,
          hskLevel: pattern.hskLevel,
          examples: pattern.examples,
          relatedPatterns: pattern.relatedPatterns || [],
          tags: pattern.tags || [],
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
 * Search grammar patterns
 */
export async function searchGrammarPatterns(query: string): Promise<GrammarPattern[]> {
  const results = await db
    .select()
    .from(grammarPatterns)
    .where(
      or(
        ilike(grammarPatterns.pattern, `%${query}%`),
        ilike(grammarPatterns.patternZh, `%${query}%`),
        ilike(grammarPatterns.name, `%${query}%`),
        ilike(grammarPatterns.nameZh, `%${query}%`),
        ilike(grammarPatterns.explanation, `%${query}%`)
      )
    )
    .limit(20);

  return results.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    patternZh: r.patternZh,
    name: r.name,
    nameZh: r.nameZh,
    explanation: r.explanation,
    explanationZh: r.explanationZh || undefined,
    structure: r.structure,
    hskLevel: r.hskLevel,
    examples: r.examples as GrammarExample[],
    relatedPatterns: r.relatedPatterns as string[] | undefined,
    tags: r.tags as string[] | undefined,
  }));
}
