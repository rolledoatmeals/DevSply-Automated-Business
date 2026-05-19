import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const API_KEY   = process.env.TELNYX_API_KEY;
const FROM      = process.env.TELNYX_PHONE_NUMBER;
const SENDER    = process.env.SENDER_NAME ?? 'Zach';

async function callAction(callControlId, action, body = {}) {
  return axios.post(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/${action}`,
    body,
    { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } }
  );
}

export default async function handler(req, res) {
  // Acknowledge immediately — Telnyx expects a fast 200
  res.status(200).end();

  if (req.method !== 'POST') return;

  const event     = req.body?.data;
  if (!event) return;

  const eventType      = event.event_type;
  const payload        = event.payload ?? {};
  const callControlId  = payload.call_control_id;

  let state = {};
  if (payload.client_state) {
    try { state = JSON.parse(Buffer.from(payload.client_state, 'base64').toString()); } catch {}
  }
  const { place_id, script } = state;

  // ── Call answered: play pitch + gather keypress ──
  if (eventType === 'call.answered') {
    await callAction(callControlId, 'gather_using_speak', {
      payload: script || `Hi, this is ${SENDER} from DevSply. Press 1 if you're interested in a free website preview. Press 2 to opt out.`,
      voice: 'female',
      language: 'en-US',
      valid_digits: '12',
      maximum_digits: 1,
      inter_digit_timeout_millis: 6000,
      client_state: payload.client_state,
    }).catch(() => {});

    if (place_id) {
      await supabase.from('call_logs')
        .update({ status: 'answered' })
        .eq('place_id', place_id).eq('status', 'initiated');
    }
  }

  // ── Keypress received ──
  else if (eventType === 'call.gather.ended') {
    const digit = payload.digits;
    await callAction(callControlId, 'hangup').catch(() => {});

    if (!place_id) return;

    if (digit === '1') {
      // Interested — mark replied, send follow-up SMS
      await Promise.all([
        supabase.from('call_logs').update({ status: 'pressed_1' }).eq('place_id', place_id).eq('status', 'answered'),
        supabase.from('leads').update({ outreach_status: 'replied' }).eq('place_id', place_id),
      ]);

      const { data: lead } = await supabase.from('leads').select('phone,business_name').eq('place_id', place_id).single();
      if (lead?.phone && API_KEY && FROM) {
        const digits = lead.phone.replace(/[^\d]/g, '').slice(-10);
        const followUp = `Hey! Thanks for pressing 1 — glad you're interested in a website for ${lead.business_name}. Reply with your email and I'll send you a free preview right away. – ${SENDER}`;
        try {
          await axios.post(
            'https://api.telnyx.com/v2/messages',
            { from: FROM, to: `+1${digits}`, text: followUp, webhook_url: 'https://app.devsply.com/api/sms-reply' },
            { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } }
          );
          await supabase.from('sms_messages').insert({
            place_id, direction: 'outbound', body: followUp, phone: lead.phone,
          });
        } catch {}
      }

    } else if (digit === '2') {
      // Opted out
      await Promise.all([
        supabase.from('call_logs').update({ status: 'opted_out' }).eq('place_id', place_id).eq('status', 'answered'),
        supabase.from('leads').update({ outreach_status: 'unresponsive' }).eq('place_id', place_id),
      ]);

    } else {
      // No valid digit entered
      await supabase.from('call_logs').update({ status: 'no_response' }).eq('place_id', place_id).eq('status', 'answered');
    }
  }

  // ── Hangup before answer = no answer ──
  else if (eventType === 'call.hangup') {
    if (!place_id) return;
    const { data: logs } = await supabase.from('call_logs')
      .select('status').eq('place_id', place_id)
      .order('created_at', { ascending: false }).limit(1);
    if (logs?.[0]?.status === 'initiated') {
      await supabase.from('call_logs').update({ status: 'no_answer' }).eq('place_id', place_id).eq('status', 'initiated');
    }
  }
}
