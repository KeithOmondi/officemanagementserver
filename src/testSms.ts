// src/scripts/testSms.ts
import 'dotenv/config';
import { sendSms } from './services/smsService';

const run = async () => {
  const result = await sendSms('254719170834', 'Test message from OFFICE_SYSTEM integration');
  console.log(result);
};

run().catch((err) => {
  console.error('SMS test failed:', err.message);
  process.exit(1);
});