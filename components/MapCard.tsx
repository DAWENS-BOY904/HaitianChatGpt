import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';

interface Props {
  location: string;
  lat?: number;
  lon?: number;
  isDark?: boolean;
}

const MapCard = memo(function MapCard({ location, lat, lon, isDark: isDarkProp }: Props) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = isDarkProp ?? themeIsDark;

  const [expanded, setExpanded] = useState(false);

  const bg = isDark ? '#1C1C1E' : '#F0F8FF';
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,122,255,0.15)';
  const accentBlue = '#5AC8FA';

  // Build OpenStreetMap URLs
  const mapQuery = lat !== undefined && lon !== undefined
    ? `${lat},${lon}`
    : encodeURIComponent(location);

  const osmUrl = lat !== undefined && lon !== undefined
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(location)}`;

  // Embed iframe URL for WebView
  const embedUrl = lat !== undefined && lon !== undefined
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.05},${lat - 0.05},${lon + 0.05},${lat + 0.05}&layer=mapnik&marker=${lat},${lon}`
    : `https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(location)}&layer=mapnik`;

  const openInMaps = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(`maps://maps.apple.com/?q=${encodeURIComponent(location)}`).catch(() => {
        Linking.openURL(osmUrl);
      });
    } else if (Platform.OS === 'android') {
      Linking.openURL(`geo:0,0?q=${encodeURIComponent(location)}`).catch(() => {
        Linking.openURL(osmUrl);
      });
    } else {
      Linking.openURL(osmUrl);
    }
  };

  return (
    <View style={[s.card, { backgroundColor: isDark ? '#1A2A3A' : '#EBF4FF', borderColor: border }]}>
      {/* Header row */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.iconWrap, { backgroundColor: accentBlue + '22' }]}>
            <Ionicons name="location" size={18} color={accentBlue} />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={[s.locationName, { color: textPrimary }]} numberOfLines={1}>{location}</Text>
            <Text style={[s.subLabel, { color: textSecondary }]}>OpenStreetMap</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setExpanded(e => !e)} style={[s.expandBtn, { borderColor: accentBlue + '44' }]}>
          <Ionicons name={expanded ? 'chevron-up' : 'map-outline'} size={16} color={accentBlue} />
          <Text style={{ color: accentBlue, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
            {expanded ? 'Hide' : 'Map'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map (embedded WebView when expanded) */}
      {expanded && Platform.OS !== 'web' && (
        <View style={s.mapContainer}>
          <WebView
            source={{ uri: embedUrl }}
            style={s.mapWebView}
            scrollEnabled
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actionsRow}>
        <TouchableOpacity style={[s.actionBtn, { borderColor: border }]} onPress={openInMaps}>
          <Ionicons name="navigate-outline" size={14} color={accentBlue} />
          <Text style={[s.actionText, { color: accentBlue }]}>Open in Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { borderColor: border }]} onPress={() => Linking.openURL(osmUrl)}>
          <Ionicons name="globe-outline" size={14} color={textSecondary} />
          <Text style={[s.actionText, { color: textSecondary }]}>View on OSM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  locationName: { fontSize: 15, fontWeight: '600', maxWidth: 200 },
  subLabel: { fontSize: 11, marginTop: 1 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  mapContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  mapWebView: { flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  actionText: { fontSize: 13, fontWeight: '500' },
});

export default MapCard;
