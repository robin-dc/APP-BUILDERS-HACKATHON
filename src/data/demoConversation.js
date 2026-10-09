// Mock conversation used until the planner and local AI are wired in.
// Fares and times are placeholders; replace with routing-engine output.

export const WELCOME_SUGGESTIONS = ['Ayala → Cubao', 'Nearest jeep stop', 'Is MRT busy now?'];

export const demoConversation = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hi! **Saan ka papunta?** Ask me about routes, fares, the nearest stop, or anything about a place.',
    suggestions: WELCOME_SUGGESTIONS,
  },
  {
    id: 'u1',
    role: 'user',
    text: 'Cheapest way to Cubao? May dala akong malaking bag.',
  },
  {
    id: 'a1',
    role: 'assistant',
    routes: {
      bestId: 'mrt3',
      options: [
        { id: 'mrt3', mode: 'rail', title: 'MRT-3 · Ayala → Cubao', fare: '₱28', duration: '~35 min' },
        { id: 'carousel', mode: 'bus', title: 'EDSA Carousel bus', fare: '₱15', duration: '~55 min' },
      ],
    },
    explanation:
      'MRT is your best bet with a big bag. Board **northbound** at Ayala, ride 7 stops, and avoid 5–8 PM if you can, it gets very crowded',
    streaming: true,
  },
];
