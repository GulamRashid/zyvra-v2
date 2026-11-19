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
function generateBotReply(userMessage) {
  const text = String(userMessage || '').toLowerCase();

  // 1. Payment / Unlock / Money cut
  if (/payment|paisa|paise|kata|cut|debit|unlock|unlocked|order|active nahi|activate|kharida|buy|purchas/i.test(text)) {
    return {
      reply: 'Agar aapka payment cut ho gaya hai to chinta na karein! Bank payment verification me aamtaur par 1-2 minute lagte hain.\n\n👉 Kadam 1: Niche navigation me "🎓 My Courses" (मेरे कोर्सेज) page par jayein aur upar "रिफ्रेश (Refresh)" button dabayein.\n👉 Kadam 2: Agar fir bhi pass activate na dikhe, to kripya apna Razorpay Order ID ya payment screenshot detail yahan likhein.\n\n✅ Maine aapki request Admin team ko bhi alert kar di hai.',
      needs_admin: true
    };
  }

  // 2. Where are my bought courses/folders
  if (/kahan|folder|course|subject|syllabus|mila nahi|show nahi|access/i.test(text)) {
    return {
      reply: 'Aapke sabhi kharide hue exams aur subject folders bottom navigation me "🎓 My Courses" (या /purchases) me uplabdh hain.\n\n👉 Wahan course card par click karne par uske andar ke sabhi Main Subjects (folders), sub-folders aur practice tests krambaddh roop me mil jayenge!',
      needs_admin: false
    };
  }

  // 3. Coins / Rewards / Referral
  if (/coin|coins|sikke|point|refer|referral|bonus|redeem|discount/i.test(text)) {
    return {
      reply: 'Zyvra Coins ke baare me jankari:\n\n🪙 Coins kaise kamayein:\n1. Doston ko apna referral code share karein (50 Coins per friend signup).\n2. Mock tests me 70%+ score karein.\n\n💰 Coins kaise use karein:\nCheckout ke waqt 10 Coins = ₹1 ka instant discount milta hai!\nApna coin balance aap "Wallet" tab me dekh sakte hain.',
      needs_admin: false
    };
  }

  // 4. Validity / Expiry / Full Pass
  if (/validity|expire|expiry|valid|saal|year|renew|full pass|pass/i.test(text)) {
    return {
      reply: 'Zyvra Pass & Validity jankari:\n\n⭐ All-Access Full Pass: 365 din (1 saal) ke liye sabhi exams, mock test series aur 6 pro revision tools unlimited unlock rehte hain.\n⭐ Single Subject Folders: Course validity tak hamesha accessible rehte hain.\nAapki exact validity aapke Profile card me Digital ID ke sath likhi hoti hai.',
      needs_admin: false
    };
  }

  // 5. Test series / Questions / Scorecard / Solution
  if (/test|mock|quiz|score|marks|rank|solution|answer|submit/i.test(text)) {
    return {
      reply: 'Mock Tests aur Test Series jankari:\n\n📝 Test submit karte hi aapko turant detail Scorecard, All-India Rank, Percentile aur Solution Explanation milta hai.\n📝 Agar test ke dauran app band ho jaye to Homepage par "Resume" button se wahi se continue kar sakte hain.',
      needs_admin: false
    };
  }

  // 6. Request for human / admin help
  if (/admin|human|insan|agent|baat|help|sahayata|call|madad|urgent|problem/i.test(text)) {
    return {
      reply: 'Bilkul! Aapka chat ticket humne Admin Help Desk ko prioritize kar diya hai 🚀.\n\nAdmin jald hi aapse yahan connect karenge. Kripya apna sawal aur order/contact detail niche likh dein.',
      needs_admin: true
    };
  }

  // Default general fallback
  return {
    reply: 'Namaste! Maine aapka sandesh note kar liya hai aur hamari support team ko forward kar diya hai 🚀.\n\nAgar kisi specific test, payment ya course ke baare me sawal hai, to thoda vistar se likhein taaki hum turant madad kar sakein.',
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
          store = {
            thread: {
              id: user.id,
              user_id: user.id,
              user_name: userName,
              user_email: userEmail,
              status: 'open',
              last_message: 'Chat initialized with Zyvra AI Assistant',
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
                sender_name: 'Zyvra AI Sahayak 🤖',
                message: `Namaste ${userName.split(' ')[0]}! Main Zyvra AI Sahayak hoon 🤖.\nAapki kya madad kar sakta hoon? Kripya apna sawal likhein ya niche diye gaye vishay par tap karein.`,
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
      const botResult = generateBotReply(rawMsg);
      const botMsg = {
        id: `bot-${Date.now() + 1}`,
        sender_role: 'bot',
        sender_name: 'Zyvra AI Sahayak 🤖',
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
