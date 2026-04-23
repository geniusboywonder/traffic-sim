// WebMCP — expose sim tools to AI agents via the browser
// https://webmachinelearning.github.io/webmcp/
export function registerWebMCPTools() {
  if (!navigator.modelContext?.provideContext) return;

  navigator.modelContext.provideContext({
    tools: [
      {
        name: 'get_simulation_info',
        description:
          'Returns information about this traffic simulation: what it models, which scenarios are available, and what statistics it tracks.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        execute: async () => ({
          title: 'Traffik — Tokai High Traffic Simulator',
          description:
            'Microscopic IDM-based traffic simulation of the Bergvliet/Tokai road network showing the impact of 800 extra vehicles from the proposed Tokai High School development during morning school drop-off.',
          url: 'https://traffic.adamson.co.za',
          scenarios: ['baseline', 'development'],
          corridors: [
            'Tokai Road (east)',
            'Tokai Road (west)',
            'Bergvliet Road',
            'Kendal Road',
          ],
          statistics: ['vehicle_count', 'average_delay_seconds', 'queue_length'],
        }),
      },
      {
        name: 'get_simulation_statistics',
        description:
          'Returns the latest simulation statistics for both baseline and development scenarios, including vehicle counts and average delays per corridor.',
        inputSchema: {
          type: 'object',
          properties: {
            scenario: {
              type: 'string',
              enum: ['baseline', 'development', 'both'],
              description: 'Which scenario to return stats for.',
            },
          },
          required: [],
        },
        execute: async ({ scenario = 'both' } = {}) => {
          const statsEl = document.querySelector('[data-sim-stats]');
          if (statsEl) {
            try {
              return JSON.parse(statsEl.getAttribute('data-sim-stats'));
            } catch {
              // fall through to description
            }
          }
          return {
            note: 'Live statistics are available by running the simulation on the page.',
            url: 'https://traffic.adamson.co.za',
            scenario,
          };
        },
      },
    ],
  });
}
