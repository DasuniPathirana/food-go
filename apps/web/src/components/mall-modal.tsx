"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Store, Compass, Sparkles, MapPin, ChevronRight, Layers } from "lucide-react";
import {
  type MallData,
  type MallShopUnit,
  getMallShopsByFloor,
  getMallQuestsByFloor,
  getMallCollectiblesByFloor,
} from "@food-go/domain";
import type { LiveMall } from "@/lib/world-data";
import styles from "./mall-modal.module.css";

type ShopClickPayload = {
  id: string;
  name: string;
  slug?: string;
  floor: string;
  unit: string;
};

function isLiveMall(value: MallData | LiveMall): value is LiveMall {
  return "shopCount" in value;
}

export function MallModal({
  mall,
  onClose,
  onSelectShop,
}: {
  mall: MallData | LiveMall;
  onClose: () => void;
  onSelectShop?: (shop: ShopClickPayload | MallShopUnit) => void;
}) {
  const live = isLiveMall(mall);
  const floors = mall.floors;
  const [activeFloorId, setActiveFloorId] = useState<string>(floors[0]?.id ?? "");

  const activeFloor = floors.find(f => f.id === activeFloorId) ?? floors[0];
  const activeCode = activeFloor ? ("code" in activeFloor ? activeFloor.code : `L${activeFloor.level}`) : "G";

  const staticShops = !live && activeFloor ? getMallShopsByFloor(mall.id, activeFloor.id) : [];
  const staticQuests = !live && activeFloor ? getMallQuestsByFloor(mall.id, activeFloor.id) : [];
  const staticCollectibles = !live && activeFloor ? getMallCollectiblesByFloor(mall.id, activeFloor.id) : [];

  const liveShops = live
    ? mall.shops.filter(s => s.floor.toUpperCase() === activeCode.toUpperCase() || s.floor === activeFloor?.name)
    : [];

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mall-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.badge}>
              Melbourne Pilot Mall · {live ? `${mall.shopCount} Food Venues` : `${floors.length} Floors`}
            </span>
            <h2 id="mall-modal-title" className={styles.mallName}>
              {mall.name}
            </h2>
            <div className={styles.entranceInfo}>
              <MapPin size={13} style={{ display: "inline", marginRight: 4 }} />
              {live ? `${mall.address}, ${mall.suburb} · ${mall.entranceDescription}` : `${mall.entrance.streetName} · ${mall.entrance.description}`}
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close mall directory">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.floorTabs} aria-label="Mall floors" role="tablist">
          {floors.map(floor => (
            <button
              key={floor.id}
              type="button"
              role="tab"
              aria-selected={floor.id === activeFloor?.id}
              className={styles.floorTab}
              data-active={floor.id === activeFloor?.id}
              onClick={() => setActiveFloorId(floor.id)}
            >
              <Layers size={14} />
              {"code" in floor ? floor.code : `L${floor.level}`} · {floor.name}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {activeFloor?.description && <p className={styles.floorDescription}>{activeFloor.description}</p>}

          <div>
            <h3 className={styles.sectionTitle}>
              <Store size={16} />
              Restaurants & Cafes ({live ? liveShops.length : staticShops.length})
            </h3>

            {live ? (
              liveShops.length > 0 ? (
                <div className={styles.shopGrid}>
                  {liveShops.map(shop => (
                    <div key={shop.id} className={styles.shopCard}>
                      <div className={styles.shopInfo}>
                        <span className={styles.unitNumber}>
                          {shop.floor}
                          {shop.unit ? ` · Unit ${shop.unit}` : ""}
                        </span>
                        <h4 className={styles.shopName}>{shop.name}</h4>
                        <div className={styles.shopMeta}>
                          {shop.venueType.replace("_", " ")} · {shop.cuisine}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Link
                          href={`/venues/${encodeURIComponent(shop.slug)}`}
                          className={styles.closeButton}
                          aria-label={`Open ${shop.name}`}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyNotice}>
                  No approved restaurants assigned to {activeFloor?.name ?? "this floor"} yet. Restaurant owners can assign their shop to {mall.name} inside the Owner Portal.
                </div>
              )
            ) : staticShops.length > 0 ? (
              <div className={styles.shopGrid}>
                {staticShops.map(shop => (
                  <div key={shop.id} className={styles.shopCard}>
                    <div className={styles.shopInfo}>
                      <span className={styles.unitNumber}>{shop.unitNumber}</span>
                      <h4 className={styles.shopName}>{shop.name}</h4>
                      <div className={styles.shopMeta}>
                        {shop.category}
                        {shop.cuisine ? ` · ${shop.cuisine}` : ""}
                      </div>
                    </div>
                    {onSelectShop && (
                      <button type="button" className={styles.closeButton} onClick={() => onSelectShop(shop)} aria-label={`Select ${shop.name}`}>
                        <ChevronRight size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyNotice}>No food outlets listed on this floor yet.</div>
            )}
          </div>

          {!live && staticQuests.length > 0 && (
            <div>
              <h3 className={styles.sectionTitle}>
                <Compass size={16} />
                Floor Quests
              </h3>
              <div className={styles.shopGrid}>
                {staticQuests.map(quest => (
                  <div key={quest.id} className={styles.questCard}>
                    <div className={styles.questInfo}>
                      <h4>{quest.title}</h4>
                      <p>{quest.description}</p>
                      <span className={styles.xpBadge}>+{quest.rewardXp} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!live && staticCollectibles.length > 0 && (
            <div>
              <h3 className={styles.sectionTitle}>
                <Sparkles size={16} />
                Floor Collectibles
              </h3>
              <div className={styles.shopGrid}>
                {staticCollectibles.map(item => (
                  <div key={item.id} className={styles.collectibleCard}>
                    <div className={styles.collectibleInfo}>
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
