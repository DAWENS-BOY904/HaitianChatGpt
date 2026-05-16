import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../template';
import { getSupabaseClient } from '../template';

type Appearance = 'System' | 'Light' | 'Dark';

interface UserSettings {
  appLanguage: string;
  appearance: Appearance;
  accentColor: string;
  hapticFeedback: boolean;
  autoSpelling: boolean;
  mainLanguage: string;
  voiceSelection: string;
  backgroundConversations: boolean;
  autocomplete: boolean;
  trendingSearches: boolean;
  followupSuggestions: boolean;
  // Extended voice settings (stored in DB as voice_selection etc.)
  preferredAiModel: string;
}

interface SettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
}

const defaultSettings: UserSettings = {
  appLanguage: 'English',
  appearance: 'System',
  accentColor: '#10A37F',
  hapticFeedback: true,
  autoSpelling: true,
  mainLanguage: 'English',
  voiceSelection: 'pNInz6obpgDQGcFmaJgB', // Adam — default ElevenLabs voice
  backgroundConversations: false,
  autocomplete: true,
  trendingSearches: true,
  followupSuggestions: true,
  preferredAiModel: 'gemini',
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setSettings({
        appLanguage: data.app_language ?? defaultSettings.appLanguage,
        appearance: (data.appearance as Appearance) ?? defaultSettings.appearance,
        // Ensure accent_color is always loaded from DB — never fall back to a stale default
        accentColor: data.accent_color || defaultSettings.accentColor,
        hapticFeedback: data.haptic_feedback ?? defaultSettings.hapticFeedback,
        autoSpelling: data.auto_spelling ?? defaultSettings.autoSpelling,
        mainLanguage: data.main_language ?? defaultSettings.mainLanguage,
        voiceSelection: data.voice_selection || defaultSettings.voiceSelection,
        backgroundConversations: data.background_conversations ?? defaultSettings.backgroundConversations,
        autocomplete: data.autocomplete ?? defaultSettings.autocomplete,
        trendingSearches: data.trending_searches ?? defaultSettings.trendingSearches,
        followupSuggestions: data.followup_suggestions ?? defaultSettings.followupSuggestions,
        preferredAiModel: data.preferred_ai_model || defaultSettings.preferredAiModel,
      });
    }
    setLoading(false);
  };

  const updateSetting = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    // Optimistic UI update
    setSettings(prev => ({ ...prev, [key]: value }));

    if (!user) return;

    // Convert camelCase key to snake_case for DB column name
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

    // Upsert so the row is created if it doesn't exist yet
    await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, [dbKey]: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .catch((err: any) => console.log('[Settings] upsert error:', err?.message));
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}
