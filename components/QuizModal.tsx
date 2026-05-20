// fix some error
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
  Easing as ReanimatedEasing,
  ZoomIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

const { width: SW, height: SH } = Dimensions.get('window');

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

// ── Confetti Particle ─────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE',
  '#58D68D', '#F1948A', '#85C1E9', '#F8C471', '#82E0AA',
];

function ConfettiParticle({ index, total }: { index: number; total: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const isRect = index % 3 !== 0;

  const startX = (SW / total) * index - SW / 2 + (Math.random() - 0.5) * 80;
  const endX = startX + (Math.random() - 0.5) * 200;
  const startY = -20;
  const endY = SH * 0.85;

  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(startY);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scaleVal = useSharedValue(0.6 + Math.random() * 0.8);

  useEffect(() => {
    const delay = index * 35;
    const duration = 1800 + Math.random() * 1000;

    translateY.value = withDelay(
      delay,
      withTiming(endY, { duration, easing: ReanimatedEasing.in(ReanimatedEasing.quad) })
    );
    translateX.value = withDelay(
      delay,
      withTiming(endX, { duration: duration * 1.1 })
    );
    rotate.value = withDelay(
      delay,
      withTiming(360 * (Math.random() > 0.5 ? 3 : -3), { duration })
    );
    opacity.value = withDelay(
      delay + duration * 0.6,
      withTiming(0, { duration: duration * 0.4 })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scaleVal.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          width: isRect ? 10 : 8,
          height: isRect ? 6 : 8,
          borderRadius: isRect ? 1 : 4,
          backgroundColor: color,
          left: SW / 2,
          top: 0,
        },
      ]}
    />
  );
}

// ── Confetti Overlay ──────────────────────────────────────────────────────────
function ConfettiOverlay({ visible }: { visible: boolean }) {
  const PARTICLE_COUNT = 60;
  if (!visible) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <ConfettiParticle key={i} index={i} total={PARTICLE_COUNT} />
      ))}
    </View>
  );
}

// ── Gold Trophy Card (Perfect Score) ─────────────────────────────────────────
function ChampionCard({ score, total, isDark, textC, subC, onViewResults, onNextQuiz, onTryAnother, loadingNext, quizHistory, getDifficultyColor, formatDate, historyBg, historyBorder, historyTopicC, historyDateC }: {
  score: number; total: number; isDark: boolean; textC: string; subC: string;
  onViewResults: () => void; onNextQuiz?: () => Promise<void>; onTryAnother: () => void;
  loadingNext: boolean; quizHistory?: QuizHistoryEntry[];
  getDifficultyColor: (d: string) => string; formatDate: (iso: string) => string;
  historyBg: string; historyBorder: string; historyTopicC: string; historyDateC: string;
}) {
  const scale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const trophyBounce = useSharedValue(0);
  const starsRotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 180 }));
    glowOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    trophyBounce.value = withDelay(
      600,
      withSequence(
        withSpring(-16, { damping: 8, stiffness: 200 }),
        withSpring(0, { damping: 8, stiffness: 200 }),
        withSpring(-8, { damping: 8, stiffness: 200 }),
        withSpring(0, { damping: 8, stiffness: 200 }),
      )
    );
    starsRotate.value = withDelay(500, withTiming(360, { duration: 1200 }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));
  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: trophyBounce.value }],
  }));
  const starsStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${starsRotate.value}deg` }],
  }));

  const goldGradientBg = isDark
    ? 'rgba(40, 32, 8, 0.98)'
    : 'rgba(255, 250, 220, 0.98)';

  return (
    <Animated.View style={[cardStyle, { marginHorizontal: 12, marginBottom: 12 }]}>
      {/* Gold glow background */}
      <Animated.View style={[glowStyle, {
        position: 'absolute', top: -20, left: -20, right: -20, bottom: -20,
        borderRadius: 30, backgroundColor: 'rgba(255, 215, 0, 0.15)',
        shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6, shadowRadius: 28, elevation: 12,
      }]} />

      <View style={{
        borderRadius: 22, overflow: 'hidden', borderWidth: 2,
        borderColor: '#FFD700',
        backgroundColor: goldGradientBg,
        shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
      }}>
        {/* Gold header stripe */}
        <View style={{
          backgroundColor: '#FFD700', paddingVertical: 10,
          alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
        }}>
          <Animated.View style={starsStyle}>
            <Text style={{ fontSize: 16 }}>✨</Text>
          </Animated.View>
          <Text style={{ color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 1.5 }}>
            CHAMPION!
          </Text>
          <Animated.View style={starsStyle}>
            <Text style={{ fontSize: 16 }}>✨</Text>
          </Animated.View>
        </View>

        <View style={{ alignItems: 'center', paddingTop: 28, paddingHorizontal: 20, paddingBottom: 16 }}>
          {/* Animated Trophy */}
          <Animated.View style={trophyStyle}>
            <View style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: 'rgba(255, 215, 0, 0.2)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 3, borderColor: 'rgba(255, 215, 0, 0.5)',
              marginBottom: 16,
              shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
            }}>
              <Text style={{ fontSize: 52 }}>🏆</Text>
            </View>
          </Animated.View>

          {/* Score */}
          <Text style={{ fontSize: 52, fontWeight: '900', color: '#FFD700', letterSpacing: -1, marginBottom: 4 }}>
            {score}/{total}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: textC, marginBottom: 6 }}>
            Perfect Score!
          </Text>
          <Text style={{ fontSize: 14, color: subC, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            You answered every question correctly.{'\n'}Incredible performance! 🎉
          </Text>

          {/* Stars row */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 24 }}>
            {[0, 1, 2, 3, 4].map((_, i) => (
              <Animated.View
                key={i}
                entering={ZoomIn.delay(800 + i * 120).springify()}
              >
                <Text style={{ fontSize: 24 }}>⭐</Text>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#FFD700', borderRadius: 14, paddingVertical: 15,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
            onPress={onViewResults}
            activeOpacity={0.8}
          >
            <Ionicons name="trophy" size={18} color="#000" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>View Results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              borderRadius: 14, paddingVertical: 13, alignItems: 'center',
              borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
            disabled={loadingNext}
            onPress={async () => {
              if (onNextQuiz) { try { await onNextQuiz(); } catch {} }
              else { onTryAnother(); }
            }}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: textC }}>
              {loadingNext ? 'Generating…' : 'Try Another Quiz'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* History */}
        {quizHistory && quizHistory.length > 0 && (
          <View style={[s.historySection, { backgroundColor: historyBg, borderColor: historyBorder, marginHorizontal: 16, marginBottom: 16 }]}>
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
                <Text style={[s.historyScoreText, { color: entry.score / entry.total >= 0.7 ? '#34C759' : entry.score / entry.total >= 0.4 ? '#FF9F0A' : '#FF453A' }]}>
                  {entry.score}/{entry.total}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Main QuizView ─────────────────────────────────────────────────────────────
export function QuizView({ questions, onClose, onViewResults, onTryAnother, onHarderQuiz, quizHistory, onComplete, preGeneratedQuestions, onNextQuiz }: QuizViewProps) {
  const { colors, isDark } = useTheme();

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [perfectScore, setPerfectScore] = useState(false);
  const [showHarderPrompt, setShowHarderPrompt] = useState(false);

  // Reanimated values
  const cardOpacity = useSharedValue(1);
  const cardTranslateX = useSharedValue(0);

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
    setShowConfetti(false);
    setPerfectScore(false);
    cardOpacity.value = 1;
    cardTranslateX.value = 0;
  }, [questions]);

  const shake = () => {
    cardTranslateX.value = withSequence(
      withTiming(12, { duration: 60 }),
      withTiming(-12, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  };

  const nextQuestion = (ans: QuizAnswer) => {
    const newAnswers = [...answers, ans];
    setAnswers(newAnswers);
    const newScore = ans.correct ? score + 1 : score;
    if (ans.correct) setScore(s => s + 1);

    setTimeout(() => {
      const nextIdx = currentQ + 1;
      if (nextIdx >= total) {
        const finalScore = newScore;
        const isPerfect = finalScore === total;
        const pct = finalScore / total;
        setShowHarderPrompt(!isPerfect && pct >= 0.8);
        setPerfectScore(isPerfect);
        setFinished(true);
        onComplete?.();
        if (isPerfect) {
          setTimeout(() => setShowConfetti(true), 300);
          setTimeout(() => setShowConfetti(false), 3500);
        }
      } else {
        cardOpacity.value = withTiming(0, { duration: 180 }, () => {
          runOnJS(setCurrentQ)(nextIdx);
          runOnJS(setSelectedOption)(null);
          runOnJS(setWrongAttempts)(0);
          runOnJS(setShowFeedback)(null);
          cardOpacity.value = withTiming(1, { duration: 220 });
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

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateX: cardTranslateX.value }],
  }));

  return (
    <View style={[s.wrapper, { backgroundColor: wrapBg }]}>
      {/* Confetti overlay */}
      <ConfettiOverlay visible={showConfetti} />

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
        <Animated.View style={[s.card, cardAnimStyle, { backgroundColor: cardBg, borderColor: cardBorder }]}>
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
      ) : perfectScore ? (
        // ── Perfect Score: Gold Trophy Card ──
        <ChampionCard
          score={score}
          total={total}
          isDark={isDark}
          textC={textC}
          subC={subC}
          onViewResults={() => onViewResults(answers, questions)}
          onNextQuiz={onNextQuiz}
          onTryAnother={onTryAnother}
          loadingNext={loadingNext}
          quizHistory={quizHistory}
          getDifficultyColor={getDifficultyColor}
          formatDate={formatDate}
          historyBg={historyBg}
          historyBorder={historyBorder}
          historyTopicC={historyTopicC}
          historyDateC={historyDateC}
        />
      ) : (
        // ── Normal completion card ──
        <View style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={s.completionTop}>
            <Text style={[s.scoreLabel, { color: textC }]}>{score} / {total}</Text>
            <Text style={[s.scoreMessage, { color: subC }]}>{getScoreMessage()}</Text>
          </View>

          {/* Auto-detect 80%+ — prompt harder quiz */}
          {showHarderPrompt && (
            <Animated.View entering={ZoomIn.springify()} style={[s.harderPromptBox, { backgroundColor: isDark ? 'rgba(255,159,10,0.12)' : 'rgba(255,159,10,0.1)', borderColor: 'rgba(255,159,10,0.4)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
                <Text style={{ color: '#FF9F0A', fontSize: 15, fontWeight: '700' }}>Great score! Ready for harder?</Text>
              </View>
              <Text style={{ color: subC, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>You scored 80%+. Jump to the next difficulty level instantly.</Text>
              <TouchableOpacity
                style={[s.harderPromptBtn, loadingNext && { opacity: 0.6 }]}
                disabled={loadingNext}
                onPress={async () => {
                  setShowHarderPrompt(false);
                  if (onNextQuiz) { setLoadingNext(true); try { await onNextQuiz(); } finally { setLoadingNext(false); } }
                  else { onHarderQuiz(); }
                }}
                activeOpacity={0.82}
              >
                <Ionicons name="trending-up" size={16} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>{loadingNext ? 'Generating…' : 'Try Harder Quiz →'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <TouchableOpacity style={[s.viewResultsBtn, { backgroundColor: viewResultsBg, borderColor: viewResultsBorder }]} onPress={() => onViewResults(answers, questions)}>
            <Text style={[s.viewResultsBtnText, { color: textC }]}>View results</Text>
          </TouchableOpacity>

          {!showHarderPrompt && (
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
          )}

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
  harderPromptBox: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 16, borderWidth: 1.5 },
  harderPromptBtn: { backgroundColor: '#FF9F0A', borderRadius: 50, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
