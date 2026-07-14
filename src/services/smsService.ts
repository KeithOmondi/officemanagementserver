// src/services/smsService.ts
import axios, { AxiosInstance } from 'axios';
import { SmsResult, InfobipMessageResponse } from '../types/sms';
import { env } from '../config/env';
import { pool } from '../config/db';

const infobipClient: AxiosInstance = axios.create({
  baseURL: env.INFOBIP_BASE_URL,
  headers: {
    Authorization: `App ${env.INFOBIP_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
});

export const sendSms = async (to: string, text: string): Promise<SmsResult> => {
  try {
    const { data } = await infobipClient.post<InfobipMessageResponse>(
      '/sms/2/text/advanced',
      {
        messages: [
          {
            from: env.INFOBIP_SENDER_ID,
            destinations: [{ to }],
            text,
          },
        ],
      }
    );

    const result = data.messages?.[0];
    if (!result) {
      throw new Error('Infobip returned no message result');
    }

    return {
      messageId: result.messageId,
      status: result.status?.name,
      description: result.status?.description,
    };
  } catch (err: any) {
    if (err.response) {
      const message: string =
        err.response.data?.requestError?.serviceException?.text ||
        'Infobip SMS request failed';
      throw new Error(`${message} (status ${err.response.status})`);
    }
    throw new Error(`SMS service unreachable: ${err.message}`);
  }
};




export const sendAndLogSms = async (to: string, text: string): Promise<SmsResult> => {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO sms_logs (recipient, message) VALUES ($1, $2) RETURNING id`,
    [to, text]
  );
  const logId = rows[0].id;

  try {
    const result = await sendSms(to, text);
    await pool.query(
      `UPDATE sms_logs
       SET status = 'sent', infobip_message_id = $1, status_description = $2, sent_at = NOW()
       WHERE id = $3`,
      [result.messageId, result.description ?? null, logId]
    );
    return result;
  } catch (err: any) {
    await pool.query(
      `UPDATE sms_logs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err.message, logId]
    );
    throw err;
  }
};