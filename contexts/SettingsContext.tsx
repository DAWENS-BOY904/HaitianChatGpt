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
  voiceSelection: 'Default',
  backgroundConversations: false,
  autocomplete: true,
  trendingSearches: true,
  followupSuggestions: true,
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
        appLanguage: data.app_language,
        appearance: data.appearance as Appearance,
        accentColor: data.accent_color,
        hapticFeedback: data.haptic_feedback,
        autoSpelling: data.auto_spelling,
        mainLanguage: data.main_language,
        voiceSelection: data.voice_selection,
        backgroundConversations: data.background_conversations,
        autocomplete: data.autocomplete,
        trendingSearches: data.trending_searches,
        followupSuggestions: data.followup_suggestions,
      });
    }
    setLoading(false);
  };

  const updateSetting = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    if (!user) return;

    setSettings(prev => ({ ...prev, [key]: value }));

    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    await supabase
      .from('user_settings')
      .update({ [dbKey]: value, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}
