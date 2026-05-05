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
import { useTheme } from '../hooks/useTheme';

const { width: SW } = Dimensions.get('window');

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

interface QuizAnswer {
  questionIndex: number;
  chosenIndex: number;
  correct: boolean;
}

export interface QuizHistoryEntry {
  topic: string;
  difficulty: string;
  score: number;
  total: number;
  created_at: string;
}

interface QuizViewProps {
  questions: QuizQuestion[];
  onClose: () => void;
  onViewResults: (answers: QuizAnswer[], questions: QuizQuestion[]) => void;
  onTryAnother: () => void;
  onHarderQuiz: () => void;
  quizHistory?: QuizHistoryEntry[];
  onComplete?: () => void;
  preGeneratedQuestions?: QuizQuestion[] | null;
  onNextQuiz?: () => Promise<void>;
}

export interface QuizModalProps extends QuizViewProps {
  visible: boolean;
  quizHistory?: QuizHistoryEntry[];
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function QuizView({ questions, onClose, onViewResults, onTryAnother, onHarderQuiz, quizHistory, onComplete, preGeneratedQuestions, onNextQuiz }: QuizViewProps) {
  const { colors, isDark } = useTheme();

  // Dynamic theme tokens
  const wrapBg = isDark ? '#111113' : '#F2F2F7';
  const cardBg = isDark ? 'rgba(28,28,32,0.98)' : 'rgba(255,255,255,0.98)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const textC = isDark ? '#FFFFFF' : '#000000';
  const subC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const headerTitleC = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const progressBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const qBoxBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const optionBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const letterBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
  const letterTextC = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)';
  const optionTextC = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const viewResultsBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
  const viewResultsBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const nextBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const nextBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const nextSubC = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.38)';
  const historyBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const historyBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const historyTopicC = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
  const historyDateC = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const aiMsgC = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const q = questions[currentQ] || null;
  const total = questions.length;

  useEffect(() => {
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
        onComplete?.();
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
        setTimeout(() => { nextQuestion({ questionIndex: currentQ, chosenIndex: optionIdx, correct: false }); }, 800);
      } else {
        setTimeout(() => { setSelectedOption(null); setShowFeedback(null); }, 700);
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

  const getDifficultyColor = (diff: string) => {
    const map: Record<string, string> = { Easy: '#34C759', Medium: '#5AC8FA', Hard: '#FF9F0A', Expert: '#FF453A' };
    return map[diff] || '#8E8E93';
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  const getOptionBg = (idx: number) => {
    if (showFeedback === 'correct' && selectedOption === idx) return 'rgba(52,199,89,0.18)';
    if (showFeedback === 'wrong' && selectedOption === idx) return 'rgba(255,69,58,0.18)';
    return 'transparent';
  };

  const getLetterBg = (idx: number) => {
    if (showFeedback === 'correct' && selectedOption === idx) return '#34C759';
    if (showFeedback === 'wrong' && selectedOption === idx) return '#FF453A';
    return letterBg;
  };

  return (
    <View style={[s.wrapper, { backgroundColor: wrapBg }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.closeBtn} />
        <Text style={[s.headerTitle, { color: headerTitleC }]}>Quizzes</Text>
        <View style={s.thumbsRow}>
          <TouchableOpacity style={s.thumbBtn}>
            <Ionicons name="thumbs-up-outline" size={18} color={subC} />
          </TouchableOpacity>
          <TouchableOpacity style={s.thumbBtn}>
            <Ionicons name="thumbs-down-outline" size={18} color={subC} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card */}
      {!finished ? (
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateX: shakeAnim }], backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[s.progressBar, { backgroundColor: progressBg }]}>
            <View style={[s.progressFill, { width: `${((currentQ) / total) * 100}%` }]} />
          </View>
          <Text style={[s.progressText, { color: subC }]}>{currentQ + 1} / {total}</Text>

          <View style={[s.questionBox, { borderBottomColor: qBoxBorder }]}>
            <Text style={[s.questionText, { color: textC }]}>{q?.question}</Text>
          </View>

          <View style={s.optionsWrap}>
            {q?.options.map((opt, idx) => (
              <TouchableOpacity
                key={idx}
                style={[s.option, { backgroundColor: getOptionBg(idx), borderBottomColor: optionBorder }]}
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
                    <Text style={[s.optionLetterText, { color: letterTextC }]}>{OPTION_LABELS[idx]}</Text>
                  )}
                </View>
                <Text style={[s.optionText, { color: optionTextC }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {wrongAttempts === 1 && showFeedback === null && (
            <Text style={s.hintText}>{'⚠️ 1 chance left — choose carefully!'}</Text>
          )}
        </Animated.View>
      ) : (
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.completionTop}>
            <Text style={[s.scoreLabel, { color: textC }]}>{score} / {total}</Text>
            <Text style={[s.scoreMessage, { color: subC }]}>{getScoreMessage()}</Text>
          </View>

          <TouchableOpacity style={[s.viewResultsBtn, { backgroundColor: viewResultsBg, borderColor: viewResultsBorder }]} onPress={() => onViewResults(answers, questions)}>
            <Text style={[s.viewResultsBtnText, { color: textC }]}>View results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.nextQuizBtn, { backgroundColor: nextBg, borderColor: nextBorder }, loadingNext && { opacity: 0.6 }]}
            disabled={loadingNext}
            onPress={async () => {
              if (onNextQuiz) { setLoadingNext(true); try { await onNextQuiz(); } finally { setLoadingNext(false); } }
              else { onTryAnother(); }
            }}
          >
            {loadingNext ? (
              <Text style={[s.nextQuizLabel, { color: textC }]}>Generating quiz…</Text>
            ) : (
              <>
                <Text style={[s.nextQuizLabel, { color: textC }]}>Next quiz</Text>
                <Text style={[s.nextQuizSub, { color: nextSubC }]}>Try another general knowledge quiz</Text>
              </>
            )}
          </TouchableOpacity>

          {quizHistory && quizHistory.length > 0 && (
            <View style={[s.historySection, { backgroundColor: historyBg, borderColor: historyBorder }]}>
              <Text style={[s.historySectionTitle, { color: subC }]}>My Quiz History</Text>
              {quizHistory.slice(0, 5).map((entry, i) => (
                <View key={i} style={[s.historyRow, { borderTopColor: historyBorder }]}>
                  <View style={s.historyLeft}>
                    <Text style={[s.historyTopic, { color: historyTopicC }]} numberOfLines={1}>{entry.topic}</Text>
                    <View style={s.historyMeta}>
                      <View style={[s.diffBadge, { backgroundColor: getDifficultyColor(entry.difficulty) + '22', borderColor: getDifficultyColor(entry.difficulty) + '55' }]}>
                        <Text style={[s.diffBadgeText, { color: getDifficultyColor(entry.difficulty) }]}>{entry.difficulty}</Text>
                      </View>
                      <Text style={[s.historyDate, { color: historyDateC }]}>{formatDate(entry.created_at)}</Text>
                    </View>
                  </View>
                  <View style={s.historyScore}>
                    <Text style={[s.historyScoreText, { color: entry.score / entry.total >= 0.7 ? '#34C759' : entry.score / entry.total >= 0.4 ? '#FF9F0A' : '#FF453A' }]}>{entry.score}/{entry.total}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {!finished && (
        <View style={s.aiMsg}>
          <Text style={[s.aiMsgText, { color: aiMsgC }]}>
            {"I've created a quiz for you 👆\nGo ahead and start answering the questions!\n\nIf you want a different type "}
            <Text style={s.harderLink} onPress={onHarderQuiz}>make a harder quiz</Text>
            {' or one focused on a topic you like 👍'}
          </Text>
        </View>
      )}
    </View>
  );
}

export function QuizModal({ visible, questions, onClose, onViewResults, onTryAnother, onHarderQuiz, quizHistory }: QuizModalProps) {
  if (!visible) return null;
  return (
    <QuizView questions={questions} onClose={onClose} onViewResults={onViewResults} onTryAnother={onTryAnother} onHarderQuiz={onHarderQuiz} quizHistory={quizHistory} />
  );
}

const s = StyleSheet.create({
  wrapper: { borderRadius: 20, overflow: 'hidden', marginHorizontal: 0, marginVertical: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '500' },
  thumbsRow: { flexDirection: 'row', gap: 6 },
  thumbBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  card: { marginHorizontal: 12, marginBottom: 12, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  progressBar: { height: 3 },
  progressFill: { height: 3, backgroundColor: '#5AC8FA', borderRadius: 2 },
  progressText: { fontSize: 12, fontWeight: '500', textAlign: 'center', paddingTop: 10, paddingBottom: 4 },
  questionBox: { minHeight: 100, padding: 20, paddingTop: 10, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  questionText: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  optionsWrap: { paddingBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  optionLetter: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionLetterText: { fontSize: 13, fontWeight: '700' },
  optionText: { fontSize: 15, flex: 1, lineHeight: 21 },
  hintText: { color: '#FF9F0A', fontSize: 13, textAlign: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  completionTop: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  scoreLabel: { fontSize: 40, fontWeight: '700', marginBottom: 10 },
  scoreMessage: { fontSize: 17, textAlign: 'center', lineHeight: 24 },
  viewResultsBtn: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1 },
  viewResultsBtnText: { fontSize: 16, fontWeight: '600' },
  nextQuizBtn: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  nextQuizLabel: { fontSize: 14, fontWeight: '600' },
  nextQuizSub: { fontSize: 12, marginTop: 2 },
  aiMsg: { padding: 16, paddingBottom: 20 },
  aiMsgText: { fontSize: 14, lineHeight: 21 },
  harderLink: { color: '#5AC8FA', textDecorationLine: 'underline', fontWeight: '600' },
  historySection: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  historySectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  historyLeft: { flex: 1, marginRight: 10 },
  historyTopic: { fontSize: 14, fontWeight: '500' },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  diffBadge: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  diffBadgeText: { fontSize: 11, fontWeight: '600' },
  historyDate: { fontSize: 12 },
  historyScore: { minWidth: 44, alignItems: 'flex-end' },
  historyScoreText: { fontSize: 16, fontWeight: '700' },
});
