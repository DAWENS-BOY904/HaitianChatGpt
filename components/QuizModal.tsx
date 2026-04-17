import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SW } = Dimensions.get('window');

export interface QuizQuestion {
  options: string[];
  answer: number; // index of correct option (0-A, 1-B, 2-C, 3-D)
  explanation?: string;
}

interface QuizAnswer {
  questionIndex: number;
  chosenIndex: number;
  correct: boolean;
}

interface QuizModalProps {
  visible: boolean;
  questions: QuizQuestion[];
  onClose: () => void;
  onViewResults: (answers: QuizAnswer[], questions: QuizQuestion[]) => void;
  onTryAnother: () => void;
  onHarderQuiz: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const BG_GRADIENT_UNUSED = ['#2C1B4E', '#1A3050', '#0D1F3C'];

export function QuizModal({ visible, questions, onClose, onViewResults, onTryAnother, onHarderQuiz }: QuizModalProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const q = questions[currentQ] || null;
  const total = questions.length;

  useEffect(() => {
    if (visible) {
      setCurrentQ(0);
      setAnswers([]);
      setSelectedOption(null);
      setWrongAttempts(0);
      setShowFeedback(null);
      setFinished(false);
      setScore(0);
      fadeAnim.setValue(1);
    }
  }, [visible, questions]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const nextQuestion = (ans: QuizAnswer) => {
    const newAnswers = [...answers, ans];
    setAnswers(newAnswers);
    const newScore = ans.correct ? score + 1 : score;
    if (ans.correct) setScore(newScore);

    // brief delay before moving
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
    }, 700);
  };

  const handleOptionSelect = (optionIdx: number) => {
    if (selectedOption !== null && showFeedback === 'correct') return; // already answered correctly
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
        // 2 chances used — move on
        setTimeout(() => {
          nextQuestion({ questionIndex: currentQ, chosenIndex: optionIdx, correct: false });
        }, 800);
      } else {
        // 1 chance left — reset selection
        setTimeout(() => {
          setSelectedOption(null);
          setShowFeedback(null);
        }, 700);
      }
    }
  };

  const getScoreMessage = () => {
    const pct = score / total;
    if (pct === 1) return "Perfect score! 🎉";
    if (pct >= 0.8) return "Great job! You're getting there.";
    if (pct >= 0.6) return "Good job! You're getting there.";
    if (pct >= 0.4) return "Keep practicing!";
    return "Room to improve!";
  };

  const getOptionStyle = (idx: number) => {
    if (showFeedback === 'correct' && selectedOption === idx) {
      return [optStyles.option, optStyles.optionCorrect];
    }
    if (showFeedback === 'wrong' && selectedOption === idx) {
      return [optStyles.option, optStyles.optionWrong];
    }
    return [optStyles.option];
  };

  const getLetterStyle = (idx: number) => {
    if (showFeedback === 'correct' && selectedOption === idx) {
      return [optStyles.letter, optStyles.letterCorrect];
    }
    if (showFeedback === 'wrong' && selectedOption === idx) {
      return [optStyles.letter, optStyles.letterWrong];
    }
    return [optStyles.letter];
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.refreshBtn}>
            <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Quizzes</Text>
          <View style={s.thumbsRow}>
            <TouchableOpacity style={s.thumbBtn}><Ionicons name="thumbs-up-outline" size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
            <TouchableOpacity style={s.thumbBtn}><Ionicons name="thumbs-down-outline" size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
          </View>
        </View>

        {/* Quiz Card */}
        <View style={s.cardArea}>
          {!finished ? (
            <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateX: shakeAnim }] }]}>
              {/* Progress */}
              <Text style={s.progress}>{currentQ + 1} / {total}</Text>

              {/* Question */}
              <View style={s.questionBox}>
                <Text style={s.questionText}>{q?.question}</Text>
              </View>

              {/* Options */}
              <View style={s.optionsWrap}>
                {q?.options.map((opt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={getOptionStyle(idx)}
                    onPress={() => handleOptionSelect(idx)}
                    activeOpacity={0.75}
                    disabled={showFeedback === 'correct'}
                  >
                    <View style={getLetterStyle(idx)}>
                      {showFeedback === 'correct' && selectedOption === idx ? (
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      ) : showFeedback === 'wrong' && selectedOption === idx ? (
                        <Ionicons name="close" size={14} color="#FFF" />
                      ) : (
                        <Text style={optStyles.letterText}>{OPTION_LABELS[idx]}</Text>
                      )}
                    </View>
                    <Text style={optStyles.optionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          ) : (
            /* Completion Card */
            <View style={s.card}>
              <Text style={s.progress}>{score} / {total}</Text>
              <View style={[s.questionBox, { paddingVertical: 40 }]}>
                <Text style={[s.questionText, { fontSize: 22, textAlign: 'center', lineHeight: 32 }]}>{getScoreMessage()}</Text>
              </View>
              <TouchableOpacity style={s.resultBtn} onPress={() => onViewResults(answers, questions)}>
                <Text style={s.resultBtnText}>View results</Text>
              </TouchableOpacity>
              <View style={{ height: 10 }} />
              <TouchableOpacity style={s.resultBtnSecondary} onPress={onTryAnother}>
                <Text style={s.resultBtnSecText}>Next quiz</Text>
                <Text style={s.resultBtnSecSub}>Try another general knowledge quiz</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* AI message below card */}
        {!finished && (
          <View style={s.aiMsg}>
            <Text style={s.aiMsgText}>
              {"I've created a quiz for you 👆\nGo ahead and start answering the questions!\n\nIf you want a different type "}
              <Text style={s.harderLink} onPress={onHarderQuiz}>make a harder quiz</Text>
              {" or one focused on a topic you like."}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 16,
  },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '500' },
  thumbsRow: { flexDirection: 'row', gap: 10 },
  thumbBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cardArea: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: 'rgba(28,28,32,0.92)',
    borderRadius: 24,
    padding: 20,
    flex: 1,
    maxHeight: SW * 1.2,
  },
  progress: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  questionBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flex: 1,
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  optionsWrap: { gap: 2 },
  resultBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resultBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  resultBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  resultBtnSecText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  resultBtnSecSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  aiMsg: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  aiMsgText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 22 },
  harderLink: { color: '#4A9EFF', textDecorationLine: 'underline', fontWeight: '600' },
});

const optStyles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },
  optionCorrect: { backgroundColor: 'rgba(52,199,89,0.15)', borderRadius: 10, paddingHorizontal: 8 },
  optionWrong: { backgroundColor: 'rgba(255,69,58,0.15)', borderRadius: 10, paddingHorizontal: 8 },
  letter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterCorrect: { backgroundColor: '#34C759' },
  letterWrong: { backgroundColor: '#FF453A' },
  letterText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  optionText: { color: 'rgba(255,255,255,0.88)', fontSize: 15, flex: 1, lineHeight: 21 },
});
