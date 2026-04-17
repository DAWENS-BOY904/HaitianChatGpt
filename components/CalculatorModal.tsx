import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  initialExpression?: string;
  initialResult?: string;
}

export function CalculatorModal({
  visible,
  onClose,
  initialExpression = '',
  initialResult = '',
}: CalculatorModalProps) {
  const [expression, setExpression] = useState(initialExpression);
  const [result, setResult] = useState(initialResult);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      setExpression(initialExpression);
      setResult(initialResult);
      setJustEvaluated(false);
      translateY.value = withSpring(0, { damping: 26, stiffness: 280 });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 26, stiffness: 280 });
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handlePress = useCallback((key: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate(10);

    if (key === 'C') {
      setExpression('');
      setResult('');
      setJustEvaluated(false);
      return;
    }

    if (key === '⌫') {
      if (justEvaluated) {
        setExpression('');
        setResult('');
        setJustEvaluated(false);
      } else {
        setExpression((prev) => prev.slice(0, -1));
      }
      return;
    }

    if (key === '=') {
      try {
        const sanitized = expression
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/−/g, '-');
        // Safe eval
        const evaluated = Function('"use strict"; return (' + sanitized + ')')();
        const res = Number.isInteger(evaluated)
          ? String(evaluated)
          : parseFloat(evaluated.toFixed(10)).toString();
        setResult(res);
        setExpression(expression + ' = ' + res);
        setJustEvaluated(true);
      } catch {
        setResult('Error');
        setJustEvaluated(true);
      }
      return;
    }

    if (key === '%') {
      try {
        const sanitized = expression.replace(/×/g, '*').replace(/÷/g, '/');
        const evaluated = Function('"use strict"; return (' + sanitized + ')')() / 100;
        setResult(String(evaluated));
        setExpression(String(evaluated));
        setJustEvaluated(true);
      } catch {
        setResult('Error');
      }
      return;
    }

    if (key === '+/-') {
      if (expression) {
        setExpression((prev) => (prev.startsWith('-') ? prev.slice(1) : '-' + prev));
      }
      return;
    }

    if (justEvaluated && /[0-9.]/.test(key)) {
      setExpression(key);
      setResult('');
      setJustEvaluated(false);
      return;
    }

    if (justEvaluated) {
      setJustEvaluated(false);
      setExpression((prev) => {
        const lastResult = result || '';
        return lastResult + key;
      });
      setResult('');
      return;
    }

    setExpression((prev) => prev + key);

    // Live preview
    try {
      const sanitized = (expression + key).replace(/×/g, '*').replace(/÷/g, '/');
      if (/[+\-*/]$/.test(sanitized.trim())) {
        setResult('');
        return;
      }
      const val = Function('"use strict"; return (' + sanitized + ')')();
      if (!isNaN(val) && isFinite(val)) {
        setResult(String(parseFloat(val.toFixed(10))));
      }
    } catch {
      setResult('');
    }
  }, [expression, result, justEvaluated]);

  const BUTTONS = [
    ['⌫', 'C', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['+/-', '0', '.', '='],
  ];

  const displayExpr = justEvaluated
    ? (initialExpression || expression.split(' = ')[0])
    : expression;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* backdrop */}
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Handle */}
          <View style={styles.handleWrap}><View style={styles.handle} /></View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <Text style={styles.iconText}>▦</Text>
            </View>
            <View style={styles.displayArea}>
              <Text style={styles.exprText} numberOfLines={1} adjustsFontSizeToFit>
                {displayExpr || '0'}
              </Text>
              <Text style={[styles.resultText, { opacity: result ? 1 : 0 }]}>
                {result || '0'}
              </Text>
            </View>
          </View>

          {/* Separator */}
          <View style={styles.sep} />

          {/* Keypad */}
          <View style={styles.keypad}>
            {BUTTONS.map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map((key) => {
                  const isOp = ['÷', '×', '−', '+', '='].includes(key);
                  const isSpecial = ['⌫', 'C', '%', '+/-'].includes(key);
                  const isEquals = key === '=';
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.key,
                        isEquals && styles.keyEquals,
                        isOp && !isEquals && styles.keyOp,
                        isSpecial && styles.keySpecial,
                      ]}
                      onPress={() => handlePress(key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.keyText,
                          isEquals && styles.keyTextEquals,
                          isOp && !isEquals && styles.keyTextOp,
                        ]}
                      >
                        {key}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={{ height: Platform.OS === 'ios' ? 30 : 16 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Inline calculator card shown in chat ──
interface CalculatorCardProps {
  expression: string;
  result: string;
  onOpen: () => void;
}

export function CalculatorCard({ expression, result, onOpen }: CalculatorCardProps) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>▦</Text>
          <Text style={styles.cardTitle}>Instruments</Text>
        </View>
        <View style={styles.cardContent}>
          <TouchableOpacity onPress={onOpen} activeOpacity={0.8}>
            <View style={[styles.calcPreview]}>
              <Text style={styles.calcExpr}>{expression}</Text>
              <Text style={styles.calcResult}>{result}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Detects if a message contains math and returns the expression + result.
 */
export function detectMathExpression(text: string): { expression: string; result: string } | null {
  // Only show calculator card for short, explicit math messages (not long AI responses)
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 25) return null; // Skip for long prose/AI messages
  // Must look like a pure math expression, not just a number in a sentence
  if (!/^[\d\s+\-*/×÷−().%^]+$/.test(trimmed) && !/^[\d\s+\-*/×÷−().%^]+=/.test(trimmed)) {
    // Allow short lines that ARE math expressions embedded in text
    if (wordCount > 5) return null;
  }
  // Match patterns like "1+1", "32 + 32", "10 * 5 = 50" etc.
  const mathPattern = /(\d+[\s]*[+\-*/×÷−][\s]*\d+(?:[\s]*[+\-*/×÷−][\s]*\d+)*)/;
  const match = text.match(mathPattern);
  if (!match) return null;

  const expr = match[1].trim();
  try {
    const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
    const val = Function('"use strict"; return (' + sanitized + ')')();
    if (!isNaN(val) && isFinite(val)) {
      return { expression: expr, result: String(parseFloat(val.toFixed(10))) };
    }
  } catch {
    return null;
  }
  return null;
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
    paddingTop: 0,
  },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 24, color: '#FF9500' },
  displayArea: { flex: 1, alignItems: 'flex-end' },
  exprText: { fontSize: 22, color: 'rgba(255,255,255,0.7)', fontWeight: '400', marginBottom: 4 },
  resultText: { fontSize: 44, color: '#30D158', fontWeight: '300', letterSpacing: -1 },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 16 },
  keypad: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  key: {
    flex: 1,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyOp: { backgroundColor: '#3A3A3C' },
  keyEquals: { backgroundColor: '#30D158' },
  keySpecial: { backgroundColor: '#3A3A3C' },
  keyText: { fontSize: 22, fontWeight: '400', color: '#FFFFFF' },
  keyTextOp: { color: '#FFFFFF', fontWeight: '500' },
  keyTextEquals: { color: '#FFFFFF', fontWeight: '600' },
  // Card
  card: {
    marginVertical: 8,
    marginHorizontal: 8,
  },
  cardInner: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  cardIcon: { fontSize: 18, color: '#FF9500' },
  cardTitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  cardContent: { padding: 16 },
  calcPreview: { alignItems: 'flex-end' },
  calcExpr: { fontSize: 18, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  calcResult: { fontSize: 52, color: '#30D158', fontWeight: '300', letterSpacing: -1 },
});
