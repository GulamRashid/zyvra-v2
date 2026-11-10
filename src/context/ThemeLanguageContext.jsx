import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const ThemeLanguageContext = createContext(null);
const translations = {
  en: {
    home: 'Home', explore: 'Explore', tests: 'Tests', toolbox: 'Toolbox', profile: 'Profile',
    exploreExams: 'Explore Exams', purchases: 'My Purchases', analytics: 'Performance & Analytics',
    bookmarks: 'Bookmarks', wallet: 'Coin Wallet', planner: 'Study Planner', notifications: 'Notifications',
    profileSettings: 'Profile & Settings',
    welcome: 'Good to see you', ready: 'Ready for your next study session?',
    continue: 'Continue learning', dailyGoal: 'Daily goal', streak: 'Study streak',
    quickActions: 'Quick actions', recentActivity: 'Recent activity',
    recommended: 'Recommended practice', coins: 'Zyvra Coins', install: 'Install App',
    signIn: 'Sign in', signOut: 'Sign out', settings: 'Settings', adminPanel: 'Admin Panel',
    greeting: 'Namaste', dailyTarget: 'Daily study target', currentStreak: 'Current streak',
    continueShelf: 'Continue learning', resume: 'Resume', featuredPathways: 'Featured exam pathways',
    liveTests: 'Live Tests', questionBank: 'Question Bank', studyToolbox: 'Study Toolbox',
    myWallet: 'My Wallet', installMessage: 'Install Zyvra App for distraction-free study and fast launch.',
    installNow: 'Install Now', later: 'Later', installHelp: 'Use your browser menu to add Zyvra to your home screen.',
    syllabus: 'Syllabus', testsCount: 'tests', targetReached: 'Daily target reached',
    minutesRemaining: 'minutes to your daily target', lastVisited: 'Last visited chapter',
    startExploring: 'Explore your syllabus to pick up where you left off.',
    loadingContinue: 'Finding your next study step…', noActiveTest: 'Your next study step is ready.',
    streakDays: 'day streak', syllabusTags: 'SYLLABUS',
    chapterContent: 'Chapter content', paidAccess: 'Paid access', freeToExplore: 'Free to explore',
    studyTime: 'study time', fullAccess: 'Unlock Full Access for', unlockChapterCopy: 'Purchase this chapter to unlock tests, practice and protected resources. Free previews remain available.',
    buyNow: 'Buy Now', checkingAccess: 'Checking access…', chapterComingSoon: 'This chapter is coming soon.',
    chapterPreparing: 'We’re preparing the learning material. Check back soon for tests, question practice and notes.',
    backToSyllabus: 'Back to syllabus', paidLearningPath: 'This chapter is part of a paid learning path.',
    accessVerified: 'Access is verified by Zyvra before protected content is unlocked.',
    viewAccessOptions: 'View access options', checkUnderstanding: 'CHECK YOUR UNDERSTANDING',
    chapterTests: 'Chapter tests', available: 'available', testsUnavailable: 'Tests are not available in this section.',
    chooseAnotherTab: 'Choose another learning tab to continue.', unlockLiveTests: 'Unlock this chapter to access live tests.',
    freePreviewsNotes: 'Free previews stay available in Notes & PDFs.', loadingTests: 'Loading available tests…',
    noPublishedTests: 'No tests have been published for this chapter yet.', checkBackPractice: 'Check back soon for a new practice opportunity.',
    attemptsUsed: 'attempts used', limitReached: 'Limit reached', startTest: 'Start test',
    learnByDoing: 'LEARN BY DOING', questionPractice: 'Question practice', topicPractice: 'Topic practice',
    practiceUnavailable: 'Question practice is not available in this section.', unlockPractice: 'Unlock this chapter to start question practice.',
    reviewKeyConcepts: 'Review key concepts with a focused practice set and instant explanations.',
    topicQuestions: 'Topic-wise questions', ownPace: 'Go at your own pace', reviewExplanations: 'Review explanations',
    startPractice: 'Start practice', readReviseRemember: 'READ, REVISE, REMEMBER', notesPdfs: 'Notes & PDFs',
    resources: 'resources', notesUnavailable: 'Notes are not available in this section.',
    loadingResources: 'Loading chapter resources…', noPublishedNotes: 'No notes or PDFs have been published yet.',
    resourceCheckBack: 'Check back soon for chapter study resources.', pages: 'pages', freePreview: 'Free Preview',
    downloadAllowed: 'Download Allowed', locked: 'Locked', removeBookmark: 'Remove bookmark',
    bookmarkResource: 'Bookmark resource', opening: 'Opening…', readDocument: 'Read document',
    chapterSaved: 'Chapter saved to your bookmarks.', chapterRemoved: 'Chapter removed from your bookmarks.',
    chapterPracticePending: 'Question practice will be available when this chapter’s question set is published.',
    signInToBookmark: 'Sign in to save bookmarks to your account.', signInToStartTest: 'Sign in to begin and save your test attempt.',
    toolboxTitle: 'Study toolbox', toolboxDescription: 'Focus deeply, revise smarter and keep your saved learning close.',
    focusSession: 'FOCUS SESSION', restInterval: 'REST INTERVAL', oneThing: 'One thing at a time.',
    mindfulBreak: 'Take a mindful break.', focusSprint: 'A focused 25-minute sprint, then a short reset.',
    breakDescription: 'Five minutes to stretch, breathe and reset.', pause: 'Pause', startFocus: 'Start focus',
    reset: 'Reset', study25: '25 min study', break5: '5 min break', focusSessions: 'focus sessions completed',
    focusSessionCompleted: 'focus session completed', quickRevision: 'QUICK REVISION',
    formulaSheets: 'Formula & revision sheets', highYield: 'High-yield', bookmarked: 'Bookmarked',
    loadingSheets: 'Loading revision sheets…', noRevisionSheets: 'No revision sheets yet.',
    revisionEmpty: 'High-yield notes and your bookmarked sheets will appear here.',
    savedForLater: 'SAVED FOR LATER', savedBookmarks: 'Saved bookmarks', saved: 'saved',
    loadingBookmarks: 'Loading bookmarks…', bookmarksEmpty: 'Your bookmarks will appear here.',
    bookmarkHint: 'Save a chapter or reference sheet to find it quickly next time.',
    question: 'Question', studyResource: 'Study resource', chapter: 'Chapter',
    timerLocalNote: 'Your focused study sessions stay on this device.',
    secureCheckout: 'SECURE CHECKOUT', unlockLearningPath: 'Unlock your learning path',
    localPreview: 'LOCAL CHECKOUT PREVIEW', accessUnlocked: 'ACCESS UNLOCKED',
    previewComplete: 'Checkout preview complete.', readyToBegin: 'You’re ready to begin.',
    noPaymentMade: 'No payment was made and no access was granted. Configure Razorpay and the server payment RPCs to test a real purchase.',
    paymentVerified: 'Your payment was verified and your learning access is active.',
    closePreview: 'Close preview', continueLearning: 'Continue learning',
    preparingCheckout: 'Preparing your wallet and discount rules…', basePrice: 'Base price',
    redeemCoins: 'Redeem Zyvra Coins', balance: 'Balance', coinsEqualsRupee: 'coins = ₹1',
    coinsUsed: 'Coins used', discount: 'Discount', upToDiscount: 'Up to',
    payableNow: 'Payable now', purchasesPaused: 'Purchases are temporarily paused by the platform.',
    verifyingCheckout: 'Verifying checkout…', continuePayment: 'Continue to payment',
    paymentVerification: 'Payment verification and access activation are completed securely.',
    closeCheckout: 'Close checkout', signInToPurchase: 'Sign in to purchase learning access.',
    purchasesPausedShort: 'Purchases paused'
  },
  hi: {
    home: 'होम', explore: 'खोजें', tests: 'टेस्ट', toolbox: 'टूलबॉक्स', profile: 'प्रोफ़ाइल',
    exploreExams: 'परीक्षाएँ खोजें', purchases: 'मेरी खरीदारी', analytics: 'प्रदर्शन और विश्लेषण',
    bookmarks: 'बुकमार्क', wallet: 'कॉइन वॉलेट', planner: 'अध्ययन योजना', notifications: 'सूचनाएँ',
    profileSettings: 'प्रोफ़ाइल और सेटिंग्स',
    welcome: 'आपको देखकर अच्छा लगा', ready: 'अगले अध्ययन सत्र के लिए तैयार हैं?',
    continue: 'पढ़ाई जारी रखें', dailyGoal: 'दैनिक लक्ष्य', streak: 'अध्ययन स्ट्रीक',
    quickActions: 'त्वरित विकल्प', recentActivity: 'हाल की गतिविधि',
    recommended: 'आपके लिए अभ्यास', coins: 'ज़ीव्रा कॉइन्स', install: 'ऐप इंस्टॉल करें',
    signIn: 'साइन इन', signOut: 'साइन आउट', settings: 'सेटिंग्स', adminPanel: 'एडमिन पैनल',
    greeting: 'नमस्ते', dailyTarget: 'दैनिक अध्ययन लक्ष्य', currentStreak: 'वर्तमान स्ट्रीक',
    continueShelf: 'पढ़ाई जारी रखें', resume: 'फिर शुरू करें', featuredPathways: 'चुनिंदा परीक्षा मार्ग',
    liveTests: 'लाइव टेस्ट', questionBank: 'प्रश्न बैंक', studyToolbox: 'अध्ययन टूलबॉक्स',
    myWallet: 'मेरा वॉलेट', installMessage: 'बिना रुकावट पढ़ाई और तेज़ शुरुआत के लिए ज़ीव्रा ऐप इंस्टॉल करें।',
    installNow: 'अभी इंस्टॉल करें', later: 'बाद में', installHelp: 'ज़ीव्रा को होम स्क्रीन पर जोड़ने के लिए ब्राउज़र मेनू का उपयोग करें।',
    syllabus: 'पाठ्यक्रम', testsCount: 'टेस्ट', targetReached: 'दैनिक लक्ष्य पूरा हुआ',
    minutesRemaining: 'मिनट दैनिक लक्ष्य तक', lastVisited: 'अंतिम बार देखा गया अध्याय',
    startExploring: 'जहाँ पढ़ाई छोड़ी थी, वहाँ से शुरू करने के लिए पाठ्यक्रम देखें।',
    loadingContinue: 'अगला अध्ययन चरण खोज रहे हैं…', noActiveTest: 'आपका अगला अध्ययन चरण तैयार है।',
    streakDays: 'दिन की स्ट्रीक', syllabusTags: 'पाठ्यक्रम',
    chapterContent: 'अध्याय सामग्री', paidAccess: 'भुगतान किया हुआ', freeToExplore: 'मुफ़्त में देखें',
    studyTime: 'अध्ययन समय', fullAccess: 'पूर्ण पहुँच अनलॉक करें', unlockChapterCopy: 'टेस्ट, अभ्यास और सुरक्षित सामग्री के लिए यह अध्याय खरीदें। मुफ़्त पूर्वावलोकन उपलब्ध हैं।',
    buyNow: 'अभी खरीदें', checkingAccess: 'पहुँच जाँची जा रही है…', chapterComingSoon: 'यह अध्याय जल्द उपलब्ध होगा।',
    chapterPreparing: 'अध्ययन सामग्री तैयार की जा रही है। टेस्ट, अभ्यास और नोट्स के लिए फिर आएँ।',
    backToSyllabus: 'पाठ्यक्रम पर लौटें', paidLearningPath: 'यह अध्याय सशुल्क अध्ययन मार्ग का हिस्सा है।',
    accessVerified: 'सुरक्षित सामग्री अनलॉक करने से पहले ज़ीव्रा आपकी पहुँच की पुष्टि करता है।',
    viewAccessOptions: 'पहुँच विकल्प देखें', checkUnderstanding: 'अपनी समझ जाँचें',
    chapterTests: 'अध्याय टेस्ट', available: 'उपलब्ध', testsUnavailable: 'इस भाग में टेस्ट उपलब्ध नहीं हैं।',
    chooseAnotherTab: 'जारी रखने के लिए कोई अन्य अध्ययन टैब चुनें।', unlockLiveTests: 'लाइव टेस्ट देखने के लिए यह अध्याय अनलॉक करें।',
    freePreviewsNotes: 'नोट्स और PDFs में मुफ़्त पूर्वावलोकन उपलब्ध हैं।', loadingTests: 'उपलब्ध टेस्ट लोड हो रहे हैं…',
    noPublishedTests: 'इस अध्याय के लिए अभी कोई टेस्ट प्रकाशित नहीं हुआ है।', checkBackPractice: 'अभ्यास के नए अवसर के लिए फिर आएँ।',
    attemptsUsed: 'प्रयास उपयोग हुए', limitReached: 'सीमा पूरी', startTest: 'टेस्ट शुरू करें',
    learnByDoing: 'अभ्यास से सीखें', questionPractice: 'प्रश्न अभ्यास', topicPractice: 'विषय अभ्यास',
    practiceUnavailable: 'इस भाग में प्रश्न अभ्यास उपलब्ध नहीं है।', unlockPractice: 'प्रश्न अभ्यास शुरू करने के लिए यह अध्याय अनलॉक करें।',
    reviewKeyConcepts: 'केंद्रित अभ्यास और तुरंत व्याख्या से मुख्य अवधारणाएँ दोहराएँ।',
    topicQuestions: 'विषयवार प्रश्न', ownPace: 'अपनी गति से पढ़ें', reviewExplanations: 'व्याख्याएँ देखें',
    startPractice: 'अभ्यास शुरू करें', readReviseRemember: 'पढ़ें, दोहराएँ, याद रखें', notesPdfs: 'नोट्स और PDFs',
    resources: 'संसाधन', notesUnavailable: 'इस भाग में नोट्स उपलब्ध नहीं हैं।',
    loadingResources: 'अध्याय के संसाधन लोड हो रहे हैं…', noPublishedNotes: 'अभी कोई नोट्स या PDF प्रकाशित नहीं हुए हैं।',
    resourceCheckBack: 'अध्ययन सामग्री के लिए फिर आएँ।', pages: 'पृष्ठ', freePreview: 'मुफ़्त पूर्वावलोकन',
    downloadAllowed: 'डाउनलोड उपलब्ध', locked: 'लॉक है', removeBookmark: 'बुकमार्क हटाएँ',
    bookmarkResource: 'संसाधन बुकमार्क करें', opening: 'खुल रहा है…', readDocument: 'दस्तावेज़ पढ़ें',
    chapterSaved: 'अध्याय बुकमार्क में सहेजा गया।', chapterRemoved: 'अध्याय बुकमार्क से हटाया गया।',
    chapterPracticePending: 'इस अध्याय का प्रश्न सेट प्रकाशित होने पर अभ्यास उपलब्ध होगा।',
    signInToBookmark: 'बुकमार्क सहेजने के लिए साइन इन करें।', signInToStartTest: 'टेस्ट शुरू करने और प्रयास सहेजने के लिए साइन इन करें।',
    toolboxTitle: 'अध्ययन टूलबॉक्स', toolboxDescription: 'ध्यान से पढ़ें, बेहतर दोहराएँ और सहेजी सामग्री पास रखें।',
    focusSession: 'एकाग्रता सत्र', restInterval: 'विश्राम अंतराल', oneThing: 'एक समय में एक काम।',
    mindfulBreak: 'ध्यानपूर्वक विश्राम करें।', focusSprint: '25 मिनट का एकाग्र अध्ययन, फिर छोटा विराम।',
    breakDescription: 'खिंचाव, साँस और आराम के लिए पाँच मिनट।', pause: 'रोकें', startFocus: 'ध्यान शुरू करें',
    reset: 'रीसेट', study25: '25 मिनट पढ़ाई', break5: '5 मिनट विराम', focusSessions: 'एकाग्रता सत्र पूरे',
    focusSessionCompleted: 'एकाग्रता सत्र पूरा', quickRevision: 'त्वरित दोहराव',
    formulaSheets: 'सूत्र और दोहराव शीट', highYield: 'महत्वपूर्ण', bookmarked: 'बुकमार्क किए',
    loadingSheets: 'दोहराव शीट लोड हो रही हैं…', noRevisionSheets: 'अभी दोहराव शीट उपलब्ध नहीं हैं।',
    revisionEmpty: 'महत्वपूर्ण नोट्स और बुकमार्क शीट यहाँ दिखाई देंगी।',
    savedForLater: 'बाद के लिए सहेजा', savedBookmarks: 'सहेजे बुकमार्क', saved: 'सहेजे',
    loadingBookmarks: 'बुकमार्क लोड हो रहे हैं…', bookmarksEmpty: 'आपके बुकमार्क यहाँ दिखाई देंगे।',
    bookmarkHint: 'अगली बार जल्दी पाने के लिए अध्याय या संदर्भ शीट सहेजें।',
    question: 'प्रश्न', studyResource: 'अध्ययन सामग्री', chapter: 'अध्याय',
    timerLocalNote: 'आपके एकाग्र अध्ययन सत्र इसी डिवाइस पर सहेजे जाते हैं।',
    secureCheckout: 'सुरक्षित भुगतान', unlockLearningPath: 'अपना अध्ययन मार्ग अनलॉक करें',
    localPreview: 'स्थानीय भुगतान पूर्वावलोकन', accessUnlocked: 'पहुँच अनलॉक हुई',
    previewComplete: 'भुगतान पूर्वावलोकन पूरा हुआ।', readyToBegin: 'आप शुरू करने के लिए तैयार हैं।',
    noPaymentMade: 'कोई भुगतान या पहुँच प्रदान नहीं की गई। वास्तविक खरीद के लिए Razorpay और सर्वर भुगतान RPC कॉन्फ़िगर करें।',
    paymentVerified: 'भुगतान की पुष्टि हुई और आपकी अध्ययन पहुँच सक्रिय है।',
    closePreview: 'पूर्वावलोकन बंद करें', continueLearning: 'पढ़ाई जारी रखें',
    preparingCheckout: 'वॉलेट और छूट नियम तैयार हो रहे हैं…', basePrice: 'मूल कीमत',
    redeemCoins: 'ज़ीव्रा कॉइन्स रिडीम करें', balance: 'बैलेंस', coinsEqualsRupee: 'कॉइन = ₹1',
    coinsUsed: 'उपयोग किए कॉइन', discount: 'छूट', upToDiscount: 'अधिकतम',
    payableNow: 'अभी देय', purchasesPaused: 'प्लेटफ़ॉर्म ने खरीदारी अस्थायी रूप से रोक दी है।',
    verifyingCheckout: 'भुगतान की पुष्टि हो रही है…', continuePayment: 'भुगतान जारी रखें',
    paymentVerification: 'भुगतान की पुष्टि और पहुँच सक्रियण सुरक्षित रूप से किए जाते हैं।',
    closeCheckout: 'भुगतान बंद करें', signInToPurchase: 'अध्ययन सामग्री खरीदने के लिए साइन इन करें।',
    purchasesPausedShort: 'खरीदारी रुकी हुई है'
  }
};

export function ThemeLanguageProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('zyvra-theme') || 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('zyvra-language') || 'en');

  useEffect(() => {
    const root = document.documentElement;
    const system = window.matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => {
      const light = theme === 'light' || (theme === 'system' && system.matches);
      document.body.classList.toggle('light', light);
      root.style.colorScheme = light ? 'light' : 'dark';
    };
    applyTheme();
    system.addEventListener?.('change', applyTheme);
    return () => system.removeEventListener?.('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const persistTheme = useCallback(async (nextTheme, userId) => {
    setTheme(nextTheme);
    localStorage.setItem('zyvra-theme', nextTheme);
    if (userId && supabase) {
      const { error } = await supabase.from('profiles').update({ theme: nextTheme }).eq('id', userId);
      if (error) throw error;
    }
  }, []);

  const [languageError, setLanguageError] = useState('');
  const updateLanguage = useCallback(async (nextLanguage, { syncProfile = true } = {}) => {
    if (!['en', 'hi'].includes(nextLanguage)) throw new Error('Choose English or Hindi.');
    setLanguage(nextLanguage);
    localStorage.setItem('zyvra-language', nextLanguage);
    setLanguageError('');
    if (!syncProfile || !supabase) return;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) return;
      const { error } = await supabase.from('profiles')
        .update({ preferred_language: nextLanguage }).eq('id', session.user.id);
      if (error) throw error;
    } catch (error) {
      setLanguageError(error.message || 'Language preference could not be synced to your profile.');
      throw error;
    }
  }, []);

  const value = useMemo(() => ({
    theme, setTheme: persistTheme, language, setLanguage: updateLanguage, languageError,
    t: (key) => translations[language]?.[key] || translations.en[key] || key
  }), [theme, language, languageError, persistTheme, updateLanguage]);

  return <ThemeLanguageContext.Provider value={value}>{children}</ThemeLanguageContext.Provider>;
}

export function useThemeLanguage() {
  const context = useContext(ThemeLanguageContext);
  if (!context) throw new Error('useThemeLanguage must be used within ThemeLanguageProvider');
  return context;
}
