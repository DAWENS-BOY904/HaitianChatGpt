import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Vibration,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { BlurView } from 'expo-blur'; // ← Added for blur effect

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalculatorCardProps {
  expression: string;
  result: string;
  onOpen?: () => void;
}

// ── Safe math evaluator (unchanged) ───────────────────────────────────────────
function safeEval(expr: string): number {
  const sanitized = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s/g, '');

  if (!/^[\d+\-*/.()]+$/.test(sanitized)) {
    throw new Error('Invalid characters');
  }

  if (/[+\-*/]{2,}/.test(sanitized) || /^[*/]/.test(sanitized) || /[+\-*/]$/.test(sanitized)) {
    throw new Error('Malformed expression');
  }

  return Function('"use strict"; return (' + sanitized + ')')();
}

// ── Theme-aware colors ────────────────────────────────────────────────────────
function useCalculatorColors(isDark: boolean) {
  return {
    accentGreen: '#30D158',
    cardBg: isDark ? 'rgba(26,26,26,0.85)' : 'rgba(255,255,255,0.85)',
    keypadBg: isDark ? 'rgba(17,17,17,0.85)' : 'rgba(242,242,247,0.85)',
    keyBg: isDark ? 'rgba(44,44,46,0.9)' : 'rgba(255,255,255,0.9)',
    keyOpBg: isDark ? 'rgba(58,58,60,0.9)' : 'rgba(232,232,232,0.9)',
    keySpecialBg: isDark ? 'rgba(56,56,56,0.9)' : 'rgba(222,222,222,0.9)',
    keyText: isDark ? '#FFFFFF' : '#1A1A1A',
    headerText: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
    exprText: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    iconBorder: isDark ? 'rgba(48,209,88,0.35)' : 'rgba(48,209,88,0.25)',
    iconBg: isDark ? 'rgba(48,209,88,0.15)' : 'rgba(48,209,88,0.1)',
  };
}

// ── Inline calculator card with Blur Card ─────────────────────────────────────
export const CalculatorCard = memo(function CalculatorCard({
  expression,
  result,
  onOpen,
}: CalculatorCardProps) {
  const { isDark } = useTheme();
  const colors = useCalculatorColors(isDark);

  const [expanded, setExpanded] = useState(false);
  const [calcExpr, setCalcExpr] = useState(expression);
  const [calcResult, setCalcResult] = useState(result);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const handleCalcPress = useCallback((key: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate(8);
    if (key === 'C') {
      setCalcExpr('');
      setCalcResult('');
      setJustEvaluated(false);
      return;
    }
    if (key === 'f') {
      setExpanded(e => !e);
      return;
    }
    if (key === '=') {
      try {
        const val = safeEval(calcExpr);
        if (!Number.isNaN(val) && Number.isFinite(val)) {
          setCalcResult(String(parseFloat(val.toFixed(10))));
          setJustEvaluated(true);
        }
      } catch {
        setCalcResult('Error');
      }
      return;
    }
    if (justEvaluated && /\d/.test(key)) {
      setCalcExpr(key);
      setCalcResult('');
      setJustEvaluated(false);
      return;
    }
    setJustEvaluated(false);
    setCalcExpr(prev => prev + key);
  }, [calcExpr, calcResult, justEvaluated]);

  const ROWS: string[][] = [
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

      {/* Blur Card Header */}
      <BlurView
        intensity={isDark ? 85 : 90}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.headerCard,
          { borderColor: colors.borderColor },
        ]}
      >
        {/* Top row: icon + title */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.calcIconBox,
              {
                backgroundColor: colors.iconBg,
                borderColor: colors.iconBorder,
              },
            ]}
          >
            <Ionicons name="calculator" size={18} color={colors.accentGreen} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            Dawinix Instruments
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
            style={styles.chevron}
          />
        </View>

        {/* Expression + Result */}
        <View style={styles.displayArea}>
          <Text
            style={[styles.exprText, { color: colors.exprText }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayExpr || expression}
          </Text>
          <Text style={[styles.resultText, { color: colors.accentGreen }]}>
            {displayResult}
          </Text>
        </View>
      </BlurView>

      {/* Expandable Blur Keypad */}
      {expanded && (
        <BlurView
          intensity={isDark ? 80 : 85}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.keypad,
            { borderColor: colors.borderColor },
          ]}
        >
          {ROWS.map((row, ri) => (
            <View key={`row-${ri}`} style={styles.row}>
              {row.map((key) => {
                const isEquals = key === '=';
                const isOp = ['÷', '×', '−', '+'].includes(key);
                const isSpecial = ['f', '(', ')', 'C'].includes(key);

                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.7}
                    onPress={() => handleCalcPress(key)}
                    style={[
                      styles.key,
                      {
                        backgroundColor: isEquals
                          ? colors.accentGreen
                          : isOp
                            ? colors.keyOpBg
                            : isSpecial
                              ? colors.keySpecialBg
                              : colors.keyBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        {
                          color: isEquals ? '#FFF' : colors.keyText,
                          fontWeight: isEquals ? '700' : '500',
                        },
                      ]}
                    >
                      {key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </BlurView>
      )}
    </Animated.View>
  );
});

// Rest of your file (detectMathExpression, CalculatorModal, styles) remains the same

// ── Legacy CalculatorModal (no-op) ────────────────────────────────────────────
export function CalculatorModal({
  visible: _visible,
  onClose: _onClose,
  initialExpression: _initialExpression,
  initialResult: _initialResult,
}: {
  visible: boolean;
  onClose: () => void;
  initialExpression?: string;
  initialResult?: string;
}) {
  return null;
}

// ── Math detection helper ─────────────────────────────────────────────────────
export function detectMathExpression(
  text: string
): { expression: string; result: string } | null {
  if (!text) return null;

  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 25) return null;

  const mathPattern = /(\d+[\s]*[+\-*/×÷−][\s]*\d+(?:[\s]*[+\-*/×÷−][\s]*\d+)*)/;
  const match = text.match(mathPattern);
  if (!match) return null;

  const expr = match[1].trim();
  try {
    const val = safeEval(expr);
    if (!Number.isNaN(val) && Number.isFinite(val)) {
      return {
        expression: expr,
        result: String(parseFloat(val.toFixed(10))),
      };
    }
  } catch {
    return null;
  }
  return null;
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  calcIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  displayArea: {
    alignItems: 'flex-end',
    paddingRight: 2,
  },
  exprText: {
    fontSize: 18,
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
    marginTop: -4,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  key: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  keyText: {
    fontSize: 20,
  },
});
