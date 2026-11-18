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

export async function handleUpdateProfile(req, res) {
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
    if (isWebStandard) {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST' }
      });
    }
    if (typeof res?.setHeader === 'function') res.setHeader('Allow', 'POST');
    return respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return respond(401, { error: 'Please sign in to update your profile.' });
    }

    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!url || !anonKey) {
      return respond(500, { error: 'Supabase configuration is missing.' });
    }

    // Authenticate the user from the Bearer token
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    const { data: userData, error: userError } = await client.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return respond(401, { error: 'Session is invalid or expired. Please sign in again.' });
    }

    const user = userData.user;
    const body = await parseRequestBody(req);

    // Validate and sanitize fields
    const updates = {};
    let metadataUpdates = null;

    if (body.full_name !== undefined) {
      const trimmedName = String(body.full_name || '').trim().slice(0, 100);
      if (trimmedName.length < 2) {
        return respond(400, { error: 'Name must be at least 2 characters long.' });
      }
      updates.full_name = trimmedName;
      metadataUpdates = metadataUpdates || {};
      metadataUpdates.full_name = trimmedName;
      metadataUpdates.name = trimmedName;
    }

    if (body.mobile !== undefined) {
      const cleanMobile = String(body.mobile || '').replace(/\D/g, '').slice(-10);
      if (cleanMobile.length > 0 && !/^[6-9]\d{9}$/.test(cleanMobile)) {
        return respond(400, { error: 'Please enter a valid 10-digit Indian mobile number.' });
      }
      updates.mobile = cleanMobile || null;
    }

    if (body.avatar_url !== undefined) {
      const avatar = String(body.avatar_url || '').trim();
      updates.avatar_url = avatar || null;
      metadataUpdates = metadataUpdates || {};
      metadataUpdates.avatar_url = avatar || null;
    }

    if (Array.isArray(body.target_exams)) {
      updates.target_exams = body.target_exams.map((t) => String(t).trim()).filter(Boolean).slice(0, 10);
    }

    if (Object.keys(updates).length === 0) {
      return respond(400, { error: 'No profile fields provided to update.' });
    }

    updates.updated_at = new Date().toISOString();

    // Use service role admin client to bypass column level privilege restrictions
    const adminClient = getPaymentAdminClient();

    const { data: updatedProfile, error: updateError } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, full_name, email, mobile, avatar_url, target_exams, role, updated_at')
      .single();

    if (updateError) {
      console.error('Profile update failed:', updateError.message);
      return respond(500, { error: 'Failed to save profile changes. Please try again.' });
    }

    // Keep auth.users raw_user_meta_data synchronized with profiles table
    if (metadataUpdates && adminClient.auth?.admin?.updateUserById) {
      try {
        await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...(user.user_metadata || {}),
            ...metadataUpdates
          }
        });
      } catch (metaErr) {
        console.warn('Auth user_metadata sync warning:', metaErr?.message);
      }
    }

    return respond(200, {
      success: true,
      message: 'Profile updated successfully.',
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Unhandled profile update error:', error);
    const sanitized = sanitizeErrorMessage(error, 'An unexpected error occurred while updating profile.');
    return respond(500, { error: sanitized });
  }
}

export default async function handler(req, res) {
  return handleUpdateProfile(req, res);
}

export async function POST(req) {
  return handleUpdateProfile(req);
}
