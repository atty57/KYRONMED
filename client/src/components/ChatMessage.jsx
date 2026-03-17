import { motion } from 'framer-motion';
import KyraAvatar, { UserAvatar } from './ui/KyraAvatar.jsx';
import WaveTyping from './ui/WaveTyping.jsx';

function stripFunctionCalls(content) {
  let result = content.replace(/<function=[^<]*<\/function>/gs, '');
  result = result.replace(/<function=[\s\S]*$/, '');
  return result.trim();
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, isLast }) {
  const isAssistant = message.role === 'assistant';
  const displayContent = isAssistant ? stripFunctionCalls(message.content || '') : message.content;
  const isStreaming = message.streaming && !displayContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`flex gap-2.5 ${isAssistant ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-7 h-7 flex items-center justify-center">
          {isAssistant ? (
            <KyraAvatar size={28} />
          ) : (
            <UserAvatar size={28} />
          )}
        </div>
      </div>

      {/* Bubble + timestamp */}
      <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} max-w-[78%]`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            isAssistant
              ? 'glass-light rounded-tl-md text-white message-shimmer-once'
              : 'bg-gradient-to-br from-blue-600 to-blue-700 rounded-tr-md text-white shadow-lg shadow-blue-900/20'
          } ${message.error ? 'ring-1 ring-red-500/30' : ''}`}
        >
          {isStreaming ? (
            <WaveTyping />
          ) : (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{displayContent}</p>
          )}
        </div>
        <span className="text-[10px] text-slate-600 mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}
