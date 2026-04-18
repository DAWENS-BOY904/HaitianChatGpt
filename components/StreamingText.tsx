// StreamingText.tsx - Ultra-realistic streaming text with blinking cursor & smooth rendering
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Text, TextStyle, Animated, Easing } from 'react-native';

interface StreamingTextProps {
  text: string;
  speed?: number;           // characters per second
  variance?: number;        // human-like variance 0-1
  pausePunctuation?: number;// extra pause on punctuation ms
  onComplete?: () => void;
  onCharacterTyped?: (char: string, index: number) => void;
  onChunkRendered?: () => void; // called after each chunk so parent can scroll
  style?: TextStyle | TextStyle[];
  cursor?: boolean;
  cursorStyle?: TextStyle;
  startDelay?: number;
  chunkSize?: number;       // characters per render tick (word-by-word feel)
}

/**
 * Word-by-word streaming text with:
 * - Smooth blinking cursor (Animated API, no setState flicker)
 * - Human-like speed variance
 * - Smart punctuation pauses
 * - onChunkRendered callback for parent scroll-to-bottom
 */
export function StreamingText({
  text,
  speed = 60,
  variance = 0.25,
  pausePunctuation = 120,
  onComplete,
  onCharacterTyped,
  onChunkRendered,
  style,
  cursor = true,
  cursorStyle,
  startDelay = 0,
  chunkSize = 3,            // render 3 chars per tick → smooth word-by-word feel
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const currentIndex = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const cursorLoopRef = useRef<Animated.CompositeAnimation>();

  // ── Cursor blink (Animated loop, no re-renders) ──
  useEffect(() => {
    if (!cursor) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 480,
          easing: Easing.step0,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.step0,
          useNativeDriver: true,
        }),
      ])
    );

    cursorLoopRef.current = loop;
    loop.start();

    return () => loop.stop();
  }, [cursor, cursorOpacity]);

  // ── Delay helper ──
  const getNextDelay = useCallback(
    (char: string): number => {
      const base = 1000 / speed;
      const jitter = base * variance * (Math.random() * 2 - 1);
      let delay = base + jitter;

      if ('.!?'.includes(char)) delay += pausePunctuation * 1.8;
      else if (',;:'.includes(char)) delay += pausePunctuation;
      else if (char === '\n') delay += pausePunctuation * 1.2;
      else if (char === ' ') delay += pausePunctuation * 0.15;

      return Math.max(delay, 16);
    },
    [speed, variance, pausePunctuation]
  );

  // ── Main typing engine ──
  useEffect(() => {
    currentIndex.current = 0;
    setDisplayedText('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!text) return;

    const typeChunk = () => {
      if (currentIndex.current >= text.length) {
        onComplete?.();
        return;
      }

      // Render a small chunk at once for smoother visuals
      const end = Math.min(currentIndex.current + chunkSize, text.length);
      const chunk = text.substring(currentIndex.current, end);
      const lastChar = chunk[chunk.length - 1];

      setDisplayedText(text.substring(0, end));

      // Notify parent to scroll
      onChunkRendered?.();

      for (let i = currentIndex.current; i < end; i++) {
        onCharacterTyped?.(text[i], i);
      }

      currentIndex.current = end;

      if (end < text.length) {
        const delay = getNextDelay(lastChar);
        timeoutRef.current = setTimeout(typeChunk, delay);
      } else {
        onComplete?.();
      }
    };

    timeoutRef.current = setTimeout(typeChunk, startDelay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, startDelay, chunkSize, getNextDelay, onComplete, onCharacterTyped, onChunkRendered]);

  return (
    <Text style={style}>
      {displayedText}
      {cursor && (
        <Animated.Text
          style={[
            { opacity: cursorOpacity, color: 'inherit' },
            cursorStyle,
          ]}
        >
          {'|'}
        </Animated.Text>
      )}
    </Text>
  );
}

// ── Convenience hook ──
export function useStreamingText(options: {
  text: string;
  speed?: number;
  autoStart?: boolean;
} & Omit<StreamingTextProps, 'text'>) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  return {
    displayedText,
    isComplete,
    StreamingTextComponent: (overrideProps?: Partial<StreamingTextProps>) => (
      <StreamingText
        text={options.text}
        {...options}
        {...overrideProps}
        onComplete={() => {
          setIsComplete(true);
          options.onComplete?.();
        }}
      />
    ),
  };
}
dont fucking skip my message if read this make change all change better and real Add a subtle slide-up + fade-in entrance animation to each new message bubble in MessageItem so messages appear with a smooth spring animation instead of instantly popping in. Fix streaming text rendering in MessageItem to be smoother — reduce layout jitter during token-by-token updates, ensure the blinking cursor stays flush with the last character, and prevent the message bubble from resizing abruptly mid-stream.

