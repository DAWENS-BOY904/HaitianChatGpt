import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number; // index of correct option (0-A, 1-B, 2-C, 3-D)
  explanation?: string;
}

interface QuizAnswer {
  questionIndex: number;
  chosenIndex: number;
  correct: boolean;
}

interface QuizViewProps {
  questions: QuizQuestion[];
  onClose: () => void;
  onViewResults: (answers: QuizAnswer[], questions: QuizQuestion[]) => void;
  onTryAnother: () => void;
  onHarderQuiz: () => void;
}

// ── Export for compatibility ──
export interface QuizModalProps extends QuizViewProps {
  visible: boolean;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

// ── Inline quiz widget that renders directly in the chat page ──
export function QuizView({ questions, onClose, onViewResults, onTryAnother, onHarderQuiz }: QuizViewProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const q = questions[currentQ] || null;
  const total = questions.length;

  useEffect(() => {
    // Reset on new questions
    setCurrentQ(0);
    setAnswers([]);
    setSelectedOption(null);
    setWrongAttempts(0);
    setShowFeedback(null);
    setFinished(false);
    setScore(0);
    fadeAnim.setValue(1);
    slideAnim.setValue(0);
  }, [questions]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const nextQuestion = (ans: QuizAnswer) => {
    const newAnswers = [...answers, ans];
    setAnswers(newAnswers);
    if (ans.correct) setScore(s => s + 1);

    setTimeout(() => {
      const nextIdx = currentQ + 1;
      if (nextIdx >= total) {
        setFinished(true);
      } else {
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setCurrentQ(nextIdx);
          setSelectedOption(null);
          setWrongAttempts(0);
          setShowFeedback(null);
          Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        });
      }
    }, 750);
  };

  const handleOptionSelect = (optionIdx: number) => {
    if (showFeedback === 'correct') return;
    if (!q) return;

    setSelectedOption(optionIdx);
    const isCorrect = optionIdx === q.answer;

    if (isCorrect) {
      setShowFeedback('correct');
      nextQuestion({ questionIndex: currentQ, chosenIndex: optionIdx, correct: true });
    } else {
      shake();
      setShowFeedback('wrong');
      const newWrong = wrongAttempts + 1;
      setWrongAttempts(newWrong);
      if (newWrong >= 2) {
        setTimeout(() => {
          nextQuestion({ questionIndex: currentQ, chosenIndex: optionIdx, correct: false });
        }, 800);
      } else {
        setTimeout(() => {
          setSelectedOption(null);
          setShowFeedback(null);
        }, 700);
      }
    }
  };

  const getScoreMessage = () => {
    const pct = score / total;
    if (pct === 1) return 'Perfect score! 🎉';
    if (pct >= 0.8) return `Great job! ${score}/${total} correct.`;
    if (pct >= 0.6) return `Good work! ${score}/${total} correct.`;
    if (pct >= 0.4) return `Keep practicing! ${score}/${total} correct.`;
    return `Room to improve! ${score}/${total} correct.`;
  };

  const getOptionBg = (idx: number) => {
    if (showFeedback === 'correct' && selectedOption === idx) return 'rgba(52,199,89,0.18)';
    if (showFeedback === 'wrong' && selectedOption === idx) return 'rgba(255,69,58,0.18)';
    return 'transparent';
  };

  const getLetterBg = (idx: number) => {
    if (showFeedback === 'correct' && selectedOption === idx) return '#34C759';
    if (showFeedback === 'wrong' && selectedOption === idx) return '#FF453A';
    return 'rgba(255,255,255,0.12)';
  };

  return (
    <View style={s.wrapper}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Quizzes</Text>
        <View style={s.thumbsRow}>
          <TouchableOpacity style={s.thumbBtn}>
            <Ionicons name="thumbs-up-outline" size={18} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
          <TouchableOpacity style={s.thumbBtn}>
            <Ionicons name="thumbs-down-outline" size={18} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card */}
      {!finished ? (
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateX: shakeAnim }] }]}>
          {/* Gradient-like top bar */}
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${((currentQ) / total) * 100}%` }]} />
          </View>
          <Text style={s.progressText}>{currentQ + 1} / {total}</Text>

          {/* Question */}
          <View style={s.questionBox}>
            <Text style={s.questionText}>{q?.question}</Text>
          </View>

          {/* Options */}
          <View style={s.optionsWrap}>
            {q?.options.map((opt, idx) => (
              <TouchableOpacity
                key={idx}
                style={[s.option, { backgroundColor: getOptionBg(idx) }]}
                onPress={() => handleOptionSelect(idx)}
                activeOpacity={0.75}
                disabled={showFeedback === 'correct'}
              >
                <View style={[s.optionLetter, { backgroundColor: getLetterBg(idx) }]}>
                  {showFeedback === 'correct' && selectedOption === idx ? (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  ) : showFeedback === 'wrong' && selectedOption === idx ? (
                    <Ionicons name="close" size={14} color="#FFF" />
                  ) : (
                    <Text style={s.optionLetterText}>{OPTION_LABELS[idx]}</Text>
                  )}
                </View>
                <Text style={s.optionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {wrongAttempts === 1 && showFeedback === null && (
            <Text style={s.hintText}>{'⚠️ 1 chance left — choose carefully!'}</Text>
          )}
        </Animated.View>
      ) : (
        /* Completion Card */
        <View style={s.card}>
          <View style={s.completionTop}>
            <Text style={s.scoreLabel}>{score} / {total}</Text>
            <Text style={s.scoreMessage}>{getScoreMessage()}</Text>
          </View>

          <TouchableOpacity style={s.viewResultsBtn} onPress={() => onViewResults(answers, questions)}>
            <Text style={s.viewResultsBtnText}>View results</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.nextQuizBtn} onPress={onTryAnother}>
            <Text style={s.nextQuizLabel}>Next quiz</Text>
            <Text style={s.nextQuizSub}>Try another general knowledge quiz</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI message + harder quiz link */}
      {!finished && (
        <View style={s.aiMsg}>
          <Text style={s.aiMsgText}>
            {"I've created a quiz for you 👆\nGo ahead and start answering the questions!\n\nIf you want a different type "}
            <Text style={s.harderLink} onPress={onHarderQuiz}>make a harder quiz</Text>
            {' or one focused on a topic you like 👍'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Backward compat wrapper (no-op modal, renders inline when visible) ──
export function QuizModal({ visible, questions, onClose, onViewResults, onTryAnother, onHarderQuiz }: QuizModalProps) {
  if (!visible) return null;
  return (
    <QuizView
      questions={questions}
      onClose={onClose}
      onViewResults={onViewResults}
      onTryAnother={onTryAnother}
      onHarderQuiz={onHarderQuiz}
    />
  );
}

const s = StyleSheet.create({
  wrapper: {
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 0,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '500' },
  thumbsRow: { flexDirection: 'row', gap: 6 },
  thumbBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(28,28,32,0.95)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#5AC8FA',
    borderRadius: 2,
  },
  progressText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  questionBox: {
    minHeight: 100,
    padding: 20,
    paddingTop: 10,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  optionsWrap: {
    paddingBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionLetterText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },
  optionText: { color: 'rgba(255,255,255,0.88)', fontSize: 15, flex: 1, lineHeight: 21 },
  hintText: {
    color: '#FF9F0A',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  completionTop: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  scoreLabel: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 10,
  },
  scoreMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
  },
  viewResultsBtn: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  viewResultsBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  nextQuizBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  nextQuizLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  nextQuizSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  aiMsg: {
    padding: 16,
    paddingBottom: 20,
  },
  aiMsgText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 21 },
  harderLink: { color: '#5AC8FA', textDecorationLine: 'underline', fontWeight: '600' },
});
Wire the quiz flow so that when the user connects Quizzes and clicks 'Connect Quizzes', the app sends a message to the AI asking it to generate 10 real quiz questions on a topic, parses the AI JSON response into QuizQuestion[] format, and displays them inline instead of using the hardcoded generateQuizQuestions fallback.
