// StreamingText.tsx - Real-time typing animation component
import React, { useState, useEffect, useRef } from 'react';
import { Text, TextStyle } from 'react-native';

interface StreamingTextProps {
  text: string;
  speed?: number; // characters per frame
  onComplete?: () => void;
  style?: TextStyle | TextStyle[];
}

/**
 * PRODUCTION-READY STREAMING TEXT COMPONENT
 * Displays text character-by-character to simulate AI typing in real-time
 * 
 * Features:
 * - Smooth character-by-character animation
 * - Configurable speed
 * - Instant display for short text
 * - No flicker or lag
 */
export function StreamingText({ 
  text, 
  speed = 2, // 2 chars per frame = ~120 chars/sec (fast but visible)
  onComplete,
  style 
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const currentIndex = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    // Reset when text changes
    currentIndex.current = 0;
    setDisplayedText('');

    // Instant display for very short text (< 20 chars)
    if (text.length < 20) {
      setDisplayedText(text);
      onComplete?.();
      return;
    }

    const animate = () => {
      if (currentIndex.current < text.length) {
        const nextIndex = Math.min(currentIndex.current + speed, text.length);
        setDisplayedText(text.substring(0, nextIndex));
        currentIndex.current = nextIndex;
        frameRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [text, speed]);

  return <Text style={style}>{displayedText}</Text>;
}
MAKE THIS BETTER AND FIX HOME PAGE TOOL FOR MOBILE
