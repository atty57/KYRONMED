export const API_BASE = import.meta.env.VITE_API_URL || '';

export const BRAND = {
  name: 'KyronMed',
  tagline: 'Comprehensive Care, Powered by Technology',
  colors: {
    primary: '#0066CC',
    primaryLight: '#0088FF',
    accent: '#00D4AA',
  },
};

export const CHAT_CONFIG = {
  maxMessageLength: 1000,
  typingDelay: 30,          // ms between characters for typing effect
  welcomeMessage: "Hi there! I'm Kyra, your patient assistant at KyronMed. I can help you book appointments, refill prescriptions, or answer questions about our practice. What can I do for you today?",
};
