/**
 * HSK Assessment Service
 * Provides adaptive assessment questions and evaluation logic
 */

export interface AssessmentQuestion {
  type: 'vocabulary' | 'reading' | 'grammar' | 'listening';
  question: string;
  options: string[];
  correctAnswer: string;
  hskLevel: number;
  difficulty: number; // 1-3 within the level (easy, medium, hard)
  category: string;
}

export interface AssessmentAnswer {
  questionId: number;
  answer: string;
  timeSpentMs?: number;
}

export interface AssessmentEvaluation {
  assessedLevel: number;
  confidenceScore: number;
  correctAnswers: number;
  levelBreakdown: Record<number, { correct: number; total: number; percentage: number }>;
  questionResults: Array<{
    questionId: number;
    correct: boolean;
    hskLevel: number;
  }>;
}

// HSK Vocabulary Assessment Questions
// Real HSK vocabulary with varied question types
const hskQuestions: AssessmentQuestion[] = [
  // HSK 1 - Basic
  {
    type: 'vocabulary',
    question: 'What does 你好 (nǐ hǎo) mean?',
    options: ['Goodbye', 'Hello', 'Thank you', 'Sorry'],
    correctAnswer: 'Hello',
    hskLevel: 1,
    difficulty: 1,
    category: 'greetings',
  },
  {
    type: 'vocabulary',
    question: 'How do you say "water" in Chinese?',
    options: ['茶 (chá)', '水 (shuǐ)', '咖啡 (kāfēi)', '牛奶 (niúnǎi)'],
    correctAnswer: '水 (shuǐ)',
    hskLevel: 1,
    difficulty: 1,
    category: 'food_drink',
  },
  {
    type: 'vocabulary',
    question: 'What does 谢谢 (xièxie) mean?',
    options: ['Please', 'Sorry', 'Thank you', 'You\'re welcome'],
    correctAnswer: 'Thank you',
    hskLevel: 1,
    difficulty: 1,
    category: 'greetings',
  },
  {
    type: 'reading',
    question: 'Choose the correct meaning: 我是学生',
    options: ['I am a teacher', 'I am a student', 'You are a student', 'He is a student'],
    correctAnswer: 'I am a student',
    hskLevel: 1,
    difficulty: 2,
    category: 'reading',
  },
  {
    type: 'grammar',
    question: 'Fill in the blank: 你___名字？(What is your name?)',
    options: ['是', '叫', '有', '在'],
    correctAnswer: '叫',
    hskLevel: 1,
    difficulty: 2,
    category: 'grammar',
  },

  // HSK 2 - Elementary
  {
    type: 'vocabulary',
    question: 'What does 已经 (yǐjīng) mean?',
    options: ['Still', 'Already', 'Just now', 'Later'],
    correctAnswer: 'Already',
    hskLevel: 2,
    difficulty: 1,
    category: 'time',
  },
  {
    type: 'vocabulary',
    question: 'What does 便宜 (piányi) mean?',
    options: ['Expensive', 'Cheap', 'Beautiful', 'New'],
    correctAnswer: 'Cheap',
    hskLevel: 2,
    difficulty: 1,
    category: 'shopping',
  },
  {
    type: 'reading',
    question: 'Choose the correct meaning: 我每天都去跑步',
    options: [
      'I run every day',
      'I sometimes go running',
      'I want to go running',
      'I ran yesterday',
    ],
    correctAnswer: 'I run every day',
    hskLevel: 2,
    difficulty: 2,
    category: 'reading',
  },
  {
    type: 'grammar',
    question: 'Which sentence is correct?',
    options: [
      '我去了商店昨天',
      '昨天我去了商店',
      '去了商店我昨天',
      '我昨天去商店了',
    ],
    correctAnswer: '昨天我去了商店',
    hskLevel: 2,
    difficulty: 2,
    category: 'grammar',
  },
  {
    type: 'vocabulary',
    question: 'What does 虽然...但是... mean?',
    options: [
      'Because...so...',
      'Although...but...',
      'If...then...',
      'Not only...but also...',
    ],
    correctAnswer: 'Although...but...',
    hskLevel: 2,
    difficulty: 3,
    category: 'grammar',
  },

  // HSK 3 - Intermediate
  {
    type: 'vocabulary',
    question: 'What does 关系 (guānxi) mean?',
    options: ['Close', 'Relationship', 'Problem', 'Important'],
    correctAnswer: 'Relationship',
    hskLevel: 3,
    difficulty: 1,
    category: 'social',
  },
  {
    type: 'vocabulary',
    question: 'What does 环境 (huánjìng) mean?',
    options: ['Weather', 'Environment', 'Scenery', 'Condition'],
    correctAnswer: 'Environment',
    hskLevel: 3,
    difficulty: 1,
    category: 'nature',
  },
  {
    type: 'reading',
    question: 'Choose the best translation: 他的中文说得越来越好了',
    options: [
      'His Chinese is very good',
      'His Chinese is getting better and better',
      'He speaks Chinese well',
      'He wants to speak Chinese better',
    ],
    correctAnswer: 'His Chinese is getting better and better',
    hskLevel: 3,
    difficulty: 2,
    category: 'reading',
  },
  {
    type: 'grammar',
    question: 'Fill in the blank: 你___早点来，___可以帮我们准备',
    options: [
      '如果...就...',
      '虽然...但是...',
      '不但...而且...',
      '因为...所以...',
    ],
    correctAnswer: '如果...就...',
    hskLevel: 3,
    difficulty: 2,
    category: 'grammar',
  },
  {
    type: 'vocabulary',
    question: 'What does 结果 (jiéguǒ) mean?',
    options: ['Beginning', 'Process', 'Result', 'Purpose'],
    correctAnswer: 'Result',
    hskLevel: 3,
    difficulty: 2,
    category: 'abstract',
  },

  // HSK 4 - Upper Intermediate
  {
    type: 'vocabulary',
    question: 'What does 尊重 (zūnzhòng) mean?',
    options: ['Ignore', 'Respect', 'Understand', 'Accept'],
    correctAnswer: 'Respect',
    hskLevel: 4,
    difficulty: 1,
    category: 'values',
  },
  {
    type: 'vocabulary',
    question: 'What does 竞争 (jìngzhēng) mean?',
    options: ['Cooperation', 'Competition', 'Development', 'Progress'],
    correctAnswer: 'Competition',
    hskLevel: 4,
    difficulty: 1,
    category: 'business',
  },
  {
    type: 'reading',
    question: 'Choose the meaning: 这件事情对我来说无所谓',
    options: [
      'This matter is very important to me',
      'I don\'t care about this matter',
      'I don\'t know about this',
      'This is none of my business',
    ],
    correctAnswer: 'I don\'t care about this matter',
    hskLevel: 4,
    difficulty: 2,
    category: 'reading',
  },
  {
    type: 'grammar',
    question: 'Which usage of 把 is correct?',
    options: [
      '我把书看了',
      '我把看书了',
      '我把书放在桌子上了',
      '我书把放了',
    ],
    correctAnswer: '我把书放在桌子上了',
    hskLevel: 4,
    difficulty: 2,
    category: 'grammar',
  },
  {
    type: 'vocabulary',
    question: 'What does 既然...就... mean?',
    options: [
      'Although...but...',
      'Since...then...',
      'Not only...but also...',
      'Whether...or...',
    ],
    correctAnswer: 'Since...then...',
    hskLevel: 4,
    difficulty: 3,
    category: 'grammar',
  },

  // HSK 5 - Advanced
  {
    type: 'vocabulary',
    question: 'What does 挣扎 (zhēngzhá) mean?',
    options: ['Rest', 'Struggle', 'Success', 'Patience'],
    correctAnswer: 'Struggle',
    hskLevel: 5,
    difficulty: 1,
    category: 'abstract',
  },
  {
    type: 'vocabulary',
    question: 'What does 偶然 (ǒurán) mean?',
    options: ['Necessary', 'Occasional/By chance', 'Regular', 'Important'],
    correctAnswer: 'Occasional/By chance',
    hskLevel: 5,
    difficulty: 1,
    category: 'abstract',
  },
  {
    type: 'reading',
    question: 'Choose the meaning: 他不愧是专家，处理得井井有条',
    options: [
      'He is ashamed to be an expert',
      'He deserves to be called an expert, handling things in perfect order',
      'He is pretending to be an expert',
      'He wants to become an expert',
    ],
    correctAnswer: 'He deserves to be called an expert, handling things in perfect order',
    hskLevel: 5,
    difficulty: 2,
    category: 'reading',
  },
  {
    type: 'grammar',
    question: 'What does 与其...不如... express?',
    options: [
      'Both...and...',
      'Rather than...it would be better to...',
      'Not only...but also...',
      'As...as...',
    ],
    correctAnswer: 'Rather than...it would be better to...',
    hskLevel: 5,
    difficulty: 2,
    category: 'grammar',
  },
  {
    type: 'vocabulary',
    question: 'What does 纠结 (jiūjié) mean?',
    options: ['Happy', 'Tangled/Torn (emotionally)', 'Angry', 'Surprised'],
    correctAnswer: 'Tangled/Torn (emotionally)',
    hskLevel: 5,
    difficulty: 3,
    category: 'emotions',
  },

  // HSK 6 - Proficient
  {
    type: 'vocabulary',
    question: 'What does 惆怅 (chóuchàng) mean?',
    options: ['Excited', 'Melancholy', 'Satisfied', 'Surprised'],
    correctAnswer: 'Melancholy',
    hskLevel: 6,
    difficulty: 1,
    category: 'emotions',
  },
  {
    type: 'vocabulary',
    question: 'What does 渊博 (yuānbó) mean?',
    options: ['Shallow', 'Profound and extensive', 'Simple', 'Complicated'],
    correctAnswer: 'Profound and extensive',
    hskLevel: 6,
    difficulty: 1,
    category: 'descriptive',
  },
  {
    type: 'reading',
    question: 'Choose the meaning: 这篇文章鞭辟入里，发人深省',
    options: [
      'This article is boring and superficial',
      'This article is incisive and thought-provoking',
      'This article is too long',
      'This article is confusing',
    ],
    correctAnswer: 'This article is incisive and thought-provoking',
    hskLevel: 6,
    difficulty: 2,
    category: 'reading',
  },
  {
    type: 'grammar',
    question: 'What does 固然...然而... express?',
    options: [
      'If...then...',
      'Granted that...however...',
      'Because...therefore...',
      'Unless...otherwise...',
    ],
    correctAnswer: 'Granted that...however...',
    hskLevel: 6,
    difficulty: 2,
    category: 'grammar',
  },
  {
    type: 'vocabulary',
    question: 'What does 矫揉造作 (jiǎoróu zàozuò) mean?',
    options: [
      'Natural and elegant',
      'Affected and artificial',
      'Simple and plain',
      'Bold and confident',
    ],
    correctAnswer: 'Affected and artificial',
    hskLevel: 6,
    difficulty: 3,
    category: 'idiom',
  },
];

/**
 * Get assessment questions based on estimated starting level
 * Uses adaptive algorithm to select appropriate questions
 */
export function getHskAssessmentQuestions(startLevel: number): AssessmentQuestion[] {
  const selectedQuestions: AssessmentQuestion[] = [];

  // Determine the range of levels to test
  const minLevel = Math.max(1, startLevel - 1);
  const maxLevel = Math.min(6, startLevel + 2);

  // Select questions for each level in range
  for (let level = minLevel; level <= maxLevel; level++) {
    const levelQuestions = hskQuestions.filter(q => q.hskLevel === level);

    // Select 3-4 questions per level, prioritizing variety
    const questionsPerLevel = level === startLevel ? 4 : 3;
    const shuffled = shuffleArray([...levelQuestions]);

    // Try to get a mix of question types
    const types = ['vocabulary', 'reading', 'grammar'];
    let selected = 0;

    for (const type of types) {
      const typeQuestion = shuffled.find(q => q.type === type && !selectedQuestions.includes(q));
      if (typeQuestion && selected < questionsPerLevel) {
        selectedQuestions.push(typeQuestion);
        selected++;
      }
    }

    // Fill remaining with any available questions
    for (const q of shuffled) {
      if (!selectedQuestions.includes(q) && selected < questionsPerLevel) {
        selectedQuestions.push(q);
        selected++;
      }
    }
  }

  // Sort by level for progressive difficulty
  return selectedQuestions.sort((a, b) => {
    if (a.hskLevel !== b.hskLevel) return a.hskLevel - b.hskLevel;
    return a.difficulty - b.difficulty;
  });
}

/**
 * Evaluate assessment answers and determine HSK level
 */
export function evaluateAssessment(
  questions: AssessmentQuestion[],
  answers: AssessmentAnswer[]
): AssessmentEvaluation {
  const levelBreakdown: Record<number, { correct: number; total: number; percentage: number }> = {};
  const questionResults: Array<{ questionId: number; correct: boolean; hskLevel: number }> = [];
  let totalCorrect = 0;

  // Initialize level breakdown
  for (let level = 1; level <= 6; level++) {
    levelBreakdown[level] = { correct: 0, total: 0, percentage: 0 };
  }

  // Evaluate each answer
  for (const answer of answers) {
    const question = questions[answer.questionId];
    if (!question) continue;

    const isCorrect = answer.answer === question.correctAnswer;

    levelBreakdown[question.hskLevel].total++;
    if (isCorrect) {
      levelBreakdown[question.hskLevel].correct++;
      totalCorrect++;
    }

    questionResults.push({
      questionId: answer.questionId,
      correct: isCorrect,
      hskLevel: question.hskLevel,
    });
  }

  // Calculate percentages
  for (let level = 1; level <= 6; level++) {
    if (levelBreakdown[level].total > 0) {
      levelBreakdown[level].percentage = Math.round(
        (levelBreakdown[level].correct / levelBreakdown[level].total) * 100
      );
    }
  }

  // Determine assessed level based on performance
  // Find the highest level where user got >= 60% correct
  let assessedLevel = 1;
  let confidenceScore = 0;

  for (let level = 6; level >= 1; level--) {
    const breakdown = levelBreakdown[level];
    if (breakdown.total >= 2 && breakdown.percentage >= 60) {
      assessedLevel = level;
      // Base confidence on how well they did at this level
      confidenceScore = Math.min(100, breakdown.percentage + 10);
      break;
    }
  }

  // If they didn't hit 60% at any level, default to 1
  if (confidenceScore === 0) {
    assessedLevel = 1;
    // Low confidence if they're defaulting
    const level1Score = levelBreakdown[1].percentage || 0;
    confidenceScore = Math.max(30, Math.min(60, level1Score));
  }

  // Adjust confidence based on consistency
  // If answers are very inconsistent (e.g., getting HSK 5 right but HSK 2 wrong), lower confidence
  const inconsistencies = countInconsistencies(questionResults);
  confidenceScore = Math.max(30, confidenceScore - inconsistencies * 5);

  return {
    assessedLevel,
    confidenceScore,
    correctAnswers: totalCorrect,
    levelBreakdown,
    questionResults,
  };
}

/**
 * Count inconsistencies in answers (higher level correct but lower level wrong)
 */
function countInconsistencies(
  results: Array<{ questionId: number; correct: boolean; hskLevel: number }>
): number {
  let inconsistencies = 0;

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const r1 = results[i];
      const r2 = results[j];

      // Check if a higher level question was correct while a lower level was wrong
      if (r1.hskLevel < r2.hskLevel && !r1.correct && r2.correct) {
        inconsistencies++;
      } else if (r2.hskLevel < r1.hskLevel && !r2.correct && r1.correct) {
        inconsistencies++;
      }
    }
  }

  return inconsistencies;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
