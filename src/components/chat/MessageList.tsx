// ---------------------------------------------------------------------------
// OpenWebClaw — Message list
// ---------------------------------------------------------------------------

import type { StoredMessage } from '../../types.js';
import { MessageBubble } from './MessageBubble.js';

interface Props {
  messages: StoredMessage[];
}

export function MessageList({ messages }: Props) {
  return (
    <div className="flex flex-col w-full">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}
