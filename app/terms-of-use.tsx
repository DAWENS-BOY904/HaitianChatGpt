import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';

// Component for animated sections
const Section: React.FC<{ title: string; children: React.ReactNode; index: number }> = ({ 
  title, 
  children, 
  index 
}) => {
  const isDark = useColorScheme() === 'dark';
  
  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 80).duration(500)}
      style={[styles.section, isDark && styles.sectionDark]}
    >
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </Animated.View>
  );
};

const SubSection: React.FC<{ title: string; content: string | React.ReactNode }> = ({ 
  title, 
  content 
}) => {
  const isDark = useColorScheme() === 'dark';
  
  return (
    <View style={styles.subSection}>
      <Text style={[styles.subSectionTitle, isDark && styles.textDark]}>{title}</Text>
      {typeof content === 'string' ? (
        <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>{content}</Text>
      ) : (
        content
      )}
    </View>
  );
};

const BulletPoint: React.FC<{ text: string }> = ({ text }) => {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={styles.bulletContainer}>
      <View style={[styles.bullet, isDark && styles.bulletDark]} />
      <Text style={[styles.bulletText, isDark && styles.textMutedDark]}>{text}</Text>
    </View>
  );
};

const NumberedItem: React.FC<{ number: number; text: string }> = ({ number, text }) => {
  const isDark = useColorScheme() === 'dark';
  return (
    <View style={styles.numberedContainer}>
      <View style={[styles.numberBadge, isDark && styles.numberBadgeDark]}>
        <Text style={styles.numberText}>{number}</Text>
      </View>
      <Text style={[styles.numberedText, isDark && styles.textMutedDark]}>{text}</Text>
    </View>
  );
};

export default function TermsOfUseScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const handleContact = () => {
    Linking.openURL('mailto:legal@haitianchatgpt.com');
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
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>Terms of Use</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.titleSection}>
          <Text style={[styles.mainTitle, isDark && styles.textDark]}>Terms of Use</Text>
          <Text style={[styles.appName, isDark && styles.accentDark]}>HaitianChatGPT</Text>
          <View style={styles.metaContainer}>
            <Text style={[styles.metaText, isDark && styles.textMutedDark]}>
              Last Updated: {lastUpdated}
            </Text>
            <Text style={[styles.metaText, isDark && styles.textMutedDark]}>
              Effective Date: {effectiveDate}
            </Text>
          </View>
        </Animated.View>

        {/* 1. Agreement to Terms */}
        <Section title="1. Agreement to Terms" index={0}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Welcome to HaitianChatGPT ("Company," "we," "us," or "our"). These Terms of Use ("Terms," 
            "Terms of Use," or "Agreement") constitute a legally binding agreement between you ("User," 
            "you," or "your") and HaitianChatGPT regarding your access to and use of the HaitianChatGPT 
            mobile application, website, application programming interfaces (APIs), and all related 
            services, features, content, and functionalities (collectively, the "Services").
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            BY ACCESSING OR USING OUR SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND 
            AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE WITH ALL OF THESE TERMS, YOU ARE 
            EXPRESSLY PROHIBITED FROM USING THE SERVICES AND MUST DISCONTINUE USE IMMEDIATELY.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Supplemental terms and conditions or documents that may be posted on the Services from time 
            to time are hereby expressly incorporated herein by reference. We reserve the right, in our 
            sole discretion, to make changes or modifications to these Terms at any time and for any 
            reason. We will alert you about any changes by updating the "Last Updated" date of these 
            Terms, and you waive any right to receive specific notice of each such change.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            The Services are intended for users who are at least 13 years of age. All users who are 
            minors in the jurisdiction in which they reside (generally under the age of 18) must have 
            the permission of, and be directly supervised by, their parent or guardian to use the 
            Services. If you are a minor, you must have your parent or guardian read and agree to these 
            Terms prior to you using the Services.
          </Text>
        </Section>

        {/* 2. Intellectual Property Rights */}
        <Section title="2. Intellectual Property Rights" index={1}>
          <SubSection 
            title="2.1 Our Intellectual Property"
            content="Unless otherwise indicated, the Services and all source code, databases, functionality, software, website designs, audio, video, text, photographs, graphics, logos, button icons, images, audio clips, digital downloads, data compilations, and all other content (collectively, the 'Content') and the trademarks, service marks, and logos contained therein (the 'Marks') are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws and various other intellectual property rights and unfair competition laws of the United States, foreign jurisdictions, and international conventions."
          />
          <SubSection 
            title="2.2 Limited License"
            content="Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Services for your personal, non-commercial use. This license does not include any resale or commercial use of the Services or Content; any collection and use of any product listings, descriptions, or prices; any derivative use of the Services or Content; any downloading or copying of account information for the benefit of another merchant; or any use of data mining, robots, or similar data gathering and extraction tools."
          />
          <SubSection 
            title="2.3 Restrictions"
            content={
              <View>
                <Text style={[styles.paragraph, isDark && styles.textMutedDark, { marginBottom: 8 }]}>
                  You are expressly prohibited from:
                </Text>
                <BulletPoint text="Modifying, copying, distributing, transmitting, displaying, performing, reproducing, publishing, licensing, creating derivative works from, transferring, or selling any Content or software obtained from the Services" />
                <BulletPoint text="Using the Services or Content for any commercial purpose without our express written consent" />
                <BulletPoint text="Removing any copyright, trademark, or other proprietary notices from the Services or Content" />
                <BulletPoint text="Attempting to decompile, reverse engineer, disassemble, or hack any of the software or Services, or to defeat or overcome any encryption technology or security measures" />
                <BulletPoint text="Using the Services in any manner that could disable, overburden, damage, or impair the site or interfere with any other party's use of the Services" />
                <BulletPoint text="Using any robot, spider, crawler, scraper, or other automated means or interface not provided by us to access the Services or to extract data" />
              </View>
            }
          />
          <SubSection 
            title="2.4 Feedback"
            content="Any feedback, comments, ideas, improvements, or suggestions (collectively, 'Suggestions') provided by you to us with respect to the Services shall remain the sole and exclusive property of us. We shall be free to use, copy, modify, publish, or redistribute the Suggestions for any purpose and in any way without any credit or compensation to you."
          />
        </Section>

        {/* 3. User Representations and Warranties */}
        <Section title="3. User Representations and Warranties" index={2}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            By using the Services, you represent and warrant that:
          </Text>
          <NumberedItem number={1} text="All registration information you submit will be true, accurate, current, and complete" />
          <NumberedItem number={2} text="You will maintain the accuracy of such information and promptly update such registration information as necessary" />
          <NumberedItem number={3} text="You have the legal capacity and you agree to comply with these Terms" />
          <NumberedItem number={4} text="You are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services" />
          <NumberedItem number={5} text="You will not access the Services through automated or non-human means, whether through a bot, script, or otherwise" />
          <NumberedItem number={6} text="You will not use the Services for any illegal or unauthorized purpose" />
          <NumberedItem number={7} text="Your use of the Services will not violate any applicable law or regulation" />
          <Text style={[styles.paragraph, isDark && styles.textMutedDark, { marginTop: 12 }]}>
            If you provide any information that is untrue, inaccurate, not current, or incomplete, we 
            have the right to suspend or terminate your account and refuse any and all current or 
            future use of the Services (or any portion thereof).
          </Text>
        </Section>

        {/* 4. User Registration and Account Security */}
        <Section title="4. User Registration and Account Security" index={3}>
          <SubSection 
            title="4.1 Account Creation"
            content="You may be required to register with the Services. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable."
          />
          <SubSection 
            title="4.2 Account Security"
            content="You are responsible for maintaining the confidentiality of your account and password, including but not limited to the restriction of access to your computer and/or account. You agree to accept responsibility for any and all activities or actions that occur under your account and/or password, whether your password is with our Services or a third-party service. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account."
          />
          <SubSection 
            title="4.3 Multi-Factor Authentication"
            content="We strongly encourage the use of multi-factor authentication (MFA) to secure your account. While we provide MFA capabilities, you are responsible for enabling and maintaining these security features. We are not liable for unauthorized access to accounts that do not have MFA enabled."
          />
        </Section>

        {/* 5. AI Services and Generated Content */}
        <Section title="5. AI Services and Generated Content" index={4}>
          <SubSection 
            title="5.1 Nature of AI Services"
            content="HaitianChatGPT utilizes artificial intelligence and machine learning technologies to generate responses, content, and outputs based on user inputs. You acknowledge and understand that: (a) AI-generated content may not always be accurate, complete, or up-to-date; (b) AI systems may produce outputs that reflect biases present in training data; (c) AI cannot understand context, intent, or nuance with perfect accuracy; and (d) AI-generated content should not be relied upon as professional advice unless explicitly stated."
          />
          <SubSection 
            title="5.2 No Professional Advice"
            content="THE SERVICES AND ALL AI-GENERATED CONTENT ARE PROVIDED FOR INFORMATIONAL AND ENTERTAINMENT PURPOSES ONLY AND DO NOT CONSTITUTE LEGAL, MEDICAL, FINANCIAL, OR OTHER PROFESSIONAL ADVICE. ALWAYS SEEK THE ADVICE OF QUALIFIED PROFESSIONALS REGARDING ANY QUESTIONS YOU MAY HAVE. NEVER DISREGARD PROFESSIONAL ADVICE OR DELAY IN SEEKING IT BECAUSE OF SOMETHING YOU HAVE READ OR RECEIVED THROUGH THE SERVICES."
          />
          <SubSection 
            title="5.3 User Input and Output License"
            content="By submitting content, prompts, queries, or other materials ('Inputs') to the Services, you grant us a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform your Inputs in connection with the Services and our business operations, including for improving and developing our AI models. You represent and warrant that you have all rights necessary to grant this license."
          />
          <SubSection 
            title="5.4 Output Ownership and Usage Rights"
            content="Subject to your compliance with these Terms and applicable law, you own the Outputs (AI-generated content based on your Inputs) and we hereby assign to you all our right, title, and interest in and to such Outputs. However, due to the nature of machine learning, similar or identical outputs may be generated for other users, and we do not guarantee exclusivity of any Output. You may use Outputs for any lawful purpose, commercial or otherwise."
          />
          <SubSection 
            title="5.5 Content Moderation and Prohibited Uses"
            content={
              <View>
                <Text style={[styles.paragraph, isDark && styles.textMutedDark, { marginBottom: 8 }]}>
                  You agree not to use the Services to generate, upload, or distribute content that:
                </Text>
                <BulletPoint text="Violates any applicable law, statute, ordinance, or regulation" />
                <BulletPoint text="Infringes upon or violates the intellectual property rights or any other rights of any third party" />
                <BulletPoint text="Is defamatory, obscene, pornographic, vulgar, or offensive" />
                <BulletPoint text="Promotes discrimination, bigotry, racism, hatred, harassment, or harm against any individual or group" />
                <BulletPoint text="Is violent or threatening or promotes violence or actions that are threatening to any person or entity" />
                <BulletPoint text="Promotes illegal or harmful activities or substances" />
                <BulletPoint text="Attempts to generate malware, exploits, or code designed to harm systems or data" />
                <BulletPoint text="Impersonates any person or entity or misrepresents your affiliation with a person or entity" />
                <BulletPoint text="Involves the unauthorized collection or harvesting of personal data of others" />
                <BulletPoint text="Interferes with or disrupts the Services or servers or networks connected to the Services" />
              </View>
            }
          />
          <SubSection 
            title="5.6 Automated Decision-Making Disclosure"
            content="You acknowledge that the Services utilize automated decision-making processes, including machine learning algorithms, to generate outputs. These processes operate without human intervention in real-time. While we implement safeguards, you understand that automated systems may produce errors, biases, or unexpected outputs. You agree not to use the Services for decisions with significant legal or similarly significant effects on individuals without appropriate human oversight."
          />
        </Section>

        {/* 6. Prohibited Activities */}
        <Section title="6. Prohibited Activities" index={5}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            You may not access or use the Services for any purpose other than that for which we make 
            the Services available. The Services may not be used in connection with any commercial 
            endeavors except those that are specifically endorsed or approved by us.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark, { marginBottom: 8 }]}>
            As a user of the Services, you agree not to:
          </Text>
          <BulletPoint text="Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us" />
          <BulletPoint text="Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses" />
          <BulletPoint text="Use a buying agent or purchasing agent to make purchases on the Services" />
          <BulletPoint text="Use the Services to advertise or offer to sell goods and services" />
          <BulletPoint text="Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein" />
          <BulletPoint text="Engage in unauthorized framing of or linking to the Services" />
          <BulletPoint text="Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords" />
          <BulletPoint text="Make improper use of our support services or submit false reports of abuse or misconduct" />
          <BulletPoint text="Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools" />
          <BulletPoint text="Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services" />
          <BulletPoint text="Attempt to impersonate another user or person or use the username of another user" />
          <BulletPoint text="Sell or otherwise transfer your profile" />
          <BulletPoint text="Use any information obtained from the Services in order to harass, abuse, or harm another person" />
          <BulletPoint text="Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise" />
          <BulletPoint text="Decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services" />
          <BulletPoint text="Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services" />
          <BulletPoint text="Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you" />
          <BulletPoint text="Delete the copyright or other proprietary rights notice from any Content" />
          <BulletPoint text="Copy or adapt the Services' software, including but not limited to Flash, PHP, HTML, JavaScript, or other code" />
          <BulletPoint text="Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services" />
          <BulletPoint text="Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats ('gifs'), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as 'spyware' or 'passive collection mechanisms' or 'pcms')" />
          <BulletPoint text="Except as may be the result of standard search engine or Internet browser usage, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or using or launching any unauthorized script or other software" />
          <BulletPoint text="Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services" />
          <BulletPoint text="Use the Services in a manner inconsistent with any applicable laws or regulations" />
          <BulletPoint text="Use the Services to train, develop, or improve any artificial intelligence or machine learning models, algorithms, or systems, including but not limited to creating datasets, training neural networks, or developing competing AI services" />
        </Section>

        {/* 7. Service Management and Modifications */}
        <Section title="7. Service Management and Modifications" index={6}>
          <SubSection 
            title="7.1 Service Availability"
            content="We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services."
          />
          <SubSection 
            title="7.2 Modifications and Interruptions"
            content="We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We also reserve the right to modify or discontinue all or part of the Services without notice at any time. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services."
          />
          <SubSection 
            title="7.3 Service Limitations"
            content="We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services."
          />
        </Section>

        {/* 8. Privacy Policy and Data Protection */}
        <Section title="8. Privacy Policy and Data Protection" index={7}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We care about data privacy and security. By using the Services, you agree to be bound by 
            our Privacy Policy posted on the Services, which is incorporated into these Terms. Please 
            be advised the Services are hosted in the United States and Haiti. If you access the 
            Services from any other region of the world with laws or other requirements governing 
            personal data collection, use, or disclosure that differ from applicable laws in the 
            United States and Haiti, then through your continued use of the Services, you are 
            transferring your data to the United States and Haiti, and you agree to have your data 
            transferred to and processed in the United States and Haiti.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            While we implement commercially reasonable technical, administrative, and organizational 
            measures to protect personal data, we cannot guarantee the absolute security of any 
            information transmitted to or from the Services. You provide personal information at your 
            own risk. We comply with applicable data protection laws, including the General Data 
            Protection Regulation (GDPR) for users in the European Economic Area and the California 
            Consumer Privacy Act (CCPA) for California residents.
          </Text>
        </Section>

        {/* 9. Copyright Infringement and DMCA Policy */}
        <Section title="9. Copyright Infringement and DMCA Policy" index={8}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We respect the intellectual property rights of others. If you believe that any material 
            available on or through the Services infringes upon any copyright you own or control, 
            please immediately notify our Designated Copyright Agent using the contact information 
            provided below (a "Notification"). A copy of your Notification will be sent to the person 
            who posted or stored the material addressed in the Notification.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Please be advised that pursuant to federal law you may be held liable for damages if you 
            make material misrepresentations in a Notification. Thus, if you are not sure material 
            located on or linked to by the Services infringes your copyright, you should consider 
            first contacting an attorney.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            All Notifications should meet the requirements of DMCA 17 U.S.C. § 512(c)(3) and include 
            the following information: (1) A physical or electronic signature of a person authorized 
            to act on behalf of the owner of an exclusive right that is allegedly infringed; (2) 
            identification of the copyrighted work claimed to have been infringed, or, if multiple 
            copyrighted works on the Services are covered by the Notification, a representative list 
            of such works on the Services; (3) identification of the material that is claimed to be 
            infringing or to be the subject of infringing activity and that is to be removed or access 
            to which is to be disabled, and information reasonably sufficient to permit us to locate 
            the material; (4) information reasonably sufficient to permit us to contact the complaining 
            party, such as an address, telephone number, and, if available, an email address at which 
            the complaining party may be contacted; (5) a statement that the complaining party has a 
            good faith belief that use of the material in the manner complained of is not authorized 
            by the copyright owner, its agent, or the law; and (6) a statement that the information 
            in the notification is accurate, and under penalty of perjury, that the complaining party 
            is authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Our designated Copyright Agent to receive Notifications is: Legal Department, 
            HaitianChatGPT, 123 Innovation Drive, Suite 400, Port-au-Prince, Haiti, 
            Email: copyright@haitianchatgpt.com.
          </Text>
        </Section>

        {/* 10. Term and Termination */}
        <Section title="10. Term and Termination" index={9}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            These Terms shall remain in full force and effect while you use the Services. WITHOUT 
            LIMITING ANY OTHER PROVISION OF THESE TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE 
            DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES 
            (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO 
            REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR 
            COVENANT CONTAINED IN THESE TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY 
            TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY 
            CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE 
            DISCRETION.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            If we terminate or suspend your account for any reason, you are prohibited from 
            registering and creating a new account under your name, a fake or borrowed name, or 
            the name of any third party, even if you may be acting on behalf of the third party. 
            In addition to terminating or suspending your account, we reserve the right to take 
            appropriate legal action, including without limitation pursuing civil, criminal, and 
            injunctive redress.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Even after your account is terminated, these Terms will remain in effect with respect 
            to: (a) provisions that by their nature should survive termination, including but not 
            limited to ownership provisions, warranty disclaimers, indemnity, and limitations of 
            liability; (b) any accrued but unpaid fees; and (c) any investigation or legal action 
            arising from your use of the Services.
          </Text>
        </Section>

        {/* 11. Disclaimers and Limitations of Liability */}
        <Section title="11. Disclaimers and Limitations of Liability" index={10}>
          <SubSection 
            title="11.1 Disclaimer of Warranties"
            content="THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT OR THE CONTENT OF ANY WEBSITES LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES."
          />
          <SubSection 
            title="11.2 AI-Specific Disclaimers"
            content="YOU SPECIFICALLY ACKNOWLEDGE AND AGREE THAT: (A) AI-GENERATED CONTENT MAY CONTAIN ERRORS, INACCURACIES, OR OUTDATED INFORMATION; (B) AI SYSTEMS MAY PRODUCE BIASED, INAPPROPRIATE, OR HARMFUL OUTPUTS; (C) WE DO NOT GUARANTEE THE RELIABILITY, ACCURACY, OR APPROPRIATENESS OF ANY AI-GENERATED CONTENT; (D) YOU SHOULD NOT RELY ON AI-GENERATED CONTENT FOR CRITICAL DECISIONS WITHOUT INDEPENDENT VERIFICATION; AND (E) WE ARE NOT RESPONSIBLE FOR ANY ACTIONS YOU TAKE BASED ON AI-GENERATED CONTENT."
          />
          <SubSection 
            title="11.3 Limitation of Liability"
            content="IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD PRIOR TO ANY CAUSE OF ACTION ARISING. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS."
          />
          <SubSection 
            title="11.4 Indemnification"
            content="You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or arising out of: (1) your Contributions; (2) use of the Services; (3) breach of these Terms; (4) any breach of your representations and warranties set forth in these Terms; (5) your violation of the rights of a third party, including but not limited to intellectual property rights; or (6) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it."
          />
        </Section>

        {/* 12. Governing Law and Dispute Resolution */}
        <Section title="12. Governing Law and Dispute Resolution" index={11}>
          <SubSection 
            title="12.1 Governing Law"
            content="These Terms and your use of the Services are governed by and construed in accordance with the laws of the Republic of Haiti, without regard to its conflict of law principles. The United Nations Convention on Contracts for the International Sale of Goods does not apply to these Terms."
          />
          <SubSection 
            title="12.2 Informal Resolution"
            content="Before filing a claim against HaitianChatGPT, you agree to try to resolve the dispute informally by contacting legal@haitianchatgpt.com. We'll try to resolve the dispute informally by contacting you via email. If a dispute is not resolved within 30 days of submission, you or HaitianChatGPT may bring a formal proceeding."
          />
          <SubSection 
            title="12.3 Arbitration Agreement"
            content="You and HaitianChatGPT agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Services (collectively, 'Disputes') will be settled by binding arbitration, except that each party retains the right to bring an individual action in small claims court and the right to seek injunctive or other equitable relief in a court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of a party's copyrights, trademarks, trade secrets, patents, or other intellectual property rights. You acknowledge and agree that you and HaitianChatGPT are each waiving the right to a trial by jury or to participate as a plaintiff or class member in any purported class action or representative proceeding."
          />
          <SubSection 
            title="12.4 Arbitration Rules and Procedures"
            content="The arbitration will be administered by the International Centre for Dispute Resolution (ICDR) in accordance with the ICDR International Arbitration Rules then in effect. The arbitration will be conducted in Port-au-Prince, Haiti, unless you and HaitianChatGPT agree otherwise. The arbitrator will have exclusive authority to resolve any Dispute, including disputes relating to the interpretation, applicability, or enforceability of these arbitration provisions. The arbitrator's award will be binding and may be entered as a judgment in any court of competent jurisdiction."
          />
          <SubSection 
            title="12.5 Class Action Waiver"
            content="YOU AGREE THAT ANY ARBITRATION OR LEGAL PROCEEDING WILL BE CONDUCTED ONLY IN YOUR INDIVIDUAL CAPACITY AND NOT AS A CLASS ACTION, COLLECTIVE ACTION, PRIVATE ATTORNEY GENERAL ACTION, OR OTHER REPRESENTATIVE PROCEEDING. YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION AGAINST HAITIANCHATGPT. IF THIS CLASS ACTION WAIVER IS FOUND TO BE UNENFORCEABLE, THEN THE ENTIRETY OF THIS DISPUTE RESOLUTION SECTION WILL BE NULL AND VOID."
          />
          <SubSection 
            title="12.6 Jurisdiction"
            content="Subject to the arbitration provisions above, any legal suit, action, or proceeding arising out of, or related to, these Terms or the Services shall be instituted exclusively in the courts of Port-au-Prince, Haiti. You waive any and all objections to the exercise of jurisdiction over you by such courts and to venue in such courts."
          />
        </Section>

        {/* 13. Subscription and Payment Terms */}
        <Section title="13. Subscription and Payment Terms" index={12}>
          <SubSection 
            title="13.1 Subscription Plans"
            content="We offer various subscription plans for access to premium features of the Services. Details of current plans, pricing, and features are available within the Services. We reserve the right to modify, terminate, or otherwise amend our offered subscription plans at any time."
          />
          <SubSection 
            title="13.2 Billing and Renewal"
            content="Your subscription will continue and automatically renew unless cancelled. You authorize us to charge your chosen payment provider for the subscription fees. Subscription fees are billed in advance on a recurring basis depending on the plan you select (monthly or annually). You must cancel your subscription before it renews to avoid billing of the next period's subscription fees."
          />
          <SubSection 
            title="13.3 Free Trials"
            content="We may offer free trials of paid subscriptions. At the end of the trial period, you will be automatically charged the applicable subscription fee unless you cancel before the trial ends. We reserve the right to modify or terminate free trial offers at any time."
          />
          <SubSection 
            title="13.4 Cancellation and Refunds"
            content="You can cancel your subscription at any time through your account settings or the App Store/Google Play Store. Your cancellation will take effect at the end of the current billing period. You will not receive a refund for the current billing period. Refunds for prior billing periods are granted only in our sole discretion or as required by applicable law."
          />
          <SubSection 
            title="13.5 Price Changes"
            content="We reserve the right to adjust pricing for our Services at any time. Any price changes will take effect following notice to you, which may be sent via email or posted within the Services."
          />
          <SubSection 
            title="13.6 Lifetime Subscriptions"
            content="Lifetime subscriptions grant access to specified premium features for the lifetime of the Services or your account, whichever is shorter. 'Lifetime' refers to the operational lifetime of the product, not the user's lifetime. We reserve the right to discontinue the Services or specific features, in which case lifetime subscribers may receive comparable alternatives or prorated refunds at our discretion."
          />
        </Section>

        {/* 14. Export Control and Sanctions */}
        <Section title="14. Export Control and Sanctions" index={13}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            You may not use, export, import, or transfer the Services except as authorized by United 
            States law, the laws of the jurisdiction in which you obtained the Services, and any 
            other applicable laws. In particular, but without limitation, the Services may not be 
            exported or re-exported (a) into any United States embargoed countries; or (b) to anyone 
            on the U.S. Treasury Department's list of Specially Designated Nationals or the U.S. 
            Department of Commerce Denied Person's List or Entity List. By using the Services, you 
            represent and warrant that (i) you are not located in a country that is subject to a 
            U.S. Government embargo, or that has been designated by the U.S. Government as a 
            'terrorist supporting' country and (ii) you are not listed on any U.S. Government list 
            of prohibited or restricted parties. You further agree not to use the Services for any 
            purposes prohibited by United States law, including, without limitation, the development, 
            design, manufacture, or production of nuclear, missile, or chemical or biological weapons.
          </Text>
        </Section>

        {/* 15. Severability and Waiver */}
        <Section title="15. Severability and Waiver" index={14}>
          <SubSection 
            title="15.1 Severability"
            content="If any provision of these Terms is found by any court or administrative body of competent jurisdiction to be invalid, unenforceable, or illegal, such invalidity, unenforceability, or illegality shall not affect the other provisions of these Terms, which shall remain in full force and effect. If any invalid, unenforceable, or illegal provision would be valid, enforceable, or legal if some part of it were deleted, the provision shall apply with the minimum modification necessary to make it legal, valid, and enforceable."
          />
          <SubSection 
            title="15.2 No Waiver"
            content="No failure or delay by us in exercising any right, power, or privilege under these Terms shall operate as a waiver thereof, nor shall any single or partial exercise of any right, power, or privilege preclude any other or further exercise thereof or the exercise of any other right, power, or privilege. Our rights and remedies under these Terms are cumulative and not exclusive of any rights or remedies provided by law."
          />
        </Section>

        {/* 16. Assignment */}
        <Section title="16. Assignment" index={15}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            You may not assign, transfer, or delegate these Terms or your rights or obligations 
            hereunder without our prior written consent. We may freely assign, transfer, or delegate 
            these Terms or our rights and obligations hereunder without restriction. Subject to the 
            foregoing, these Terms will bind and inure to the benefit of the parties, their successors, 
            and permitted assigns.
          </Text>
        </Section>

        {/* 17. Entire Agreement */}
        <Section title="17. Entire Agreement" index={16}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            These Terms, together with our Privacy Policy and any other legal notices published by 
            us on the Services, shall constitute the entire agreement between you and us concerning 
            the Services. If any provision of these Terms is deemed invalid by a court of competent 
            jurisdiction, the invalidity of such provision shall not affect the validity of the 
            remaining provisions of these Terms, which shall remain in full force and effect.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            No waiver of any term of these Terms shall be deemed a further or continuing waiver of 
            such term or any other term, and our failure to assert any right or provision under 
            these Terms shall not constitute a waiver of such right or provision.
          </Text>
        </Section>

        {/* 18. Electronic Communications */}
        <Section title="18. Electronic Communications" index={17}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            By using the Services, you consent to receiving electronic communications from us. These 
            electronic communications may include notices about applicable fees and charges, 
            transactional information, and other information concerning or related to the Services. 
            For purposes of these Terms, you (a) consent to receive communications from us in an 
            electronic form; and (b) agree that all terms and conditions, agreements, notices, 
            disclosures, and other communications that we provide to you electronically satisfy any 
            legal requirement that such communications would satisfy if they were in writing. The 
            foregoing does not affect your non-waivable rights.
          </Text>
        </Section>

        {/* 19. Force Majeure */}
        <Section title="19. Force Majeure" index={18}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            We will not be liable or responsible to you, nor be deemed to have defaulted or breached 
            these Terms, for any failure or delay in our performance under these Terms when and to 
            the extent such failure or delay is caused by or results from acts or circumstances 
            beyond our reasonable control, including, without limitation, acts of God, flood, fire, 
            earthquake, explosion, governmental actions, war, invasion or hostilities (whether war 
            is declared or not), terrorist threats or acts, riot or other civil unrest, national 
            emergency, revolution, insurrection, epidemic, pandemic, lockouts, strikes or other 
            labor disputes (whether or not relating to our workforce), or restraints or delays 
            affecting carriers or inability or delay in obtaining supplies of adequate or suitable 
            materials, materials or telecommunication breakdown or power outage.
          </Text>
        </Section>

        {/* 20. Contact Information */}
        <Section title="20. Contact Information" index={19}>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            If you have any questions, concerns, or comments about these Terms, please contact us at:
          </Text>
          <View style={styles.contactCard}>
            <Text style={[styles.contactTitle, isDark && styles.textDark]}>
              HaitianChatGPT Legal Department
            </Text>
            <TouchableOpacity onPress={handleContact}>
              <Text style={[styles.contactLink, isDark && styles.accentDark]}>
                legal@haitianchatgpt.com
              </Text>
            </TouchableOpacity>
            <Text style={[styles.contactText, isDark && styles.textMutedDark]}>
              123 Innovation Drive, Suite 400{'\n'}
              Port-au-Prince, Haiti{'\n'}
              Telephone: +509 1234-5678
            </Text>
          </View>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            For copyright-related inquiries, please contact: copyright@haitianchatgpt.com{'\n'}
            For data protection inquiries, please contact: privacy@haitianchatgpt.com{'\n'}
            For security vulnerabilities, please contact: security@haitianchatgpt.com
          </Text>
        </Section>

        {/* Acceptance Section */}
        <Animated.View 
          entering={FadeInUp.delay(1600).duration(500)}
          style={[styles.acceptanceSection, isDark && styles.sectionDark]}
        >
          <Text style={[styles.acceptanceTitle, isDark && styles.textDark]}>
            Acceptance of Terms
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            BY USING HAITIANCHATGPT, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF USE, 
            UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM. IF YOU DO NOT AGREE TO THESE TERMS, 
            YOU ARE NOT AUTHORIZED TO USE THE SERVICES.
          </Text>
          <Text style={[styles.paragraph, isDark && styles.textMutedDark]}>
            Last Updated: {lastUpdated} | Effective Date: {effectiveDate}
          </Text>
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
    width: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 60,
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
