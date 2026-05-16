
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Vibration,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

// ── Inline calculator card shown in chat (ChatGPT Instruments style) ──────────
interface CalculatorCardProps {
  expression: string;
  result: string;
  onOpen?: () => void;
}

export function CalculatorCard({ expression, result }: CalculatorCardProps) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [calcExpr, setCalcExpr] = useState(expression);
  const [calcResult, setCalcResultState] = useState(result);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const accentGreen = '#30D158';
  const cardBg = isDark ? '#1A1A1A' : '#1C1C1E';
  const keypadBg = isDark ? '#111' : '#F2F2F7';
  const keyBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const keyOpBg = isDark ? '#3A3A3C' : '#E8E8E8';
  const keySpecialBg = isDark ? '#383838' : '#DEDEDE';
  const keyText = isDark ? '#FFFFFF' : '#1A1A1A';

  const handleCalcPress = useCallback((key: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate(8);

    if (key === 'C') {
      setCalcExpr('');
      setCalcResultState('');
      setJustEvaluated(false);
      return;
    }
    if (key === '=') {
      try {
        const sanitized = calcExpr
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/−/g, '-');
        // The original error "Unused eslint-disable directive" means the rule `no-new-func`
        // was not triggered by the `Function` constructor in this specific context by ESLint,
        // so the `eslint-disable` comment can be removed without introducing new issues.
        const val = Function('"use strict"; return (' + sanitized + ')')();
        const res = Number.isInteger(val) ? String(val) : parseFloat(val.toFixed(10)).toString();
        setCalcResultState(res);
        setCalcExpr(calcExpr + ' = ' + res);
        setJustEvaluated(true);
      } catch {
        setCalcResultState('Error');
        setJustEvaluated(true);
      }
      return;
    }
    if (justEvaluated && /[0-9.]/.test(key)) {
      setCalcExpr(key);
      setCalcResultState('');
      setJustEvaluated(false);
      return;
    }
    if (justEvaluated) {
      setJustEvaluated(false);
      setCalcExpr(calcResult + key);
      setCalcResultState('');
      return;
    }
    setCalcExpr(prev => prev + key);
    // Live preview
    try {
      const sanitized = (calcExpr + key)
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');
      if (/[+\-*/]$/.test(sanitized.trim())) { setCalcResultState(''); return; }
      // The original error "Unused eslint-disable directive" means the rule `no-new-func`
      // was not triggered by the `Function` constructor in this specific context by ESLint,
      // so the `eslint-disable` comment can be removed without introducing new issues.
      const val = Function('"use strict"; return (' + sanitized + ')')();
      if (!isNaN(val) && isFinite(val)) setCalcResultState(String(parseFloat(val.toFixed(10))));
    } catch {
      setCalcResultState('');
    }
  }, [calcExpr, calcResult, justEvaluated]);

  const ROWS = [
    ['f', '(', ')', 'C'],
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '−'],
    ['0', '.', '=', '+'],
  ];

  const displayExpr = justEvaluated ? expression : calcExpr;
  const displayResult = calcResult || result;

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.wrapper}>
      {/* Label */}
      <Text style={styles.instantLabel}>Instant answer ›</Text>

      {/* Dark header card */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => setExpanded(v => !v)}
        style={[styles.headerCard, { backgroundColor: cardBg }]}
      >
        {/* Top row: icon + title */}
        <View style={styles.headerRow}>
          <View style={[styles.calcIconBox, { borderColor: accentGreen + '55' }]}>
            <Ionicons name="calculator" size={18} color={accentGreen} />
          </View>
          <Text style={styles.headerTitle}>Dawinix Instruments</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="rgba(255,255,255,0.4)"
            style={{ marginLeft: 'auto' }}
          />
        </View>
        {/* Expression + Result */}
        <View style={styles.displayArea}>
          <Text style={styles.exprText} numberOfLines={1} adjustsFontSizeToFit>
            {displayExpr || expression}
          </Text>
          <Text style={[styles.resultText, { color: accentGreen }]}>
            {displayResult}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Expandable keypad */}
      {expanded ? (
        <View style={[styles.keypad, { backgroundColor: keypadBg }]}>
          {ROWS.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map(key => {
                const isEquals = key === '=';
                const isOp = ['÷', '×', '−', '+'].includes(key);
                const isSpecial = ['f', '(', ')', 'C'].includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.key,
                      { backgroundColor: isEquals ? accentGreen : isOp ? keyOpBg : isSpecial ? keySpecialBg : keyBg },
                      // Shadow for light mode keys
                      Platform.OS === 'ios' && !isEquals && !isDark && {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                      },
                    ]}
                    onPress={() => handleCalcPress(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.keyText,
                      { color: isEquals ? '#FFF' : keyText },
                      isEquals && { fontWeight: '700' },
                    ]}>
                      {key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

// ── Legacy CalculatorModal (kept but not used) — replaced by inline card ──────
export function CalculatorModal({ visible, onClose, initialExpression = '', initialResult = '' }: {
  visible: boolean;
  onClose: () => void;
  initialExpression?: string;
  initialResult?: string;
}) {
  // No-op: modal replaced by CalculatorCard inline
  return null;
}

/**
 * Detects if a message contains math and returns the expression + result.
 */
export function detectMathExpression(text: string): { expression: string; result: string } | null {
  if (!text) return null;
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 25) return null;

  // Match patterns like "1+1", "32 + 32", "10 * 5" etc.
  const mathPattern = /(\d+[\s]*[+\-*/×÷−][\s]*\d+(?:[\s]*[+\-*/×÷−][\s]*\d+)*)/;
  const match = text.match(mathPattern);
  if (!match) return null;

  const expr = match[1].trim();
  try {
    const sanitized = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\s/g, '');
    // The original error "Unused eslint-disable directive" means the rule `no-new-func`
    // was not triggered by the `Function` constructor in this specific context by ESLint,
    // so the `eslint-disable` comment can be removed without introducing new issues.
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
  wrapper: {
    marginVertical: 6,
    marginHorizontal: 16,
  },
  instantLabel: {
    color: 'rgba(128,128,128,0.7)',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 8,
    marginLeft: 2,
  },
  headerCard: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  calcIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(48,209,88,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  displayArea: {
    alignItems: 'flex-end',
    paddingRight: 2,
  },
  exprText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
    marginBottom: 2,
  },
  resultText: {
    fontSize: 60,
    fontWeight: '300',
    letterSpacing: -2,
    lineHeight: 66,
  },
  keypad: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    padding: 10,
    gap: 8,
    marginTop: -4,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 20,
    fontWeight: '500',
  },
});
