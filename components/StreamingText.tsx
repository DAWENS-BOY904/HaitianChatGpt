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
 * - Real typing effect (not instant)
 * - No flicker or lag
 * - ALWAYS streams (no instant display)
 */
export function StreamingText({ 
  text, 
  speed = 3, // INCREASED: 3 chars per frame = ~180 chars/sec (fast and smooth)
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

    // CRITICAL FIX: ALWAYS animate, even for short text
    // Remove instant display logic - user requested real typing effect

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
