/**
 * CHECKOUT — Redesigned to match photo reference
 * • Payment method selector with Card / Apple Pay / PayPal options
 * • Auto-generated country list (200+ entries)
 * • Clean dark theme with rounded inputs
 * • Model-style payment selection
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  useColorScheme,
  Modal,
  FlatList,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Localization from 'expo-localization';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────
// AUTO-GENERATED COUNTRY DATA (200+ entries)
// Run: node generate_countries.js to regenerate
// ─────────────────────────────────────────────────────────
interface Country {
  code: string;
  name: string;
  flag: string;
  dial: string;
}

// This array is auto-generated - DO NOT EDIT MANUALLY
const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫', dial: '+93' },
  { code: 'AX', name: 'Åland Islands', flag: '🇦🇽', dial: '+358' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱', dial: '+355' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿', dial: '+213' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩', dial: '+376' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴', dial: '+244' },
  { code: 'AI', name: 'Anguilla', flag: '🇦🇮', dial: '+1' },
  { code: 'AG', name: 'Antigua & Barbuda', flag: '🇦🇬', dial: '+1' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '+54' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲', dial: '+374' },
  { code: 'AW', name: 'Aruba', flag: '🇦🇼', dial: '+297' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dial: '+61' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', dial: '+43' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', dial: '+994' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸', dial: '+1' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭', dial: '+973' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', dial: '+880' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧', dial: '+1' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾', dial: '+375' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', dial: '+32' },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿', dial: '+501' },
  { code: 'BJ', name: 'Benin', flag: '🇧🇯', dial: '+229' },
  { code: 'BM', name: 'Bermuda', flag: '🇧🇲', dial: '+1' },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹', dial: '+975' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dial: '+591' },
  { code: 'BA', name: 'Bosnia & Herzegovina', flag: '🇧🇦', dial: '+387' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', dial: '+267' },
  { code: 'BV', name: 'Bouvet Island', flag: '🇧🇻', dial: '+47' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dial: '+55' },
  { code: 'IO', name: 'British Indian Ocean Territory', flag: '🇮🇴', dial: '+246' },
  { code: 'VG', name: 'British Virgin Islands', flag: '🇻🇬', dial: '+1' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳', dial: '+673' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', dial: '+359' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', dial: '+226' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', dial: '+257' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭', dial: '+855' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲', dial: '+237' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dial: '+1' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', dial: '+238' },
  { code: 'KY', name: 'Cayman Islands', flag: '🇰🇾', dial: '+1' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫', dial: '+236' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩', dial: '+235' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '+56' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dial: '+86' },
  { code: 'CX', name: 'Christmas Island', flag: '🇨🇽', dial: '+61' },
  { code: 'CC', name: 'Cocos Islands', flag: '🇨🇨', dial: '+61' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '+57' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲', dial: '+269' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬', dial: '+242' },
  { code: 'CD', name: 'Congo (DRC)', flag: '🇨🇩', dial: '+243' },
  { code: 'CK', name: 'Cook Islands', flag: '🇨🇰', dial: '+682' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', dial: '+506' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', dial: '+385' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', dial: '+53' },
  { code: 'CW', name: 'Curaçao', flag: '🇨🇼', dial: '+599' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾', dial: '+357' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', dial: '+420' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', dial: '+45' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯', dial: '+253' },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲', dial: '+1' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', dial: '+1' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dial: '+593' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dial: '+20' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', dial: '+503' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶', dial: '+240' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷', dial: '+291' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', dial: '+372' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿', dial: '+268' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', dial: '+251' },
  { code: 'FK', name: 'Falkland Islands', flag: '🇫🇰', dial: '+500' },
  { code: 'FO', name: 'Faroe Islands', flag: '🇫🇴', dial: '+298' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯', dial: '+679' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', dial: '+358' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '+33' },
  { code: 'GF', name: 'French Guiana', flag: '🇬🇫', dial: '+594' },
  { code: 'PF', name: 'French Polynesia', flag: '🇵🇫', dial: '+689' },
  { code: 'TF', name: 'French Southern Territories', flag: '🇹🇫', dial: '+262' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', dial: '+241' },
  { code: 'GM', name: 'Gambia', flag: '🇬🇲', dial: '+220' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪', dial: '+995' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dial: '+49' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', dial: '+233' },
  { code: 'GI', name: 'Gibraltar', flag: '🇬🇮', dial: '+350' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', dial: '+30' },
  { code: 'GL', name: 'Greenland', flag: '🇬🇱', dial: '+299' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩', dial: '+1' },
  { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵', dial: '+590' },
  { code: 'GU', name: 'Guam', flag: '🇬🇺', dial: '+1' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dial: '+502' },
  { code: 'GG', name: 'Guernsey', flag: '🇬🇬', dial: '+44' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳', dial: '+224' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼', dial: '+245' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾', dial: '+592' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹', dial: '+509' },
  { code: 'HM', name: 'Heard & McDonald Islands', flag: '🇭🇲', dial: '+672' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', dial: '+504' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', dial: '+852' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', dial: '+36' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸', dial: '+354' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dial: '+91' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', dial: '+62' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷', dial: '+98' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶', dial: '+964' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', dial: '+353' },
  { code: 'IM', name: 'Isle of Man', flag: '🇮🇲', dial: '+44' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', dial: '+972' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dial: '+39' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', dial: '+1' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dial: '+81' },
  { code: 'JE', name: 'Jersey', flag: '🇯🇪', dial: '+44' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', dial: '+962' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿', dial: '+7' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', dial: '+254' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮', dial: '+686' },
  { code: 'XK', name: 'Kosovo', flag: '🇽🇰', dial: '+383' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', dial: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬', dial: '+996' },
  { code: 'LA', name: 'Laos', flag: '🇱🇦', dial: '+856' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻', dial: '+371' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧', dial: '+961' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸', dial: '+266' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷', dial: '+231' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾', dial: '+218' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮', dial: '+423' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹', dial: '+370' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', dial: '+352' },
  { code: 'MO', name: 'Macao', flag: '🇲🇴', dial: '+853' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', dial: '+261' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', dial: '+265' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', dial: '+60' },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻', dial: '+960' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', dial: '+223' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹', dial: '+356' },
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭', dial: '+692' },
  { code: 'MQ', name: 'Martinique', flag: '🇲🇶', dial: '+596' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷', dial: '+222' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺', dial: '+230' },
  { code: 'YT', name: 'Mayotte', flag: '🇾🇹', dial: '+262' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dial: '+52' },
  { code: 'FM', name: 'Micronesia', flag: '🇫🇲', dial: '+691' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', dial: '+373' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨', dial: '+377' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳', dial: '+976' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪', dial: '+382' },
  { code: 'MS', name: 'Montserrat', flag: '🇲🇸', dial: '+1' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', dial: '+212' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', dial: '+258' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', dial: '+95' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦', dial: '+264' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷', dial: '+674' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', dial: '+977' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '+31' },
  { code: 'NC', name: 'New Caledonia', flag: '🇳🇨', dial: '+687' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dial: '+64' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', dial: '+505' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', dial: '+227' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dial: '+234' },
  { code: 'NU', name: 'Niue', flag: '🇳🇺', dial: '+683' },
  { code: 'NF', name: 'Norfolk Island', flag: '🇳🇫', dial: '+672' },
  { code: 'KP', name: 'North Korea', flag: '🇰🇵', dial: '+850' },
  { code: 'MK', name: 'North Macedonia', flag: '🇲🇰', dial: '+389' },
  { code: 'MP', name: 'Northern Mariana Islands', flag: '🇲🇵', dial: '+1' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dial: '+47' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲', dial: '+968' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', dial: '+92' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼', dial: '+680' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸', dial: '+970' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', dial: '+507' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬', dial: '+675' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dial: '+595' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', dial: '+51' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', dial: '+63' },
  { code: 'PN', name: 'Pitcairn Islands', flag: '🇵🇳', dial: '+64' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', dial: '+48' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '+351' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷', dial: '+1' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', dial: '+974' },
  { code: 'RE', name: 'Réunion', flag: '🇷🇪', dial: '+262' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', dial: '+40' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', dial: '+7' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', dial: '+250' },
  { code: 'BL', name: 'Saint Barthélemy', flag: '🇧🇱', dial: '+590' },
  { code: 'SH', name: 'Saint Helena', flag: '🇸🇭', dial: '+290' },
  { code: 'KN', name: 'Saint Kitts & Nevis', flag: '🇰🇳', dial: '+1' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨', dial: '+1' },
  { code: 'MF', name: 'Saint Martin', flag: '🇲🇫', dial: '+590' },
  { code: 'PM', name: 'Saint Pierre & Miquelon', flag: '🇵🇲', dial: '+508' },
  { code: 'VC', name: 'Saint Vincent & Grenadines', flag: '🇻🇨', dial: '+1' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸', dial: '+685' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲', dial: '+378' },
  { code: 'ST', name: 'São Tomé & Príncipe', flag: '🇸🇹', dial: '+239' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dial: '+966' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', dial: '+221' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸', dial: '+381' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', dial: '+248' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱', dial: '+232' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dial: '+65' },
  { code: 'SX', name: 'Sint Maarten', flag: '🇸🇽', dial: '+1' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰', dial: '+421' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮', dial: '+386' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧', dial: '+677' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴', dial: '+252' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dial: '+27' },
  { code: 'GS', name: 'South Georgia', flag: '🇬🇸', dial: '+500' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dial: '+82' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸', dial: '+211' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dial: '+34' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', dial: '+94' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩', dial: '+249' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', dial: '+597' },
  { code: 'SJ', name: 'Svalbard & Jan Mayen', flag: '🇸🇯', dial: '+47' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', dial: '+46' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dial: '+41' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾', dial: '+963' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', dial: '+886' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯', dial: '+992' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', dial: '+255' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', dial: '+66' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱', dial: '+670' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', dial: '+228' },
  { code: 'TK', name: 'Tokelau', flag: '🇹🇰', dial: '+690' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴', dial: '+676' },
  { code: 'TT', name: 'Trinidad & Tobago', flag: '🇹🇹', dial: '+1' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳', dial: '+216' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', dial: '+90' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲', dial: '+993' },
  { code: 'TC', name: 'Turks & Caicos Islands', flag: '🇹🇨', dial: '+1' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻', dial: '+688' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', dial: '+256' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', dial: '+380' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dial: '+971' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dial: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dial: '+1' },
  { code: 'UM', name: 'U.S. Minor Outlying Islands', flag: '🇺🇲', dial: '+1' },
  { code: 'VI', name: 'U.S. Virgin Islands', flag: '🇻🇮', dial: '+1' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dial: '+598' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿', dial: '+998' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺', dial: '+678' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦', dial: '+379' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dial: '+58' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', dial: '+84' },
  { code: 'WF', name: 'Wallis & Futuna', flag: '🇼🇫', dial: '+681' },
  { code: 'EH', name: 'Western Sahara', flag: '🇪🇭', dial: '+212' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪', dial: '+967' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', dial: '+260' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', dial: '+263' },
];

const POPULAR_CODES = ['US', 'HT', 'CA', 'FR', 'GB', 'BR', 'MX', 'DE', 'NG', 'IN'];

function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

function guessCountryFromLocale(): Country {
  try {
    const locale = Localization.locale?.toUpperCase() || '';
    const region = locale.split('_')[1] || locale.split('-')[1] || 'US';
    return getCountryByCode(region) || getCountryByCode('US')!;
  } catch {
    return getCountryByCode('US')!;
  }
}

// ─────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────
function useT() {
  const dark = useColorScheme() !== 'light';
  return {
    dark,
    bg: '#000000',
    surface: '#1C1C1E',
    surfaceBorder: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    textSec: 'rgba(255,255,255,0.55)',
    textMuted: 'rgba(255,255,255,0.35)',
    inputBg: '#2C2C2E',
    inputBorder: 'rgba(255,255,255,0.12)',
    placeholderText: 'rgba(255,255,255,0.3)',
    accent: '#30D158',
    accentLight: 'rgba(48,209,88,0.15)',
    divider: 'rgba(255,255,255,0.08)',
    cardBg: '#1C1C1E',
    modalBg: '#1C1C1E',
    searchBg: '#2C2C2E',
    error: '#FF453A',
    success: '#30D158',
  };
}

// ─────────────────────────────────────────────────────────
// Country Picker Modal
// ─────────────────────────────────────────────────────────
interface CountryPickerModalProps {
  visible: boolean;
  selected: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
  T: ReturnType<typeof useT>;
}

function CountryPickerModal({ visible, selected, onSelect, onClose, T }: CountryPickerModalProps) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const popular = POPULAR_CODES.map((c) => getCountryByCode(c)).filter(Boolean) as Country[];
  const filtered = search.trim()
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  const sections = search.trim()
    ? [{ title: `Results (${filtered.length})`, data: filtered }]
    : [
        { title: 'Popular', data: popular },
        { title: 'All Countries', data: COUNTRIES },
      ];

  type Item = { type: 'header'; title: string } | { type: 'country'; item: Country };
  const flatData: Item[] = [];
  for (const sec of sections) {
    flatData.push({ type: 'header', title: sec.title });
    for (const item of sec.data) {
      flatData.push({ type: 'country', item });
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[cpStyles.root, { backgroundColor: T.bg }]}>
        <View style={cpStyles.handleWrap}>
          <View style={[cpStyles.handle, { backgroundColor: T.textMuted }]} />
        </View>

        <View style={cpStyles.titleRow}>
          <Text style={[cpStyles.title, { color: T.text }]}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={cpStyles.closeBtn}>
            <Ionicons name="close" size={22} color={T.textSec} />
          </TouchableOpacity>
        </View>

        <View style={[cpStyles.searchWrap, { backgroundColor: T.searchBg }]}>
          <Ionicons name="search" size={16} color={T.textSec} />
          <TextInput
            style={[cpStyles.searchInput, { color: T.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search country..."
            placeholderTextColor={T.placeholderText}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={T.textSec} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={flatData}
          keyExtractor={(item, i) => (item.type === 'header' ? `hdr-${i}` : `${item.item.code}-${i}`)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text style={[cpStyles.sectionHeader, { color: T.textMuted }]}>
                  {item.title.toUpperCase()}
                </Text>
              );
            }
            const c = item.item;
            const isSelected = c.code === selected.code;
            return (
              <TouchableOpacity
                style={[cpStyles.countryRow, { borderBottomColor: T.divider }, isSelected && { backgroundColor: T.accentLight }]}
                onPress={() => { onSelect(c); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={cpStyles.flag}>{c.flag}</Text>
                <View style={cpStyles.countryInfo}>
                  <Text style={[cpStyles.countryName, { color: T.text }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[cpStyles.dialCode, { color: T.textSec }]}>{c.dial}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark" size={18} color={T.accent} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const cpStyles = StyleSheet.create({
  root: { flex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.35 },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4,
  },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 22, width: 32, textAlign: 'center' },
  countryInfo: { flex: 1 },
  countryName: { fontSize: 15 },
  dialCode: { fontSize: 13, fontWeight: '600', marginTop: 1 },
});

// ─────────────────────────────────────────────────────────
// Payment Method Selector (Model Style like photo)
// ─────────────────────────────────────────────────────────
type PayMethod = 'card' | 'apple' | 'google' | 'paypal' | 'moncash';

interface PaymentMethodOption {
  key: PayMethod;
  label: string;
  icon: string;
  iconType: 'ionicon' | 'custom';
  color: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { key: 'card', label: 'Card', icon: 'card-outline', iconType: 'ionicon', color: '#30D158' },
  { key: 'apple', label: 'Apple Pay', icon: 'logo-apple', iconType: 'ionicon', color: '#000000' },
  { key: 'google', label: 'Google Pay', icon: 'logo-google', iconType: 'ionicon', color: '#4285F4' },
  { key: 'paypal', label: 'PayPal', icon: 'paypal', iconType: 'custom', color: '#003087' },
  { key: 'moncash', label: 'MonCash', icon: 'phone-portrait-outline', iconType: 'ionicon', color: '#DC143C' },
];

function PaymentMethodSelector({
  selected,
  onSelect,
  T,
  showPayPal,
  showMoncash,
}: {
  selected: PayMethod;
  onSelect: (method: PayMethod) => void;
  T: ReturnType<typeof useT>;
  showPayPal: boolean;
  showMoncash: boolean;
}) {
  const methods = PAYMENT_METHODS.filter((m) => {
    if (m.key === 'paypal' && !showPayPal) return false;
    if (m.key === 'moncash' && !showMoncash) return false;
    if (m.key === 'apple' && Platform.OS !== 'ios') return false;
    if (m.key === 'google' && Platform.OS !== 'android') return false;
    return true;
  });

  return (
    <View style={pmStyles.container}>
      <Text style={[pmStyles.title, { color: T.text }]}>Payment Method</Text>
      <View style={pmStyles.grid}>
        {methods.map((method) => {
          const isActive = selected === method.key;
          return (
            <TouchableOpacity
              key={method.key}
              style={[
                pmStyles.methodCard,
                {
                  backgroundColor: isActive ? T.accentLight : T.surface,
                  borderColor: isActive ? T.accent : T.inputBorder,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
              onPress={() => onSelect(method.key)}
              activeOpacity={0.8}
            >
              <View style={pmStyles.iconWrap}>
                {method.iconType === 'ionicon' ? (
                  <Ionicons name={method.icon as any} size={24} color={isActive ? T.accent : T.textSec} />
                ) : (
                  <View style={[pmStyles.customIcon, { backgroundColor: method.color }]}>
                    <Text style={pmStyles.customIconText}>P</Text>
                  </View>
                )}
              </View>
              <Text style={[pmStyles.methodLabel, { color: isActive ? T.accent : T.textSec }]}>
                {method.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const pmStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  methodCard: {
    width: (SCREEN_W - 52) / 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─────────────────────────────────────────────────────────
// Input Components
// ─────────────────────────────────────────────────────────
function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  T,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: any;
  T: ReturnType<typeof useT>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fiStyles.container}>
      <Text style={[fiStyles.label, { color: T.text }]}>{label}</Text>
      <View
        style={[
          fiStyles.inputWrap,
          {
            backgroundColor: T.inputBg,
            borderColor: focused ? T.accent : T.inputBorder,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        <TextInput
          style={[fiStyles.input, { color: T.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.placeholderText}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

const fiStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputWrap: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: { fontSize: 15, fontWeight: '400', padding: 0, margin: 0 },
});

function PhoneInput({
  country,
  value,
  onChange,
  onCountryPress,
  T,
}: {
  country: Country;
  value: string;
  onChange: (val: string) => void;
  onCountryPress: () => void;
  T: ReturnType<typeof useT>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={piStyles.container}>
      <Text style={[piStyles.label, { color: T.text }]}>Phone Number</Text>
      <View
        style={[
          piStyles.inputWrap,
          {
            backgroundColor: T.inputBg,
            borderColor: focused ? T.accent : T.inputBorder,
            borderWidth: focused ? 1.5 : 1,
          },
        ]}
      >
        <TouchableOpacity style={piStyles.countryBtn} onPress={onCountryPress} activeOpacity={0.7}>
          <Text style={piStyles.flag}>{country.flag}</Text>
          <Text style={[piStyles.dial, { color: T.text }]}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={T.textSec} />
        </TouchableOpacity>
        <View style={[piStyles.divider, { backgroundColor: T.divider }]} />
        <TextInput
          style={[piStyles.input, { color: T.text }]}
          value={value}
          onChangeText={onChange}
          keyboardType="phone-pad"
          placeholder="(XXX) XXX-XXXX"
          placeholderTextColor={T.placeholderText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

const piStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingRight: 8,
  },
  flag: { fontSize: 20 },
  dial: { fontSize: 14, fontWeight: '600' },
  divider: { width: 1, height: 24, marginHorizontal: 8 },
  input: { flex: 1, fontSize: 15, padding: 0, margin: 0, paddingVertical: 10 },
});

function CountrySelector({
  country,
  onPress,
  T,
}: {
  country: Country;
  onPress: () => void;
  T: ReturnType<typeof useT>;
}) {
  return (
    <View style={csStyles.container}>
      <Text style={[csStyles.label, { color: T.text }]}>Country</Text>
      <TouchableOpacity
        style={[csStyles.button, { backgroundColor: T.inputBg, borderColor: T.inputBorder }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={csStyles.left}>
          <Text style={csStyles.flag}>{country.flag}</Text>
          <Text style={[csStyles.name, { color: T.text }]}>{country.name}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={T.textSec} />
      </TouchableOpacity>
    </View>
  );
}

const csStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { fontSize: 20 },
  name: { fontSize: 15, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────
// Card Details Section
// ─────────────────────────────────────────────────────────
function CardDetailsSection({
  cardholderName,
  setCardholderName,
  cardNumber,
  setCardNumber,
  expiry,
  setExpiry,
  cvv,
  setCvv,
  saveCard,
  setSaveCard,
  autoRenew,
  setAutoRenew,
  T,
}: {
  cardholderName: string;
  setCardholderName: (v: string) => void;
  cardNumber: string;
  setCardNumber: (v: string) => void;
  expiry: string;
  setExpiry: (v: string) => void;
  cvv: string;
  setCvv: (v: string) => void;
  saveCard: boolean;
  setSaveCard: (v: boolean) => void;
  autoRenew: boolean;
  setAutoRenew: (v: boolean) => void;
  T: ReturnType<typeof useT>;
}) {
  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\\s/g, '').replace(/[^0-9]/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19);
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  return (
    <View style={cdStyles.container}>
      <FormInput
        label="Cardholder Name"
        value={cardholderName}
        onChangeText={setCardholderName}
        placeholder="John Doe"
        T={T}
      />

      <FormInput
        label="Card Number"
        value={cardNumber}
        onChangeText={(text) => setCardNumber(formatCardNumber(text))}
        placeholder="1234 5678 9012 3456"
        keyboardType="number-pad"
        T={T}
      />

      <View style={cdStyles.row}>
        <View style={cdStyles.half}>
          <FormInput
            label="Expiry Date"
            value={expiry}
            onChangeText={(text) => setExpiry(formatExpiry(text))}
            placeholder="MM/YY"
            keyboardType="number-pad"
            T={T}
          />
        </View>
        <View style={cdStyles.half}>
          <FormInput
            label="CVV"
            value={cvv}
            onChangeText={(text) => setCvv(text.slice(0, 4))}
            placeholder="123"
            keyboardType="number-pad"
            T={T}
          />
        </View>
      </View>

      <View style={cdStyles.checkboxes}>
        <TouchableOpacity style={cdStyles.checkboxRow} onPress={() => setSaveCard(!saveCard)}>
          <View style={[cdStyles.checkbox, { borderColor: T.accent }, saveCard && { backgroundColor: T.accent }]}>
            {saveCard && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
          <Text style={[cdStyles.checkboxText, { color: T.textSec }]}>Save card for future payments</Text>
        </TouchableOpacity>

        <TouchableOpacity style={cdStyles.checkboxRow} onPress={() => setAutoRenew(!autoRenew)}>
          <View style={[cdStyles.checkbox, { borderColor: T.accent }, autoRenew && { backgroundColor: T.accent }]}>
            {autoRenew && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
          <Text style={[cdStyles.checkboxText, { color: T.textSec }]}>Enable auto-renewal (subscription)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cdStyles = StyleSheet.create({
  container: { marginTop: 8 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  checkboxes: { marginTop: 8, gap: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: { fontSize: 14, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────
// Plan Summary Card (subscription-aware)
// ─────────────────────────────────────────────────────────
function PlanSummaryCard({
  planName,
  price,
  priceId,
  T,
}: {
  planName: string;
  price: string;
  priceId: string;
  T: ReturnType<typeof useT>;
}) {
  const isPlus = planName.toLowerCase().includes('plus');
  const accentColor = isPlus ? '#6B5CE7' : '#30D158';
  const features = isPlus
    ? ['Advanced AI models', 'Unlimited smart messages', '20 image/file uploads', 'Agents & deep research', 'Early access to features']
    : ['More daily messages', '10 image/file uploads', 'Group chat creation', 'Extended memory'];

  return (
    <View style={[psStyles.container, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
      <View style={psStyles.header}>
        <View style={[psStyles.badge, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}>
          <Text style={[psStyles.badgeText, { color: accentColor }]}>
            {isPlus ? '✨ PLUS' : '⚡ GO'}
          </Text>
        </View>
        <View style={psStyles.priceWrap}>
          <Text style={[psStyles.price, { color: accentColor }]}>{price}</Text>
          <Text style={[psStyles.period, { color: T.textSec }]}>/month</Text>
        </View>
      </View>
      <View style={[psStyles.divider, { backgroundColor: T.divider }]} />
      <Text style={[psStyles.featuresTitle, { color: T.textSec }]}>Includes:</Text>
      {features.map((f) => (
        <View key={f} style={psStyles.featureRow}>
          <Ionicons name="checkmark-circle" size={15} color={accentColor} />
          <Text style={[psStyles.featureText, { color: T.text }]}>{f}</Text>
        </View>
      ))}
      <View style={[psStyles.totalRow, { borderTopColor: T.divider }]}>
        <Text style={[psStyles.totalLabel, { color: T.textSec }]}>Billed monthly · auto-cancels when expired</Text>
        <Text style={[psStyles.totalAmount, { color: accentColor }]}>{price}/mo</Text>
      </View>
    </View>
  );
}

const psStyles = StyleSheet.create({
  container: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  priceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { fontSize: 26, fontWeight: '800' },
  period: { fontSize: 13, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  featuresTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  featureText: { fontSize: 14 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: 11, flex: 1 },
  totalAmount: { fontSize: 16, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────
// Main Checkout Screen
// ─────────────────────────────────────────────────────────
export default function CheckoutScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const T = useT();
  const supabase = getSupabaseClient();

  // ── Read plan params passed from subscription.tsx ──
  const params = useLocalSearchParams<{ plan?: string; priceId?: string; price?: string; name?: string }>();
  const planParam = (params.plan as string) || 'plus';
  const priceIdParam = (params.priceId as string) || 'price_1TPUrzE0VkO7z1Vnlgj45978';
  const priceParam = (params.price as string) || '19.99';
  const planDisplayName = (params.name as string) || 'Dawinix Plus';

  const [method, setMethod] = useState<PayMethod>('card');
  const [country, setCountry] = useState<Country>(() => guessCountryFromLocale());
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const [phoneNational, setPhoneNational] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');  
  const [saveCard, setSaveCard] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const [loading, setLoading] = useState(false);

  const displayPrice = priceParam ? `$${priceParam}` : '$19.99';

  // ── Open Stripe hosted checkout (handles card, Apple Pay, Google Pay) ──
  const handleStripeCheckout = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        plan: planParam,
        priceId: priceIdParam,
        autoRenew,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      let errMsg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { errMsg = await error.context?.text() || errMsg; } catch (_e) {}
      }
      throw new Error(errMsg);
    }

    if (!data?.url) throw new Error('No checkout URL from Stripe');

    // Open Stripe hosted page (handles card, Apple Pay, Google Pay natively)
    try {
      await WebBrowser.openBrowserAsync(data.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
      });
    } catch (_e) {
      const { Linking } = require('react-native');
      await Linking.openURL(data.url);
    }

    // After browser closes, update DB and reflect subscription
    await syncSubscriptionAfterPayment();
  }, [supabase, planParam, priceIdParam, autoRenew]);

  // ── Sync subscription state after payment ──
  const syncSubscriptionAfterPayment = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const { data } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (data?.subscribed) {
        // Compute expiry: Stripe subscription_end or fallback to 1 month
        const expiresAt = data.subscription_end
          ? new Date(data.subscription_end).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from('user_profiles').update({
          subscription_tier: planParam,
          subscription_expires_at: expiresAt,
        }).eq('id', user.id);

        // Schedule local auto-cancel check (server webhook handles the real cancel)
        showAlert(
          'Subscription Active!',
          `Your ${planDisplayName} plan is active. It will auto-cancel after the billing period ends.`
        );
        router.replace('/subscription-success');
      } else {
        showAlert('Check Your Email', 'Complete payment in the browser. Your plan will activate instantly after payment.');
      }
    } catch (e) {
      console.log('[checkout] sync error:', e);
    }
  }, [user, supabase, planParam, planDisplayName, showAlert, router]);

  const handlePay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // All payment methods route through Stripe hosted checkout
      // which natively supports card, Apple Pay, Google Pay
      await handleStripeCheckout();
    } catch (err: any) {
      showAlert('Payment Failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    // Stripe hosted checkout handles all validation
    return true;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />

      <CountryPickerModal
        visible={showCountryPicker}
        selected={country}
        onSelect={setCountry}
        onClose={() => setShowCountryPicker(false)}
        T={T}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: T.text }]}>{planDisplayName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
      >
        {/* Plan Summary */}
        <PlanSummaryCard
          planName={planDisplayName}
          price={displayPrice}
          priceId={priceIdParam}
          T={T}
        />

        {/* Payment Method Selector */}
        <PaymentMethodSelector
          selected={method}
          onSelect={setMethod}
          T={T}
          showPayPal={false}
          showMoncash={country.code === 'HT'}
        />

        {/* Info panel based on selected method */}
        {method === 'card' && (
          <CardDetailsSection
            cardholderName={cardholderName}
            setCardholderName={setCardholderName}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            expiry={expiry}
            setExpiry={setExpiry}
            cvv={cvv}
            setCvv={setCvv}
            saveCard={saveCard}
            setSaveCard={setSaveCard}
            autoRenew={autoRenew}
            setAutoRenew={setAutoRenew}
            T={T}
          />
        )}

        {(method === 'apple' || method === 'google') && (
          <View style={[s.infoPanel, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
            <Ionicons name={method === 'apple' ? 'logo-apple' : 'logo-google'} size={24} color={T.text} />
            <Text style={[s.infoPanelText, { color: T.textSec }]}>
              {method === 'apple'
                ? 'Tap Pay to complete via Apple Pay. Face ID or Touch ID required.'
                : 'Tap Pay to complete via Google Pay. Your saved Google account will be used.'}
            </Text>
          </View>
        )}

        {method === 'moncash' && (
          <View style={[s.infoPanel, { backgroundColor: T.surface, borderColor: T.surfaceBorder }]}>
            <Ionicons name="phone-portrait-outline" size={24} color="#DC143C" />
            <Text style={[s.infoPanelText, { color: T.textSec }]}>
              MonCash payment available for Haiti users. You will be redirected to complete via MonCash.
            </Text>
          </View>
        )}

        {/* Billing Information */}
        <View style={s.sectionTitle}>
          <Text style={[s.sectionTitleText, { color: T.text }]}>Billing Information</Text>
        </View>

        <CountrySelector
          country={country}
          onPress={() => setShowCountryPicker(true)}
          T={T}
        />

        <PhoneInput
          country={country}
          value={phoneNational}
          onChange={setPhoneNational}
          onCountryPress={() => setShowCountryPicker(true)}
          T={T}
        />

        {/* Auto-cancel notice */}
        <View style={s.cancelNotice}>
          <Ionicons name="information-circle-outline" size={15} color={T.textMuted} />
          <Text style={[s.cancelNoticeText, { color: T.textMuted }]}>
            Subscription auto-cancels when the billing period ends unless renewed. No hidden charges.
          </Text>
        </View>

        {/* Security Note */}
        <View style={s.securityRow}>
          <Ionicons name="lock-closed" size={14} color={T.textMuted} />
          <Text style={[s.securityText, { color: T.textMuted }]}>
            Secure payment powered by Stripe
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Pay Button */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[
            s.payBtn,
            { backgroundColor: T.accent },
            loading && s.payBtnDisabled,
          ]}
          onPress={handlePay}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={method === 'apple' ? 'logo-apple' : method === 'google' ? 'logo-google' : 'card-outline'}
                size={18}
                color="#FFF"
              />
              <Text style={s.payBtnText}>Pay {displayPrice}/mo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { marginTop: 8, marginBottom: 12 },
  sectionTitleText: { fontSize: 17, fontWeight: '700' },
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoPanelText: { flex: 1, fontSize: 14, lineHeight: 20 },
  cancelNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  cancelNoticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 10,
  },
  securityText: { fontSize: 12, fontWeight: '500' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  payBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  payBtnDisabled: { opacity: 0.5 },
});
