import { createClient } from '@supabase/supabase-js';
import { getPaymentAdminClient, parseRequestBody, sanitizeErrorMessage, sendJson } from './_payment.js';

function getBearerToken(req) {
  const authorization =
    (typeof req?.headers?.get === 'function' ? req.headers.get('authorization') : null) ||
    req?.headers?.authorization ||
    req?.headers?.Authorization ||
    '';
  return authorization.trim().match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

// AI Bot Knowledge Base & Auto-Responder
function generateBotReply(userMessage, preferredLang = null) {
  const text = String(userMessage || '').toLowerCase();
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hindiKeywords = /hai|nahi|nhi|kahan|kripya|paisa|paise|kata|kaise|karein|karna|kare|kya|mera|meri|mujhe|kharida|batayein|chahiye|sawal|madad|baat|dhanyawad|namaste|sahayak|sikke|batao/i;
  const isHindiText = hasDevanagari || hindiKeywords.test(text);

  // If user selected preferred language 'en', or didn't specify and message is English without Hindi keywords:
  const isEn = preferredLang === 'en' || (preferredLang !== 'hi' && !isHindiText);

  // 1. Payment / Unlock / Money cut
  if (/payment|paisa|paise|kata|cut|debit|unlock|unlocked|order|active nahi|activate|kharida|buy|purchas|पेमेंट|पैसे|पैसा|कटा|काट|अनलॉक|खरीद/i.test(text)) {
    return {
      reply: isEn
        ? 'If payment was deducted from your account, please do not worry! Bank payment confirmation typically takes 1 to 2 minutes.\n\n👉 Step 1: Tap "🎓 My Courses" in the bottom navigation and click the "Refresh" button at the top.\n👉 Step 2: If your access remains locked, please reply here with your Razorpay Payment ID or Order ID.\n\n✅ Our admin team has also been alerted with high priority to assist you.'
        : 'अगर आपका पेमेंट कट गया है तो बिल्कुल चिंता न करें! बैंक वेरिफिकेशन में आमतौर पर 1-2 मिनट का समय लगता है।\n\n👉 कदम 1: नीचे नेविगेशन में "🎓 My Courses" (मेरे कोर्सेज) पेज पर जाएं और ऊपर "रिफ्रेश (Refresh)" बटन दबाएं।\n👉 कदम 2: यदि फिर भी पास एक्टिवेट न दिखे, तो कृपया अपना Razorpay Order ID या पेमेंट स्क्रीनशॉट डिटेल यहाँ लिखें।\n\n✅ मैंने आपकी रिक्वेस्ट एडमिन टीम को भी प्राथमिकता पर भेज दी है।',
      needs_admin: true
    };
  }

  // 2. Where are my bought courses/folders
  if (/kahan|folder|course|subject|syllabus|mila nahi|show nahi|access|where|कहाँ|कहा|फोल्डर|कोर्स|विषय|सिलेबस|कंटेंट/i.test(text)) {
    return {
      reply: isEn
        ? 'All your purchased exams, courses, and study materials are available under "🎓 My Courses" (or /purchases) in the bottom navigation bar.\n\n👉 Tap any course card to access all its organized subject folders, PDFs, notes, and tests!'
        : 'आपके सभी खरीदे हुए कोर्सेज और स्टडी मटीरियल्स नीचे नेविगेशन बार में "🎓 My Courses" (या /purchases) में उपलब्ध हैं।\n\n👉 कोर्स कार्ड पर क्लिक करने पर उसके अंदर के सभी सब्जेक्ट्स (फोल्डर्स), पीडीएफ नोट्स और टेस्ट्स क्रमबद्ध रूप में मिल जाएंगे!',
      needs_admin: false
    };
  }

  // 3. Coins / Rewards / Referral
  if (/coin|coins|sikke|point|refer|referral|bonus|redeem|discount|reward|कॉइन|सिक्के|सिक्का|रेफरल|बोनस|रिडीम|छूट/i.test(text)) {
    return {
      reply: isEn
        ? 'About Zyvra Coins & Rewards:\n\n🪙 How to earn:\n1. Share your referral code with friends (50 Coins per friend who registers).\n2. Score 70%+ in mock test series.\n\n💰 How to redeem:\nDuring checkout, 10 Coins = ₹1 instant discount!\nYou can check your live coin balance in the "Wallet" tab anytime.'
        : 'ज़ीव्रा कॉइन्स और रिवार्ड्स की जानकारी:\n\n🪙 कॉइन्स कैसे कमाएं:\n1. दोस्तों को अपना रेफरल कोड शेयर करें (प्रति दोस्त साइनअप पर 50 कॉइन्स)।\n2. मॉक टेस्ट्स में 70%+ स्कोर करें।\n\n💰 कॉइन्स कैसे इस्तेमाल करें:\nचेकआउट के समय 10 Coins = ₹1 का तुरंत डिस्काउंट मिलता है!\nअपना कॉइन बैलेंस आप "Wallet" टैब में देख सकते हैं।',
      needs_admin: false
    };
  }

  // 4. Validity / Expiry / Full Pass
  if (/validity|expire|expiry|valid|saal|year|renew|full pass|pass|duration|वैधता|समाप्त|एक्सपायरी|पास|साल|दिन/i.test(text)) {
    return {
      reply: isEn
        ? 'Zyvra Pass & Validity information:\n\n⭐ All-Access Full Pass: 365 days (1 full year) of unlimited access to all exams, tests, and 6 pro revision tools.\n⭐ Single Subject Folders: Accessible throughout your course validity period.\nYour exact validity date is displayed alongside your Digital Student ID in the Profile section.'
        : 'ज़ीव्रा पास और वैधता (Validity) की जानकारी:\n\n⭐ ऑल-एक्सेस फुल पास: 365 दिन (1 पूरा साल) के लिए सभी एग्जाम्स, मॉक टेस्ट और 6 प्रो रिवीजन टूल्स अनलिमिटेड अनलॉक रहते हैं।\n⭐ सिंगल सब्जेक्ट फोल्डर्स: कोर्स वैलिडिटी तक हमेशा सुलभ रहते हैं।\nआपकी सटीक एक्सपायरी तारीख प्रोफाइल सेक्शन में आपके डिजिटल आईडी कार्ड पर लिखी है।',
      needs_admin: false
    };
  }

  // 5. Test series / Questions / Scorecard / Solution
  if (/test|mock|quiz|score|marks|rank|solution|answer|submit|टेस्ट|मॉक|क्विज|नंबर|अंक|रैंक|उत्तर|सॉल्यूशन|हल/i.test(text)) {
    return {
      reply: isEn
        ? 'Mock Tests & Test Series information:\n\n📝 Detailed scorecard, All-India rank, percentile, and solutions with explanations are generated instantly upon submitting your test.\n📝 If the app closes accidentally during an exam, you can seamlessly resume from the Homepage via the "Resume" button.'
        : 'मॉक टेस्ट और टेस्ट सीरीज की जानकारी:\n\n📝 टेस्ट सबमिट करते ही आपको तुरंत डिटेल्ड स्कोरकार्ड, ऑल-इंडिया रैंक, पर्सेंटाइल और सम्पूर्ण हल (Solutions) मिलते हैं।\n📝 यदि टेस्ट के दौरान ऐप गलती से बंद हो जाए, तो होमपेज पर "Resume" बटन से वहीं से जारी रख सकते हैं।',
      needs_admin: false
    };
  }

  // 6. Request for human / admin help
  if (/admin|human|insan|agent|baat|help|sahayata|call|madad|urgent|problem|contact|एडमिन|मदद|सहायता|इंसान|बात|संपर्क/i.test(text)) {
    return {
      reply: isEn
        ? 'Certainly! Your support request has been prioritized for our Admin Help Desk 🚀.\n\nAn admin will reply directly in this chat shortly. Please describe your issue along with your order or contact details below.'
        : 'बिल्कुल! आपका टिकट एडमिन हेल्प डेस्क को प्राथमिकता पर भेज दिया गया है 🚀।\n\nएडमिन जल्द ही आपसे इसी चैट में कनेक्ट करेंगे। कृपया अपना सवाल और आर्डर या संपर्क डिटेल नीचे लिख दें।',
      needs_admin: true
    };
  }

  // Default general fallback
  return {
    reply: isEn
      ? 'Hello! We have logged your message and notified our support team 🚀.\n\nIf you have a query about a specific test, payment, or course, please share more details here so we can assist you quickly.'
      : 'नमस्ते! मैंने आपका संदेश नोट कर लिया है और सपोर्ट टीम को फॉरवर्ड कर दिया है 🚀।\n\nयदि किसी विशेष टेस्ट, पेमेंट या कोर्स के बारे में सवाल है, तो कृपया थोड़ा विस्तार से लिखें ताकि हम तुरंत मदद कर सकें।',
    needs_admin: true
  };
}

// Storage helpers using public.platform_settings (always available)
async function getChatStore(adminClient, userId) {
  const storeKey = `support_chat:${userId}`;
  const { data } = await adminClient
    .from('platform_settings')
    .select('value, setting_value')
    .or(`key.eq.${storeKey},setting_key.eq.${storeKey}`)
    .maybeSingle();

  const record = data?.setting_value || data?.value;
  if (record && typeof record === 'object' && record.thread) {
    return record;
  }
  return null;
}

async function saveChatStore(adminClient, userId, storeData) {
  const storeKey = `support_chat:${userId}`;
  const payload = {
    key: storeKey,
    setting_key: storeKey,
    value: storeData,
    setting_value: storeData,
    updated_at: new Date().toISOString()
  };

  const { error } = await adminClient
    .from('platform_settings')
    .upsert(payload, { onConflict: 'setting_key' });

  if (error) {
    await adminClient
      .from('platform_settings')
      .upsert(payload, { onConflict: 'key' });
  }
}

export async function handleSupportChat(req, res) {
  const isWebStandard = typeof res === 'undefined' || typeof res?.status !== 'function';
  const respond = (status, payload) => {
    if (isWebStandard) {
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    sendJson(res, status, payload);
  };

  const method = req?.method || 'POST';
  if (method !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return respond(401, { error: 'Authentication required for support chat.' });
    }

    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!url || !anonKey) {
      return respond(500, { error: 'Supabase configuration is missing.' });
    }

    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    const { data: userData, error: userError } = await client.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return respond(401, { error: 'Session is invalid or expired.' });
    }

    const user = userData.user;
    const adminClient = getPaymentAdminClient();

    // Check if caller is admin
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = ['admin', 'super_admin'].includes(profile?.role);
    const body = await parseRequestBody(req);
    const action = body.action || 'get_thread';

    /* ============================================================ */
    /* ACTION 1: GET THREAD & MESSAGES                             */
    /* ============================================================ */
    if (action === 'get_thread') {
      // STUDENT VIEW
      if (!isAdmin) {
        let store = await getChatStore(adminClient, user.id);

        if (!store) {
          const userName = profile?.full_name || user.user_metadata?.full_name || 'Student';
          const userEmail = profile?.email || user.email || '';
          const isEn = body.language === 'en';
          store = {
            thread: {
              id: user.id,
              user_id: user.id,
              user_name: userName,
              user_email: userEmail,
              status: 'open',
              last_message: isEn ? 'Chat initialized with Zyvra AI Assistant' : 'ज़ीव्रा AI सहायक के साथ चैट शुरू हुई',
              last_message_at: new Date().toISOString(),
              unread_admin_count: 0,
              unread_user_count: 0,
              needs_admin: false,
              created_at: new Date().toISOString()
            },
            messages: [
              {
                id: `welcome-${Date.now()}`,
                sender_role: 'bot',
                sender_name: isEn ? 'Zyvra AI Assistant 🤖' : 'Zyvra AI Sahayak 🤖',
                message: isEn
                  ? `Hello ${userName.split(' ')[0]}! I am Zyvra AI Assistant 🤖.\nHow can I help you today? Please type your query below or tap any quick topic above.`
                  : `नमस्ते ${userName.split(' ')[0]}! मैं ज़ीव्रा AI सहायक हूँ 🤖।\nआपकी क्या मदद कर सकता हूँ? कृपया अपना सवाल लिखें या ऊपर दिए गए विषय पर टैप करें।`,
                created_at: new Date().toISOString()
              }
            ]
          };
          await saveChatStore(adminClient, user.id, store);
        } else if (store.thread.unread_user_count > 0) {
          store.thread.unread_user_count = 0;
          await saveChatStore(adminClient, user.id, store);
        }

        return respond(200, {
          success: true,
          thread: store.thread,
          messages: store.messages || []
        });
      }

      // ADMIN VIEW: Specific Thread
      const targetUserId = body.thread_id || body.user_id;
      if (targetUserId) {
        const store = await getChatStore(adminClient, targetUserId);
        if (store) {
          if (store.thread.unread_admin_count > 0) {
            store.thread.unread_admin_count = 0;
            await saveChatStore(adminClient, targetUserId, store);
          }
          return respond(200, {
            success: true,
            thread: store.thread,
            messages: store.messages || []
          });
        }
        return respond(404, { error: 'Conversation not found.' });
      }

      // ADMIN VIEW: List All Student Conversations
      const { data: rows } = await adminClient
        .from('platform_settings')
        .select('*')
        .or('key.ilike.support_chat:%,setting_key.ilike.support_chat:%')
        .order('updated_at', { ascending: false });

      const threads = (rows || [])
        .map((r) => (r.setting_value || r.value)?.thread)
        .filter(Boolean)
        .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));

      return respond(200, { success: true, threads });
    }

    /* ============================================================ */
    /* ACTION 2: SEND MESSAGE                                      */
    /* ============================================================ */
    if (action === 'send_message') {
      const rawMsg = String(body.message || '').trim();
      if (!rawMsg) {
        return respond(400, { error: 'Message cannot be empty.' });
      }

      // If ADMIN is sending reply to a student
      if (isAdmin) {
        const targetUserId = body.thread_id || body.user_id;
        if (!targetUserId) {
          return respond(400, { error: 'Target user ID / thread ID is required.' });
        }

        let store = await getChatStore(adminClient, targetUserId);
        if (!store) {
          return respond(404, { error: 'Target thread not found.' });
        }

        const now = new Date().toISOString();
        const adminMsg = {
          id: `msg-${Date.now()}`,
          sender_id: user.id,
          sender_role: 'admin',
          sender_name: profile?.full_name || 'Zyvra Support Team',
          message: rawMsg,
          created_at: now
        };

        store.messages = [...(store.messages || []), adminMsg];
        store.thread.last_message = `Admin: ${rawMsg.slice(0, 80)}`;
        store.thread.last_message_at = now;
        store.thread.unread_user_count = (store.thread.unread_user_count || 0) + 1;
        store.thread.unread_admin_count = 0;
        store.thread.needs_admin = false; // Admin responded

        await saveChatStore(adminClient, targetUserId, store);

        return respond(200, {
          success: true,
          message: adminMsg,
          thread: store.thread
        });
      }

      // If STUDENT is sending a message
      let store = await getChatStore(adminClient, user.id);
      const userName = profile?.full_name || user.user_metadata?.full_name || 'Student';
      const userEmail = profile?.email || user.email || '';

      if (!store) {
        store = {
          thread: {
            id: user.id,
            user_id: user.id,
            user_name: userName,
            user_email: userEmail,
            status: 'open',
            unread_admin_count: 0,
            unread_user_count: 0,
            created_at: new Date().toISOString()
          },
          messages: []
        };
      }

      const now = new Date().toISOString();
      const userMsg = {
        id: `msg-${Date.now()}`,
        sender_id: user.id,
        sender_role: 'user',
        sender_name: userName,
        message: rawMsg,
        created_at: now
      };

      store.messages = [...(store.messages || []), userMsg];

      // Auto Bot Analysis & Instant Response
      const userLang = body.language || (body.lang === 'en' ? 'en' : body.lang === 'hi' ? 'hi' : null);
      const botResult = generateBotReply(rawMsg, userLang);
      const isEnBot = userLang === 'en' || (userLang !== 'hi' && !/[\u0900-\u097F]/.test(rawMsg) && !/hai|nahi|kahan|paisa|kaise|mera|mujhe/i.test(rawMsg));
      const botMsg = {
        id: `bot-${Date.now() + 1}`,
        sender_role: 'bot',
        sender_name: isEnBot ? 'Zyvra AI Assistant 🤖' : 'Zyvra AI Sahayak 🤖',
        message: botResult.reply,
        created_at: new Date(Date.now() + 1000).toISOString()
      };

      store.messages.push(botMsg);

      // Update thread status
      store.thread.last_message = rawMsg.slice(0, 100);
      store.thread.last_message_at = now;
      store.thread.status = 'open';
      store.thread.needs_admin = botResult.needs_admin;
      store.thread.unread_admin_count = (store.thread.unread_admin_count || 0) + 1;
      store.thread.user_name = userName;
      store.thread.user_email = userEmail;

      await saveChatStore(adminClient, user.id, store);

      return respond(200, {
        success: true,
        message: userMsg,
        bot_reply: botMsg,
        thread: store.thread
      });
    }

    /* ============================================================ */
    /* ACTION 3: UPDATE STATUS (ADMIN ONLY)                        */
    /* ============================================================ */
    if (action === 'update_status' && isAdmin) {
      const targetUserId = body.thread_id || body.user_id;
      const status = body.status || 'resolved';
      if (!targetUserId) {
        return respond(400, { error: 'Thread ID / user ID is required.' });
      }

      const store = await getChatStore(adminClient, targetUserId);
      if (store) {
        store.thread.status = status;
        if (status === 'resolved') {
          store.thread.needs_admin = false;
          store.thread.unread_admin_count = 0;
        }
        await saveChatStore(adminClient, targetUserId, store);
        return respond(200, { success: true, status });
      }
      return respond(404, { error: 'Thread not found.' });
    }

    return respond(400, { error: 'Invalid action.' });
  } catch (error) {
    console.error('Support chat API error:', error);
    const sanitized = sanitizeErrorMessage(error, 'Unable to process support chat request.');
    return respond(500, { error: sanitized });
  }
}

export default async function handler(req, res) {
  return handleSupportChat(req, res);
}

export async function POST(req) {
  return handleSupportChat(req);
}
