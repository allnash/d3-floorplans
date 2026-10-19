import type { Floor } from 'd3-floorplan';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const floors: Floor[] = [
  {
    id: 'ground',
    name: 'Ground floor',
    image: { url: `${base}/floorplans/ground-floor.svg`, x: 0, y: 0, w: 1200, h: 800 },
    zones: [
      {
        id: 'z-conf-a',
        name: 'Conference A',
        color: '#8b5cf6',
        points: [
          [44, 44],
          [356, 44],
          [356, 296],
          [44, 296],
        ],
      },
      {
        id: 'z-open',
        name: 'Open office',
        points: [
          [444, 244],
          [996, 244],
          [996, 756],
          [444, 756],
        ],
      },
      {
        id: 'z-reception',
        name: 'Reception',
        color: '#10b981',
        points: [
          [44, 524],
          [356, 524],
          [356, 756],
          [44, 756],
        ],
      },
      {
        id: 'z-server',
        name: 'Server room',
        color: '#ef4444',
        points: [
          [844, 44],
          [996, 44],
          [996, 236],
          [844, 236],
        ],
      },
    ],
    sensors: [
      { id: 's-1', name: 'Gateway 1', x: 664, y: 384, w: 32, h: 32 },
      { id: 's-2', name: 'Door sensor', x: 184, y: 712, w: 28, h: 28 },
      { id: 's-3', name: 'Temp / humidity', x: 904, y: 190, w: 28, h: 28 },
      { id: 's-4', name: 'Occupancy', x: 184, y: 160, w: 28, h: 28 },
    ],
  },
  {
    id: 'first',
    name: 'First floor',
    image: { url: `${base}/floorplans/first-floor.svg`, x: 0, y: 0, w: 1200, h: 800 },
    zones: [
      {
        id: 'z-eng',
        name: 'Engineering',
        points: [
          [444, 244],
          [996, 244],
          [996, 560],
          [444, 560],
        ],
      },
      {
        id: 'z-board',
        name: 'Board room',
        color: '#f59e0b',
        points: [
          [44, 44],
          [356, 44],
          [356, 296],
          [44, 296],
        ],
      },
    ],
    sensors: [
      { id: 's-10', name: 'Gateway 2', x: 664, y: 384, w: 32, h: 32 },
      { id: 's-11', name: 'Air quality', x: 1064, y: 110, w: 28, h: 28 },
    ],
  },
];
