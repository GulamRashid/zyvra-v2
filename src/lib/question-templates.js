export const SAMPLE_QUESTIONS = [
  {
    question_type: 'mcq',
    question_text: 'Which article of the Indian Constitution guarantees Equality Before Law?',
    question_text_hi: 'भारतीय संविधान का कौन-सा अनुच्छेद विधि के समक्ष समता की गारंटी देता है?',
    options: [
      { en: 'Article 12', hi: 'अनुच्छेद 12' },
      { en: 'Article 14', hi: 'अनुच्छेद 14' },
      { en: 'Article 19', hi: 'अनुच्छेद 19' },
      { en: 'Article 21', hi: 'अनुच्छेद 21' }
    ],
    correct_answer: 'B',
    explanation: 'Article 14 guarantees equality before law and equal protection of the laws.',
    explanation_hi: 'अनुच्छेद 14 विधि के समक्ष समता और विधियों के समान संरक्षण की गारंटी देता है।',
    distractor_notes: {
      A: 'Defines the State.',
      C: 'Guarantees six basic democratic freedoms.',
      D: 'Protects life and personal liberty.'
    },
    subject: 'Polity',
    difficulty: 'easy',
    usage_scope: 'both',
    chapter_id: 'replace-with-chapter-uuid',
    tags: ['constitution', 'fundamental-rights']
  },
  {
    question_type: 'mcq',
    question_text: 'Who among the following founded the ancient Nalanda University in Bihar?',
    question_text_hi: 'निम्नलिखित में से किसने बिहार में प्राचीन नालंदा विश्वविद्यालय की स्थापना की थी?',
    options: [
      { en: 'Chandragupta II', hi: 'चन्द्रगुप्त द्वितीय' },
      { en: 'Samudragupta', hi: 'समुद्रगुप्त' },
      { en: 'Kumaragupta I', hi: 'कुमारगुप्त प्रथम' },
      { en: 'Harshavardhana', hi: 'हर्षवर्धन' },
      { en: 'None of the above / More than one of the above', hi: 'उपर्युक्त में से कोई नहीं / उपर्युक्त में से एक से अधिक' }
    ],
    correct_answer: 'C',
    explanation: 'Nalanda University was founded by Gupta Emperor Kumaragupta I in the 5th century CE.',
    explanation_hi: 'नालंदा विश्वविद्यालय की स्थापना 5वीं शताब्दी ईस्वी में गुप्त सम्राट कुमारगुप्त प्रथम ने की थी।',
    distractor_notes: {
      A: 'Adopted the title Vikramaditya.',
      B: 'Known as the Napoleon of India.',
      D: 'Patronized Nalanda later, but was not its founder.',
      E: 'Option C is uniquely correct.'
    },
    subject: 'History',
    difficulty: 'medium',
    usage_scope: 'both',
    chapter_id: 'replace-with-chapter-uuid',
    tags: ['history', 'ancient', 'bpsc', 'nalanda']
  },
  {
    question_type: 'statement',
    question_text: 'Consider the following statements regarding the Indus Valley Civilization: | (1) Harappa was located on the banks of River Ravi. | (2) Lothal was an important dockyard and port city. | Which of the statements given above is/are correct?',
    question_text_hi: 'सिंधु घाटी सभ्यता के संदर्भ में निम्नलिखित कथनों पर विचार कीजिए: | (1) हड़प्पा रावी नदी के तट पर स्थित था। | (2) लोथल एक प्रमुख गोदीबाड़ा (डॉकयार्ड) और बंदरगाह शहर था। | उपर्युक्त कथनों में से कौन-सा/से सही है/हैं?',
    options: [
      { en: '1 only', hi: 'केवल 1' },
      { en: '2 only', hi: 'केवल 2' },
      { en: 'Both 1 and 2', hi: '1 और 2 दोनों' },
      { en: 'Neither 1 nor 2', hi: 'न तो 1 और न ही 2' }
    ],
    correct_answer: 'C',
    explanation: 'Both statements are correct. Harappa was situated along the Ravi river in Punjab (Pakistan) and Lothal was a major dockyard port in Gujarat.',
    explanation_hi: 'दोनों कथन सही हैं। हड़प्पा पंजाब (पाकिस्तान) में रावी नदी के तट पर स्थित था और लोथल गुजरात में एक प्रमुख बंदरगाह था।',
    distractor_notes: {
      A: 'Statement 2 is also correct.',
      B: 'Statement 1 is also correct.',
      D: 'Both statements 1 and 2 are historically verified.'
    },
    subject: 'History',
    difficulty: 'medium',
    usage_scope: 'both',
    chapter_id: 'replace-with-chapter-uuid',
    tags: ['history', 'ancient', 'indus-valley']
  },
  {
    question_type: 'statement',
    question_text: 'Assertion (A): The President of India is elected indirectly by an electoral college. | Reason (R): India has adopted the Parliamentary system of government where the President is the nominal executive. | Choose the correct code:',
    question_text_hi: 'अभिकथन (A): भारत के राष्ट्रपति का चुनाव एक निर्वाचक मंडल द्वारा अप्रत्यक्ष रूप से होता है। | कारण (R): भारत ने सरकार की संसदीय प्रणाली को अपनाया है जहाँ राष्ट्रपति नाममात्र का कार्यकारी होता है। | सही कूट का चयन कीजिए:',
    options: [
      { en: 'Both (A) and (R) are true and (R) is the correct explanation of (A)', hi: '(A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है' },
      { en: 'Both (A) and (R) are true but (R) is not the correct explanation of (A)', hi: '(A) और (R) दोनों सही हैं लेकिन (R), (A) की सही व्याख्या नहीं है' },
      { en: '(A) is true but (R) is false', hi: '(A) सही है लेकिन (R) गलत है' },
      { en: '(A) is false but (R) is true', hi: '(A) गलत है लेकिन (R) सही है' }
    ],
    correct_answer: 'A',
    explanation: "Both (A) and (R) are correct. India's parliamentary democracy establishes the President as the nominal head, chosen through indirect election by representatives.",
    explanation_hi: 'दोनों (A) और (R) सही हैं। भारत का संसदीय लोकतंत्र राष्ट्रपति को नाममात्र का प्रमुख स्थापित करता है, जिसे प्रतिनिधियों द्वारा अप्रत्यक्ष रूप से चुना जाता है।',
    distractor_notes: {
      B: 'Reason (R) directly explains why the head of state is indirectly elected in a cabinet system.',
      C: 'Reason (R) is true under Article 53 and Article 74.',
      D: 'Assertion (A) is true under Article 54.'
    },
    subject: 'Polity',
    difficulty: 'hard',
    usage_scope: 'both',
    chapter_id: 'replace-with-chapter-uuid',
    tags: ['polity', 'president', 'assertion-reason']
  },
  {
    question_type: 'matching',
    question_text: 'Match Column I with Column II: | Column I: (1) Harappa (2) Mohenjodaro (3) Lothal (4) Kalibangan | Column II: (A) Ravi (B) Indus (C) Bhogava (D) Ghaggar | Choose the correct matching:',
    question_text_hi: 'स्तंभ I को स्तंभ II से सुमेलित कीजिए: | स्तंभ I: (1) हड़प्पा (2) मोहनजोदड़ो (3) लोथल (4) कालीबंगा | स्तंभ II: (A) रावी (B) सिंधु (C) भोगवा (D) घग्गर | सही मिलान चुनिए:',
    options: [
      { en: '1-A, 2-B, 3-C, 4-D', hi: '1-A, 2-B, 3-C, 4-D' },
      { en: '1-B, 2-A, 3-D, 4-C', hi: '1-B, 2-A, 3-D, 4-C' },
      { en: '1-C, 2-D, 3-A, 4-B', hi: '1-C, 2-D, 3-A, 4-B' },
      { en: '1-D, 2-C, 3-B, 4-A', hi: '1-D, 2-C, 3-B, 4-A' }
    ],
    correct_answer: 'A',
    explanation: 'Harappa is located on River Ravi, Mohenjodaro on the Indus, Lothal on the Bhogava, and Kalibangan on the Ghaggar river.',
    explanation_hi: 'हड़प्पा रावी नदी पर, मोहनजोदड़ो सिंधु पर, लोथल भोगवा पर और कालीबंगा घग्गर नदी पर स्थित है।',
    distractor_notes: {
      B: 'Harappa is on Ravi, not Indus.',
      C: 'Harappa is on Ravi, not Bhogava.',
      D: 'Harappa is on Ravi, not Ghaggar.'
    },
    subject: 'History',
    difficulty: 'hard',
    usage_scope: 'both',
    chapter_id: 'replace-with-chapter-uuid',
    tags: ['history', 'ancient', 'matching']
  }
];

export const JSON_TEMPLATE = JSON.stringify(SAMPLE_QUESTIONS, null, 2);

export const CSV_TEMPLATE = `question_type,question_en,question_hi,option_a_en,option_a_hi,option_b_en,option_b_hi,option_c_en,option_c_hi,option_d_en,option_d_hi,option_e_en,option_e_hi,correct_answer,subject,difficulty,usage_scope,chapter_id,explanation_en,explanation_hi,tags
mcq,"Which article of the Indian Constitution guarantees Equality Before Law?","भारतीय संविधान का कौन-सा अनुच्छेद विधि के समक्ष समता की गारंटी देता है?","Article 12","अनुच्छेद 12","Article 14","अनुच्छेद 14","Article 19","अनुच्छेद 19","Article 21","अनुच्छेद 21","","","B","Polity","easy","both","replace-with-chapter-uuid","Article 14 guarantees equality before law and equal protection of the laws.","अनुच्छेद 14 विधि के समक्ष समता और विधियों के समान संरक्षण की गारंटी देता है।","constitution,fundamental-rights"
mcq,"Who among the following founded the ancient Nalanda University in Bihar?","निम्नलिखित में से किसने बिहार में प्राचीन नालंदा विश्वविद्यालय की स्थापना की थी?","Chandragupta II","चन्द्रगुप्त द्वितीय","Samudragupta","समुद्रगुप्त","Kumaragupta I","कुमारगुप्त प्रथम","Harshavardhana","हर्षवर्धन","None of the above / More than one of the above","उपर्युक्त में से कोई नहीं / उपर्युक्त में से एक से अधिक","C","History","medium","both","replace-with-chapter-uuid","Nalanda University was founded by Gupta Emperor Kumaragupta I in the 5th century CE.","नालंदा विश्वविद्यालय की स्थापना 5वीं शताब्दी ईस्वी में गुप्त सम्राट कुमारगुप्त प्रथम ने की थी।","history,ancient,bpsc,nalanda"
statement,"Consider the following statements regarding the Indus Valley Civilization: | (1) Harappa was located on the banks of River Ravi. | (2) Lothal was an important dockyard and port city. | Which of the statements given above is/are correct?","सिंधु घाटी सभ्यता के संदर्भ में निम्नलिखित कथनों पर विचार कीजिए: | (1) हड़प्पा रावी नदी के तट पर स्थित था। | (2) लोथल एक प्रमुख गोदीबाड़ा (डॉकयार्ड) और बंदरगाह शहर था। | उपर्युक्त कथनों में से कौन-सा/से सही है/हैं?","1 only","केवल 1","2 only","केवल 2","Both 1 and 2","1 और 2 दोनों","Neither 1 nor 2","न तो 1 और न ही 2","","","C","History","medium","both","replace-with-chapter-uuid","Both statements are correct. Harappa was situated along the Ravi river in Punjab (Pakistan) and Lothal was a major dockyard port in Gujarat.","दोनों कथन सही हैं। हड़प्पा पंजाब (पाकिस्तान) में रावी नदी के तट पर स्थित था और लोथल गुजरात में एक प्रमुख बंदरगाह था।","history,ancient,indus-valley"
statement,"Assertion (A): The President of India is elected indirectly by an electoral college. | Reason (R): India has adopted the Parliamentary system of government where the President is the nominal executive. | Choose the correct code:","अभिकथन (A): भारत के राष्ट्रपति का चुनाव एक निर्वाचक मंडल द्वारा अप्रत्यक्ष रूप से होता है। | कारण (R): भारत ने सरकार की संसदीय प्रणाली को अपनाया है जहाँ राष्ट्रपति नाममात्र का कार्यकारी होता है। | सही कूट का चयन कीजिए:","Both (A) and (R) are true and (R) is the correct explanation of (A)","(A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है","Both (A) and (R) are true but (R) is not the correct explanation of (A)","(A) और (R) दोनों सही हैं लेकिन (R), (A) की सही व्याख्या नहीं है","(A) is true but (R) is false","(A) सही है लेकिन (R) गलत है","(A) is false but (R) is true","(A) गलत है लेकिन (R) सही है","","","A","Polity","hard","both","replace-with-chapter-uuid","Both (A) and (R) are correct. India's parliamentary democracy establishes the President as the nominal head, chosen through indirect election by representatives.","दोनों (A) और (R) सही हैं। भारत का संसदीय लोकतंत्र राष्ट्रपति को नाममात्र का प्रमुख स्थापित करता है, जिसे प्रतिनिधियों द्वारा अप्रत्यक्ष रूप से चुना जाता है।","polity,president,assertion-reason"
matching,"Match Column I with Column II: | Column I: (1) Harappa (2) Mohenjodaro (3) Lothal (4) Kalibangan | Column II: (A) Ravi (B) Indus (C) Bhogava (D) Ghaggar | Choose the correct matching:","स्तंभ I को स्तंभ II से सुमेलित कीजिए: | स्तंभ I: (1) हड़प्पा (2) मोहनजोदड़ो (3) लोथल (4) कालीबंगा | स्तंभ II: (A) रावी (B) सिंधु (C) भोगवा (D) घग्गर | सही मिलान चुनिए:","1-A, 2-B, 3-C, 4-D","1-A, 2-B, 3-C, 4-D","1-B, 2-A, 3-D, 4-C","1-B, 2-A, 3-D, 4-C","1-C, 2-D, 3-A, 4-B","1-C, 2-D, 3-A, 4-B","1-D, 2-C, 3-B, 4-A","1-D, 2-C, 3-B, 4-A","","","A","History","hard","both","replace-with-chapter-uuid","Harappa is located on River Ravi, Mohenjodaro on the Indus, Lothal on the Bhogava, and Kalibangan on the Ghaggar river.","हड़प्पा रावी नदी पर, मोहनजोदड़ो सिंधु पर, लोथल भोगवा पर और कालीबंगा घग्गर नदी पर स्थित है।","history,ancient,matching"`;

export const AI_CSV_GENERATION_PROMPT = `You are an expert exam question author for the Zyvra competitive exam platform.
Generate a valid CSV with exactly the following columns:
question_type,question_en,question_hi,option_a_en,option_a_hi,option_b_en,option_b_hi,option_c_en,option_c_hi,option_d_en,option_d_hi,option_e_en,option_e_hi,correct_answer,subject,difficulty,usage_scope,chapter_id,explanation_en,explanation_hi,tags

Rules & Supported Question Types:
1. question_type: 'mcq', 'statement', or 'matching'.
2. Standard 4-Option MCQ:
   - question_en: Direct question text.
   - question_hi: Accurate Hindi translation.
   - 4 distinct options (A, B, C, D) in English and Hindi. Leave option_e_en and option_e_hi empty ("").
3. BPSC / State PCS 5-Option MCQ:
   - 5 options (A, B, C, D, E) in English and Hindi.
   - option_e_en: "None of the above / More than one of the above"
   - option_e_hi: "उपर्युक्त में से कोई नहीं / उपर्युक्त में से एक से अधिक"
4. Multi-Statement Questions:
   - question_en: "Consider the following statements: | (1) [Statement 1] | (2) [Statement 2] | Which of the statements given above is/are correct?"
   - question_hi: "निम्नलिखित कथनों पर विचार कीजिए: | (1) [कथन 1] | (2) [कथन 2] | उपर्युक्त कथनों में से कौन-सा/से सही है/हैं?"
   - Options: (A) 1 only / केवल 1, (B) 2 only / केवल 2, (C) Both 1 and 2 / 1 और 2 दोनों, (D) Neither 1 nor 2 / न तो 1 और न ही 2. Leave option_e empty.
5. Assertion & Reason Questions:
   - question_en: "Assertion (A): [Assertion text] | Reason (R): [Reason text] | Choose the correct code:"
   - question_hi: "अभिकथन (A): [अभिकथन पाठ] | कारण (R): [कारण पाठ] | सही कूट का चयन कीजिए:"
   - Options: Standard codes for (A) and (R) relationship. Leave option_e empty.
6. Match the Following:
   - question_en: "Match Column I with Column II: | Column I: (1) [Item 1] (2) [Item 2] (3) [Item 3] (4) [Item 4] | Column II: (A) [Item A] (B) [Item B] (C) [Item C] (D) [Item D] | Choose the correct matching:"
   - question_hi: "स्तंभ I को स्तंभ II से सुमेलित कीजिए: | स्तंभ I: (1) [मद 1] (2) [मद 2] (3) [मद 3] (4) [मद 4] | स्तंभ II: (A) [मद A] (B) [मद B] (C) [मद C] (D) [मद D] | सही मिलान चुनिए:"
   - Options: Standard permutation codes like (A) 1-A, 2-B, 3-C, 4-D, etc. Leave option_e empty.
7. General Formatting Rules:
   - All fields containing commas, quotes, or line breaks MUST be wrapped in double quotes. Inner double quotes must be escaped as ("").
   - correct_answer: Single letter matching an option (A, B, C, D, or E).
   - difficulty: easy, medium, or hard.
   - usage_scope: both, practice_only, or test_only.
   - chapter_id: UUID of the target chapter.`;
