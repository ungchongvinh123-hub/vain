import { handle, currentSnapshot, shopBody } from '@/server/session';
import { SHOP } from '@/game/data/stages';
import { buyShopItem } from '@/db/repo';

async function list() {
  const { snapshot } = await currentSnapshot();
  return {
    items: SHOP.map((i) => ({ ...i, bought: snapshot.purchases[i.id] ?? 0, soldOut: i.stock > 0 && (snapshot.purchases[i.id] ?? 0) >= i.stock })),
    gold: snapshot.gold,
  };
}

export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.json().catch(() => ({}));
    if (!raw?.itemId) return list();
    const body = shopBody.parse(raw);
    const { player } = await currentSnapshot();
    const res = await buyShopItem(player.id, body.itemId);
    const { snapshot } = await currentSnapshot();
    return { ...res, snapshot };
  });
}
