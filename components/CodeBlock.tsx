import React, { useState, memo } from 'react';
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

interface CodeBlockProps {
  code: string;
  language?: string;
}

/* ---------------- SYNTAX HIGHLIGHT ---------------- */

function highlightSyntax(code: string, language: string) {
  const tokens: { text: string; color: string }[] = [];

  if (language === 'html' || language === 'xml') {
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
  } else {
    tokens.push({ text: code, color: '#24292e' });
  }

  return tokens;
}

/* ---------------- COMPONENT ---------------- */

export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'code',
}: CodeBlockProps) {
  const { showAlert } = useAlert();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    showAlert('Copied', 'Code copied to clipboard');
    setTimeout(() => setCopied(false), 1200);
  };

  const tokens = highlightSyntax(code, language);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.lang}>{language}</Text>
        <TouchableOpacity onPress={onCopy} style={styles.copyBtn}>
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

      {/* CODE */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.codeContent}
        style={styles.scrollContainer}
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
    flexGrow: 0,
    flexShrink: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F6F8FA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
  },

  lang: {
    fontSize: 12,
    color: '#6A737D',
    textTransform: 'lowercase',
  },

  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  copyText: {
    fontSize: 12,
    color: '#6A737D',
  },

  copied: {
    color: '#10A37F',
  },

  codeContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 0,
  },

  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
});
