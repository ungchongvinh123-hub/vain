import { handle, currentSnapshot } from '@/server/session';
import { STAGES } from '@/game/data/stages';

export async function POST() {
  return handle(async () => {
    const { snapshot } = await currentSnapshot();
    return {
      stages: STAGES.map((s) => ({
        id: s.id, name: s.name, region: s.region, boss: !!s.boss, desc: s.desc,
        difficulty: s.difficulty, reward: s.reward, dropChance: s.drop.chance,
        monsters: s.waves[0].monsters.map((m) => ({ id: m.id, level: m.level })),
        unlocked: s.id <= snapshot.stageProgress,
      })),
      progress: snapshot.stageProgress,
    };
  });
}
