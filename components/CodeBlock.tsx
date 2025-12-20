import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../hooks/useTheme';
import { useAlert } from '@/template';
import { Spacing, Typography, BorderRadius } from '../constants/theme';

interface CodeBlockProps {
  code: string;
  language?: string;
}

// Syntax highlighting for common tokens
function highlightSyntax(code: string, language: string) {
  const tokens: { text: string; color: string }[] = [];
  
  if (language === 'html' || language === 'xml') {
    // HTML/XML syntax highlighting
    const regex = /(<\/?[a-zA-Z][a-zA-Z0-9]*)|([a-zA-Z-]+)(=)|("[^"]*")|('[^']*')|(<!--[\s\S]*?-->)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(code)) !== null) {
      // Add plain text before match
      if (match.index > lastIndex) {
        tokens.push({ text: code.substring(lastIndex, match.index), color: '#24292e' });
      }
      
      if (match[1]) {
        // Tag name
        tokens.push({ text: match[1], color: '#D73A49' });
      } else if (match[2]) {
        // Attribute name
        tokens.push({ text: match[2], color: '#6F42C1' });
      } else if (match[3]) {
        // Equals sign
        tokens.push({ text: match[3], color: '#24292e' });
      } else if (match[4] || match[5]) {
        // String value
        tokens.push({ text: match[4] || match[5], color: '#032F62' });
      } else if (match[6]) {
        // Comment
        tokens.push({ text: match[6], color: '#6A737D' });
      }
      
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < code.length) {
      tokens.push({ text: code.substring(lastIndex), color: '#24292e' });
    }
  } else {
    // Default highlighting for other languages
    const keywords = /\b(function|const|let|var|if|else|return|import|export|class|async|await|for|while|switch|case)\b/g;
    const strings = /(["'`][^"'`]*["'`])/g;
    const comments = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
    
    let processedCode = code;
    const matches: { text: string; color: string; index: number }[] = [];
    
    // Find all matches
    let match;
    while ((match = keywords.exec(code)) !== null) {
      matches.push({ text: match[0], color: '#D73A49', index: match.index });
    }
    while ((match = strings.exec(code)) !== null) {
      matches.push({ text: match[0], color: '#032F62', index: match.index });
    }
    while ((match = comments.exec(code)) !== null) {
      matches.push({ text: match[0], color: '#6A737D', index: match.index });
    }
    
    // Sort by index
    matches.sort((a, b) => a.index - b.index);
    
    let lastIndex = 0;
    for (const m of matches) {
      if (m.index > lastIndex) {
        tokens.push({ text: code.substring(lastIndex, m.index), color: '#24292e' });
      }
      tokens.push({ text: m.text, color: m.color });
      lastIndex = m.index + m.text.length;
    }
    
    if (lastIndex < code.length) {
      tokens.push({ text: code.substring(lastIndex), color: '#24292e' });
    }
  }
  
  return tokens.length > 0 ? tokens : [{ text: code, color: '#24292e' }];
}

export function CodeBlock({ code, language = 'code' }: CodeBlockProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    showAlert('Copied!', 'Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedTokens = highlightSyntax(code, language);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#FFFFFF',
      borderRadius: BorderRadius.md,
      marginVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: '#E1E4E8',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: '#F6F8FA',
      borderBottomWidth: 1,
      borderBottomColor: '#E1E4E8',
    },
    language: {
      ...Typography.caption,
      color: '#586069',
      fontSize: 12,
      textTransform: 'lowercase',
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      backgroundColor: copied ? '#10A37F' : 'transparent',
    },
    copyButtonText: {
      ...Typography.caption,
      color: copied ? '#FFFFFF' : '#586069',
      fontSize: 12,
    },
    codeContainer: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    code: {
      ...Typography.body,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.language}>{language}</Text>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Ionicons 
            name={copied ? 'checkmark' : 'copy-outline'} 
            size={14} 
            color={copied ? '#FFFFFF' : '#586069'} 
          />
          <Text style={styles.copyButtonText}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal style={styles.codeContainer}>
        <Text style={styles.code}>
          {highlightedTokens.map((token, index) => (
            <Text key={index} style={{ color: token.color }}>
              {token.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}
