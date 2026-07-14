// src/types/sms.ts
export interface SmsResult {
  messageId: string;
  status?: string;
  description?: string;
}

export interface InfobipMessageResponse {
  messages: {
    messageId: string;
    status: {
      name: string;
      description: string;
    };
  }[];
}