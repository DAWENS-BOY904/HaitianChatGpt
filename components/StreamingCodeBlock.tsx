// StreamingCodeBlock.tsx - Code block with real-time typing animation
import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAlert } from '@/template';
import { BorderRadius } from '../constants/theme';

interface StreamingCodeBlockProps {
  code: string;
  language?: string;
  streaming?: boolean;
  speed?: number; // lines per frame
}

/**
 * PRODUCTION-READY STREAMING CODE BLOCK
 * Displays code with syntax highlighting and real-time typing animation
 * 
 * Features:
 * - Line-by-line streaming animation
 * - Scrollable while streaming
 * - Dynamic syntax detection
 * - Copy functionality
 * - Production-quality syntax highlighting
 */
export const StreamingCodeBlock = memo(function StreamingCodeBlock({
  code,
  language = 'code',
  streaming = false,
  speed = 1, // 1 line per frame
}: StreamingCodeBlockProps) {
  const { showAlert } = useAlert();
  const [copied, setCopied] = useState(false);
  const [displayedCode, setDisplayedCode] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const currentLine = useRef(0);
  const frameRef = useRef<number>();

  // Auto-detect language from code content
  const detectedLanguage = language === 'code' ? detectLanguage(code) : language;

  useEffect(() => {
    if (!streaming || !code) {
      setDisplayedCode(code);
      return;
    }

    const lines = code.split('\n');
    currentLine.current = 0;
    setDisplayedCode('');

    const animate = () => {
      if (currentLine.current < lines.length) {
        const nextLine = currentLine.current + speed;
        const displayLines = lines.slice(0, Math.min(nextLine, lines.length));
        setDisplayedCode(displayLines.join('\n'));
        currentLine.current = nextLine;
        
        // Auto-scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 50);
        
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [code, streaming, speed]);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    showAlert('Copied', 'Code copied to clipboard');
    setTimeout(() => setCopied(false), 1200);
  };

  const tokens = highlightSyntax(displayedCode, detectedLanguage);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.languageTag}>
          <Ionicons name={getLanguageIcon(detectedLanguage)} size={14} color="#6A737D" />
          <Text style={styles.lang}>{detectedLanguage}</Text>
        </View>
        <TouchableOpacity onPress={onCopy} style={styles.copyBtn} activeOpacity={0.7}>
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={14}
            color={copied ? '#10A37F' : '#6A737D'}
          />
          <Text style={[styles.copyText, copied && styles.copied]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CODE - Scrollable */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={true}
        style={styles.scrollContainer}
        contentContainerStyle={styles.codeContent}
        nestedScrollEnabled
      >
        <Text style={styles.codeText}>
          {tokens.map((t, i) => (
            <Text key={i} style={{ color: t.color }}>
              {t.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
});

/* ---------------- LANGUAGE DETECTION ---------------- */

function detectLanguage(code: string): string {
  const lowerCode = code.toLowerCase().trim();
  
  // React/JSX/TSX
  if (lowerCode.includes('import react') || lowerCode.includes('<view') || lowerCode.includes('export default')) {
    if (lowerCode.includes(': react.fc') || lowerCode.includes('interface ')) return 'tsx';
    return 'jsx';
  }
  
  // TypeScript
  if (lowerCode.includes('interface ') || lowerCode.includes('type ') || lowerCode.includes(': string')) {
    return 'typescript';
  }
  
  // HTML
  if (lowerCode.includes('<!doctype') || lowerCode.includes('<html')) return 'html';
  
  // CSS
  if (lowerCode.includes('{') && (lowerCode.includes('color:') || lowerCode.includes('margin:'))) return 'css';
  
  // Python
  if (lowerCode.includes('def ') || lowerCode.includes('import ') || lowerCode.includes('print(')) return 'python';
  
  // Bash
  if (lowerCode.startsWith('#!') || lowerCode.includes('npm ') || lowerCode.includes('yarn ')) return 'bash';
  
  // JSON
  if (lowerCode.startsWith('{') && lowerCode.includes('":')) return 'json';
  
  // JavaScript
  if (lowerCode.includes('const ') || lowerCode.includes('function ') || lowerCode.includes('=>')) return 'javascript';
  
  return 'code';
}

function getLanguageIcon(language: string): any {
  switch (language.toLowerCase()) {
    case 'tsx':
    case 'jsx':
    case 'typescript':
    case 'javascript':
      return 'logo-react';
    case 'python':
      return 'logo-python';
    case 'html':
      return 'logo-html5';
    case 'css':
      return 'logo-css3';
    case 'json':
      return 'document-text-outline';
    case 'bash':
      return 'terminal-outline';
    default:
      return 'code-slash-outline';
  }
}

/* ---------------- SYNTAX HIGHLIGHTING ---------------- */

function highlightSyntax(code: string, language: string) {
  const tokens: { text: string; color: string }[] = [];
  
  // Enhanced syntax highlighting for multiple languages
  if (language === 'tsx' || language === 'jsx' || language === 'typescript' || language === 'javascript') {
    const regex =
      /(\/\/.*?$|\/\*[\s\S]*?\*\/)|(import|export|const|let|var|function|class|interface|type|return|if|else|for|while|async|await|from|default)\b|(<\/?[A-Z][a-zA-Z0-9]*>?)|('[^']*'|"[^"]*"|`[^`]*`)|(\d+)/gm;
    
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(code)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ text: code.slice(lastIndex, match.index), color: '#24292e' });
      }
      
      if (match[1]) tokens.push({ text: match[1], color: '#6A737D' }); // comment
      else if (match[2]) tokens.push({ text: match[2], color: '#D73A49' }); // keyword
      else if (match[3]) tokens.push({ text: match[3], color: '#22863A' }); // JSX tag
      else if (match[4]) tokens.push({ text: match[4], color: '#032F62' }); // string
      else if (match[5]) tokens.push({ text: match[5], color: '#005CC5' }); // number
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < code.length) {
      tokens.push({ text: code.slice(lastIndex), color: '#24292e' });
    }
  } else if (language === 'html' || language === 'xml') {
    const regex =
      /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][^>\s]*)|([a-zA-Z-]+)(=)|("[^"]*"|'[^']*')/g;
    
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(code)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ text: code.slice(lastIndex, match.index), color: '#24292e' });
      }
      
      if (match[1]) tokens.push({ text: match[1], color: '#6A737D' }); // comment
      else if (match[2]) tokens.push({ text: match[2], color: '#D73A49' }); // tag
      else if (match[3]) tokens.push({ text: match[3], color: '#6F42C1' }); // attr
      else if (match[4]) tokens.push({ text: match[4], color: '#24292e' }); // =
      else if (match[5]) tokens.push({ text: match[5], color: '#032F62' }); // string
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < code.length) {
      tokens.push({ text: code.slice(lastIndex), color: '#24292e' });
    }
  } else if (language === 'python') {
    const regex =
      /(#.*?$)|(def|class|import|from|return|if|elif|else|for|while|try|except|with|as)\b|('[^']*'|"[^"]*")|(\d+)/gm;
    
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(code)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ text: code.slice(lastIndex, match.index), color: '#24292e' });
      }
      
      if (match[1]) tokens.push({ text: match[1], color: '#6A737D' }); // comment
      else if (match[2]) tokens.push({ text: match[2], color: '#D73A49' }); // keyword
      else if (match[3]) tokens.push({ text: match[3], color: '#032F62' }); // string
      else if (match[4]) tokens.push({ text: match[4], color: '#005CC5' }); // number
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < code.length) {
      tokens.push({ text: code.slice(lastIndex), color: '#24292e' });
    }
  } else {
    // Default: no highlighting
    tokens.push({ text: code, color: '#24292e' });
  }
  
  return tokens;
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E1E4E8',
    marginVertical: 0,
    overflow: 'hidden',
  },
  
  scrollContainer: {
    maxHeight: 400, // Allow scrolling for long code
    flexGrow: 0,
    flexShrink: 1,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F6F8FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
  },
  
  languageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  lang: {
    fontSize: 12,
    color: '#6A737D',
    fontWeight: '600',
  },
  
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  
  copyText: {
    fontSize: 12,
    color: '#6A737D',
    fontWeight: '500',
  },
  
  copied: {
    color: '#10A37F',
  },
  
  codeContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    flexGrow: 0,
  },
  
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
});
