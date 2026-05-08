import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';

// Types
interface SectionProps {
  title: string;
  children: React.ReactNode;
  index: number;
}

interface SubSectionProps {
  title: string;
  content: string;
}

// Component for animated sections
const PolicySection: React.FC<SectionProps> = ({ title, children, index }) => {
  const isDark = useColorScheme() === 'dark';
  
  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 100).duration(500)}
      style={[styles.section, isDark && styles.sectionDark]}
    >
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
        {title}
      </Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </Animated.View>
  );
};

const SubSection: React.FC<SubSectionProps> = ({ title, content }) => {
  const isDark = useColorScheme() === 'dark';
  
  return (
    <View style={styles.subSection}>
      <Text style={[styles.subSectionTitle, isDark && styles.textDark]}>
        {title}
      </Text>
      <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
        {content}
      </Text>
    </View>
  );
};

// Bullet point component
const BulletPoint: React.FC<{ text: string; isDark: boolean }> = ({ text, isDark }) => (
  <View style={styles.bulletContainer}>
    <View style={[styles.bullet, isDark && styles.bulletDark]} />
    <Text style={[styles.bulletText, isDark && styles.textMutedDark]}>
      {text}
    </Text>
  </View>
);

// Numbered list component
const NumberedItem: React.FC<{ number: number; text: string; isDark: boolean }> = ({ 
  number, 
  text, 
  isDark 
}) => (
  <View style={styles.numberedContainer}>
    <View style={[styles.numberBadge, isDark && styles.numberBadgeDark]}>
      <Text style={styles.numberText}>{number}</Text>
    </View>
    <Text style={[styles.numberedText, isDark && styles.textMutedDark]}>
      {text}
    </Text>
  </View>
);

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: 'HaitianChatGPT Privacy Policy',
        message: 'Read the HaitianChatGPT Privacy Policy: Protecting your data while delivering AI-powered assistance.',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleContact = () => {
    Linking.openURL('mailto:privacy@haitianchatgpt.com');
  };

  const lastUpdated = "February 20, 2026";
  const effectiveDate = "March 1, 2026";

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>
          Privacy Policy
        </Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.titleSection}>
          <Text style={[styles.mainTitle, isDark && styles.textDark]}>
            Privacy Policy
          </Text>
          <Text style={[styles.appName, isDark && styles.accentDark]}>
            HaitianChatGPT
          </Text>
          <View style={styles.metaContainer}>
            <Text style={[styles.metaText, isDark && styles.textMutedDark]}>
              Last Updated: {lastUpdated}
            </Text>
            <Text style={[styles.metaText, isDark && styles.textMutedDark]}>
              Effective Date: {effectiveDate}
            </Text>
          </View>
        </Animated.View>

        {/* Introduction */}
        <PolicySection title="1. Introduction & Overview" index={0}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Welcome to HaitianChatGPT ("we," "our," or "us"). We are committed to protecting your privacy 
            and ensuring the security of your personal information. This Privacy Policy explains how we 
            collect, use, disclose, and safeguard your information when you use our mobile application, 
            website, and AI-powered services (collectively, the "Services").
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            By accessing or using HaitianChatGPT, you agree to the terms of this Privacy Policy. If you 
            do not agree with our policies and practices, please do not use our Services. This policy 
            applies to all users worldwide, with specific provisions for residents of the European Union 
            (GDPR), California (CCPA/CPRA), Canada (PIPEDA), and other jurisdictions with specific 
            privacy requirements.
          </Text>
          <SubSection 
            title="1.1 Scope of This Policy"
            content="This Privacy Policy covers our data collection practices across all platforms including iOS, Android, web applications, API integrations, and any future platforms we may develop. It encompasses both automated data collection and manual data input."
          />
          <SubSection 
            title="1.2 Changes to This Policy"
            content="We may update this Privacy Policy periodically to reflect changes in our practices, legal requirements, or service offerings. We will notify you of any material changes through the app, email, or prominent notice on our website at least 30 days before the changes take effect."
          />
        </PolicySection>

        {/* Data Collection */}
        <PolicySection title="2. Information We Collect" index={1}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We collect various types of information to provide, maintain, and improve our Services. 
            This includes information you provide directly, data collected automatically, and information 
            from third-party sources.
          </Text>
          
          <SubSection 
            title="2.1 Personal Information You Provide"
            content="When you create an account, use our AI chat features, or interact with our Services, we may collect:"
          />
          <BulletPoint text="Account credentials (email address, password, username)" isDark={isDark} />
          <BulletPoint text="Profile information (name, profile photo, biography)" isDark={isDark} />
          <BulletPoint text="Payment information (processed securely through Stripe/PayPal)" isDark={isDark} />
          <BulletPoint text="Communications with our AI (chat history, prompts, uploaded files)" isDark={isDark} />
          <BulletPoint text="User preferences and settings (language, theme, notification settings)" isDark={isDark} />
          <BulletPoint text="Feedback, ratings, and survey responses" isDark={isDark} />

          <SubSection 
            title="2.2 Automatically Collected Information"
            content="Our Services automatically collect certain information about your device and usage patterns:"
          />
          <BulletPoint text="Device information (model, operating system version, unique device identifiers)" isDark={isDark} />
          <BulletPoint text="Log data (IP address, access times, pages viewed, app crashes)" isDark={isDark} />
          <BulletPoint text="Usage data (features used, interaction patterns, session duration)" isDark={isDark} />
          <BulletPoint text="Location data (approximate location based on IP, GPS with permission)" isDark={isDark} />
          <BulletPoint text="Cookies and similar technologies (session management, preferences)" isDark={isDark} />

          <SubSection 
            title="2.3 AI Interaction Data"
            content="As an AI-powered service, we process your conversational inputs to generate responses. This includes:"
          />
          <BulletPoint text="Text inputs and voice transcriptions" isDark={isDark} />
          <BulletPoint text="Uploaded documents, images, and files" isDark={isDark} />
          <BulletPoint text="Context from previous messages in active conversations" isDark={isDark} />
          <BulletPoint text="Generated AI responses and content" isDark={isDark} />
        </PolicySection>

        {/* AI Data Processing */}
        <PolicySection title="3. AI Data Processing & Machine Learning" index={2}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            HaitianChatGPT utilizes advanced artificial intelligence and machine learning technologies 
            to provide intelligent conversational experiences. Our AI systems process your inputs to 
            generate helpful, accurate, and contextually relevant responses.
          </Text>

          <SubSection 
            title="3.1 How We Process Your Conversations"
            content="Your interactions with our AI are processed through secure, encrypted channels. We employ state-of-the-art natural language processing models that analyze your inputs to understand intent, context, and generate appropriate responses. This processing occurs in real-time and may involve:"
          />
          <NumberedItem 
            number={1} 
            text="Semantic analysis to understand the meaning and intent behind your messages" 
            isDark={isDark} 
          />
          <NumberedItem 
            number={2} 
            text="Context retention within active sessions to maintain conversation continuity" 
            isDark={isDark} 
          />
          <NumberedItem 
            number={3} 
            text="Content moderation to prevent harmful, illegal, or inappropriate outputs" 
            isDark={isDark} 
          />
          <NumberedItem 
            number={4} 
            text="Quality improvement through anonymized pattern analysis (never selling personal data)" 
            isDark={isDark} 
          />

          <SubSection 
            title="3.2 Training Data & Model Improvement"
            content="We may use anonymized, aggregated interaction data to improve our AI models. This process involves removing all personally identifiable information (PII) before any data is used for training purposes. You have the right to opt-out of having your anonymized data contribute to model improvements through your privacy settings."
          />

          <SubSection 
            title="3.3 Third-Party AI Providers"
            content="We partner with leading AI technology providers including OpenAI, Anthropic, and Google Cloud AI. When your data is processed by these providers, it is subject to their respective data processing agreements and security standards. We ensure all partners maintain SOC 2 Type II compliance and GDPR adequacy."
          />
        </PolicySection>

        {/* Use of Information */}
        <PolicySection title="4. How We Use Your Information" index={3}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We use the collected information for various purposes to operate, improve, and secure our 
            Services. These uses are grounded in legal bases including consent, contractual necessity, 
            legitimate interests, and legal compliance.
          </Text>

          <SubSection 
            title="4.1 Service Provision & Maintenance"
            content="Primary uses include: authenticating your identity, processing your AI queries, maintaining conversation history, delivering personalized experiences, processing payments, and providing customer support."
          />

          <SubSection 
            title="4.2 Service Improvement & Analytics"
            content="We analyze usage patterns to: identify popular features, optimize app performance, detect and fix bugs, improve AI response quality, and develop new functionality. This analysis uses aggregated, de-identified data wherever possible."
          />

          <SubSection 
            title="4.3 Security & Fraud Prevention"
            content="Your data helps us: monitor for suspicious activities, prevent unauthorized access, enforce our terms of service, comply with legal obligations, and protect the rights and safety of our users and the public."
          />

          <SubSection 
            title="4.4 Communications"
            content="With your consent, we may send you: service updates, security alerts, promotional offers (which you can opt-out of), newsletters, and responses to your inquiries. We respect your communication preferences and provide easy unsubscribe options."
          />
        </PolicySection>

        {/* Data Sharing */}
        <PolicySection title="5. Information Sharing & Disclosure" index={4}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We do not sell your personal information. We share data only in specific circumstances 
            outlined below, always with appropriate safeguards and legal protections.
          </Text>

          <SubSection 
            title="5.1 Service Providers"
            content="We engage trusted third-party companies to perform functions on our behalf, including: cloud hosting (AWS, Google Cloud), payment processing (Stripe), analytics (Mixpanel, Amplitude), customer support (Zendesk), and email delivery (SendGrid). These providers have access only to information necessary to perform their functions."
          />

          <SubSection 
            title="5.2 Legal Requirements"
            content="We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., court orders, subpoenas). We will notify you of such requests unless prohibited by law or when necessary to prevent harm."
          />

          <SubSection 
            title="5.3 Business Transfers"
            content="If HaitianChatGPT is involved in a merger, acquisition, or asset sale, your information may be transferred as part of that transaction. We will provide notice before your personal information is transferred and becomes subject to a different privacy policy."
          />

          <SubSection 
            title="5.4 With Your Consent"
            content="We may share your information for other purposes with your explicit consent, which you can revoke at any time through your account settings."
          />
        </PolicySection>

        {/* Data Security */}
        <PolicySection title="6. Data Security & Protection" index={5}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We implement comprehensive technical and organizational measures to protect your personal 
            information against unauthorized access, alteration, disclosure, or destruction.
          </Text>

          <SubSection 
            title="6.1 Security Measures"
            content="Our security infrastructure includes: AES-256 encryption for data at rest, TLS 1.3 for data in transit, multi-factor authentication, regular security audits, penetration testing, intrusion detection systems, and employee security training."
          />

          <SubSection 
            title="6.2 Data Retention"
            content="We retain your personal information only for as long as necessary to fulfill the purposes outlined in this policy. Active account data is retained indefinitely until account deletion. Deleted accounts are purged within 30 days, except where legal obligations require longer retention. AI conversation history is retained for 12 months unless you request earlier deletion."
          />

          <SubSection 
            title="6.3 International Data Transfers"
            content="Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs) for EU data transfers and adequacy decisions where applicable."
          />

          <SubSection 
            title="6.4 Incident Response"
            content="In the unlikely event of a data breach, we will notify affected users and relevant authorities within 72 hours of discovery, as required by applicable law. We maintain cyber insurance and incident response plans to minimize impact."
          />
        </PolicySection>

        {/* User Rights */}
        <PolicySection title="7. Your Privacy Rights & Choices" index={6}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Depending on your location, you may have specific rights regarding your personal information. 
            We are committed to facilitating these rights regardless of your jurisdiction.
          </Text>

          <SubSection 
            title="7.1 Access & Portability"
            content="You have the right to request copies of your personal information in a structured, commonly used, machine-readable format. You can download your data through Settings > Privacy > Download My Data."
          />

          <SubSection 
            title="7.2 Correction & Deletion"
            content="You can update or correct your information through your account settings. You may request deletion of your account and associated data, subject to legal retention requirements. Some data may be retained in anonymized form for analytics."
          />

          <SubSection 
            title="7.3 Restriction & Objection"
            content="You can object to certain processing activities, including direct marketing and certain types of automated decision-making. You may also request restriction of processing in specific circumstances."
          />

          <SubSection 
            title="7.4 GDPR Rights (EU/EEA Residents)"
            content="If you are in the European Union, you have rights under GDPR including: right to be informed, right of access, right to rectification, right to erasure ('right to be forgotten'), right to restrict processing, right to data portability, right to object, and rights related to automated decision-making."
          />

          <SubSection 
            title="7.5 CCPA/CPRA Rights (California Residents)"
            content="California residents have rights including: knowing what personal information is collected, knowing if personal information is sold or shared (we do not sell), opting out of sales (N/A), non-discrimination for exercising rights, and correcting inaccurate personal information."
          />

          <SubSection 
            title="7.6 Exercising Your Rights"
            content="To exercise any of these rights, contact us at privacy@haitianchatgpt.com or use the in-app privacy controls. We will respond within 30 days (or sooner as required by local law). We may need to verify your identity before processing your request."
          />
        </PolicySection>

        {/* Children's Privacy */}
        <PolicySection title="8. Children's Privacy" index={7}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            HaitianChatGPT is not intended for children under 13 years of age (or 16 in the EU). We do 
            not knowingly collect personal information from children. If we learn we have collected 
            personal information from a child without parental consent, we will delete that information 
            immediately.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Parents or guardians who believe their child has provided us with personal information 
            should contact us immediately at privacy@haitianchatgpt.com. We encourage parents to 
            monitor their children's online activities and use parental control tools available from 
            online services and software manufacturers.
          </Text>
        </PolicySection>

        {/* Cookies & Tracking */}
        <PolicySection title="9. Cookies & Tracking Technologies" index={8}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We use cookies and similar tracking technologies to track activity on our Services and 
            hold certain information to enhance your experience.
          </Text>

          <SubSection 
            title="9.1 Types of Cookies We Use"
            content="Essential cookies (required for operation), Preference cookies (remember your settings), Analytics cookies (help us understand usage), and Marketing cookies (used with your consent for targeted advertising)."
          />

          <SubSection 
            title="9.2 Mobile App Tracking"
            content="Our mobile applications may use device identifiers and tracking technologies for analytics and advertising purposes. You can control tracking through your device settings (iOS: Settings > Privacy > Tracking; Android: Settings > Privacy > Ads)."
          />

          <SubSection 
            title="9.3 Do Not Track"
            content="We honor Do Not Track signals and provide a Global Privacy Control (GPC) opt-out mechanism for California residents."
          />
        </PolicySection>

        {/* Third Party Links */}
        <PolicySection title="10. Third-Party Links & Integrations" index={9}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Our Services may contain links to third-party websites, services, or integrations not 
            operated by us. We have no control over and assume no responsibility for the content, 
            privacy policies, or practices of any third-party sites or services.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            When you use third-party integrations (such as sharing to social media), your information 
            is subject to that third party's privacy policy. We recommend reviewing the privacy 
            policies of any third-party services you interact with through our platform.
          </Text>
        </PolicySection>

        {/* Data Protection Officer */}
        <PolicySection title="11. Data Protection Officer & Contact" index={10}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We have appointed a Data Protection Officer (DPO) responsible for overseeing questions 
            in relation to this privacy policy and our data protection practices.
          </Text>

          <SubSection 
            title="11.1 Contact Information"
            content="For privacy-related inquiries, exercising your rights, or concerns about our data practices, please contact:"
          />
          
          <View style={styles.contactCard}>
            <Text style={[styles.contactTitle, isDark && styles.textDark]}>
              HaitianChatGPT Privacy Team
            </Text>
            <TouchableOpacity onPress={handleContact}>
              <Text style={[styles.contactLink, isDark && styles.accentDark]}>
                privacy@haitianchatgpt.com
              </Text>
            </TouchableOpacity>
            <Text style={[styles.contactText, isDark && styles.textMutedDark]}>
              123 Innovation Drive, Suite 400{'\n'}
              Port-au-Prince, Haiti{'\n'}
              ATTN: Data Protection Officer
            </Text>
          </View>

          <SubSection 
            title="11.2 Supervisory Authority"
            content="If you are located in the European Economic Area and believe we are processing your personal data in violation of GDPR, you have the right to lodge a complaint with your local supervisory authority."
          />
        </PolicySection>

        {/* Governing Law */}
        <PolicySection title="12. Governing Law & Jurisdiction" index={11}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            This Privacy Policy shall be governed by and construed in accordance with the laws of 
            the Republic of Haiti, without regard to its conflict of law provisions. However, we 
            comply with the data protection laws of the jurisdictions in which we operate, including 
            GDPR for EU residents and CCPA for California residents.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Any disputes arising under this Privacy Policy shall be subject to the exclusive 
            jurisdiction of the courts of Port-au-Prince, Haiti, except where mandatory local law 
            requires disputes to be resolved in your local jurisdiction.
          </Text>
        </PolicySection>

        {/* Acceptance */}
        <Animated.View 
          entering={FadeInUp.delay(1200).duration(500)}
          style={[styles.acceptanceSection, isDark && styles.sectionDark]}
        >
          <Text style={[styles.acceptanceTitle, isDark && styles.textDark]}>
            Acceptance of Terms
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            By using HaitianChatGPT, you acknowledge that you have read, understood, and agree to 
            be bound by this Privacy Policy. If you do not agree with our policies and practices, 
            please do not use our Services.
          </Text>
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={handleContact}
          >
            <Text style={styles.contactButtonText}>Contact Privacy Team</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, isDark && styles.textMutedDark]}>
            © 2026 HaitianChatGPT. All rights reserved.{'\n'}
            Built with ❤️ for Haiti and the world.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerDark: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#38383A',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  shareButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 16,
  },
  accentDark: {
    color: '#0A84FF',
  },
  metaContainer: {
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionDark: {
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOpacity: 0.3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    lineHeight: 24,
  },
  sectionContent: {
    gap: 12,
  },
  subSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    lineHeight: 20,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3A3A3C',
    marginBottom: 12,
  },
  textDark: {
    color: '#FFFFFF',
  },
  textMutedDark: {
    color: '#8E8E93',
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
    marginTop: 8,
    marginRight: 10,
  },
  bulletDark: {
    backgroundColor: '#0A84FF',
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#3A3A3C',
  },
  numberedContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingLeft: 4,
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  numberBadgeDark: {
    backgroundColor: '#0A84FF',
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  numberedText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#3A3A3C',
  },
  contactCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  contactLink: {
    fontSize: 15,
    color: '#007AFF',
    marginBottom: 8,
    fontWeight: '500',
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3A3A3C',
  },
  acceptanceSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  acceptanceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  contactButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
});
