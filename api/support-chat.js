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

    if (action === 'get_thread') {
      // If student: get or create user's thread
      if (!isAdmin) {
        let { data: thread } = await adminClient
          .from('support_threads')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!thread) {
          const userName = profile?.full_name || user.user_metadata?.full_name || 'Student';
          const userEmail = profile?.email || user.email || '';
          const { data: newThread, error: createErr } = await adminClient
            .from('support_threads')
            .insert({
              user_id: user.id,
              user_name: userName,
              user_email: userEmail,
              status: 'open'
            })
            .select('*')
            .single();

          if (createErr && createErr.code !== '23505') {
            throw createErr;
          }
          thread = newThread;
        }

        const { data: messages } = await adminClient
          .from('support_messages')
          .select('*')
          .eq('thread_id', thread.id)
          .order('created_at', { ascending: true });

        // Mark user unread as 0 since user viewed them
        if (thread.unread_user_count > 0) {
          await adminClient
            .from('support_threads')
            .update({ unread_user_count: 0 })
            .eq('id', thread.id);
        }

        return respond(200, {
          success: true,
          thread,
          messages: messages || []
        });
      }

      // If admin: return all threads or specific thread
      const threadId = body.thread_id;
      if (threadId) {
        const { data: thread } = await adminClient
          .from('support_threads')
          .select('*')
          .eq('id', threadId)
          .maybeSingle();

        const { data: messages } = await adminClient
          .from('support_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        // Mark admin unread as 0
        if (thread?.unread_admin_count > 0) {
          await adminClient
            .from('support_threads')
            .update({ unread_admin_count: 0 })
            .eq('id', threadId);
        }

        return respond(200, { success: true, thread, messages: messages || [] });
      }

      // List all threads for admin
      const { data: threads } = await adminClient
        .from('support_threads')
        .select('*')
        .order('last_message_at', { ascending: false });

      return respond(200, { success: true, threads: threads || [] });
    }

    if (action === 'send_message') {
      const rawMsg = String(body.message || '').trim();
      if (!rawMsg) {
        return respond(400, { error: 'Message cannot be empty.' });
      }

      let threadId = body.thread_id;
      let senderRole = isAdmin ? 'admin' : 'user';
      let senderName = profile?.full_name || (isAdmin ? 'Zyvra Support' : 'Student');

      // If student and threadId not specified, lookup or create thread
      if (!isAdmin) {
        let { data: thread } = await adminClient
          .from('support_threads')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!thread) {
          const userName = profile?.full_name || user.user_metadata?.full_name || 'Student';
          const userEmail = profile?.email || user.email || '';
          const { data: newThread } = await adminClient
            .from('support_threads')
            .insert({
              user_id: user.id,
              user_name: userName,
              user_email: userEmail,
              status: 'open'
            })
            .select('id')
            .single();
          thread = newThread;
        }
        threadId = thread.id;
      }

      if (!threadId) {
        return respond(400, { error: 'Thread ID is required.' });
      }

      // Insert message
      const { data: newMsg, error: msgErr } = await adminClient
        .from('support_messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          sender_role: senderRole,
          sender_name: senderName,
          message: rawMsg
        })
        .select('*')
        .single();

      if (msgErr) throw msgErr;

      // Update thread last message and counts
      const now = new Date().toISOString();
      const updatePayload = {
        last_message: rawMsg.slice(0, 150),
        last_message_at: now,
        updated_at: now
      };

      if (isAdmin) {
        updatePayload.unread_user_count = 1; // user has new unread
        updatePayload.unread_admin_count = 0;
      } else {
        updatePayload.unread_admin_count = 1; // admin has new unread
        updatePayload.status = 'open'; // reopen if resolved
      }

      await adminClient
        .from('support_threads')
        .update(updatePayload)
        .eq('id', threadId);

      return respond(200, {
        success: true,
        message: newMsg
      });
    }

    if (action === 'update_status' && isAdmin) {
      const threadId = body.thread_id;
      const status = body.status || 'resolved';
      if (!threadId) {
        return respond(400, { error: 'Thread ID is required.' });
      }
      await adminClient
        .from('support_threads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      return respond(200, { success: true, status });
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
