export const WORLD = { width: 2600, height: 1900 };

export const skills = [
  { key: '1', name: '裂魂箭', icon: '➶', cooldown: 0.55, cost: 8, color: '#d8d0ba', description: '贯穿直线上的敌人' },
  { key: '2', name: '血月斩', icon: '☾', cooldown: 3.8, cost: 22, color: '#b52b36', description: '近身环形斩击并吸血' },
  { key: '3', name: '幽冥新星', icon: '✺', cooldown: 7, cost: 34, color: '#7459ac', description: '爆发幽冥能量，击退群敌' }
];

export const itemTypes = [
  { name: '锈蚀骑士剑', slot: 'weapon', stat: '伤害', value: 6, icon: '†' },
  { name: '守墓人兜帽', slot: 'helm', stat: '生命', value: 18, icon: '♟' },
  { name: '染血锁甲', slot: 'armor', stat: '护甲', value: 4, icon: '♜' },
  { name: '黑曜石指环', slot: 'ring', stat: '暴击', value: 8, icon: '●' }
];

export const enemyTypes = {
  ghoul: { name: '饥饿尸鬼', hp: 42, speed: 72, damage: 9, radius: 19, color: '#6f7868', xp: 16 },
  cultist: { name: '余烬教徒', hp: 58, speed: 50, damage: 12, radius: 20, color: '#6f3840', xp: 22 },
  wraith: { name: '墓穴幽魂', hp: 36, speed: 95, damage: 8, radius: 18, color: '#626d87', xp: 20 },
  boss: { name: '墓园守望者 · 莫德雷克', hp: 520, speed: 45, damage: 18, radius: 42, color: '#473047', xp: 200 }
};

export const obstacles = [
  [570,420,170,80],[1070,240,90,230],[1510,350,220,90],[1960,260,110,260],
  [300,920,100,230],[810,800,220,80],[1330,720,90,260],[1840,850,240,80],
  [520,1390,260,100],[1120,1260,100,280],[1580,1450,250,95],[2150,1230,100,270]
];
