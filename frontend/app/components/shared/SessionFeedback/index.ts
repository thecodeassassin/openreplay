export { default } from './SessionFeedback';

export interface Payload {
  interesting?: boolean;
  reason?: string;
  comment?: string;
}

export interface Feedback {
  sessionId: string;
  payload: Payload;
}