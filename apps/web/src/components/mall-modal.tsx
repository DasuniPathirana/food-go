"use client";

import { useState } from "react";
import {
  X,
  Store,
  Compass,
  Sparkles,
  MapPin,
  ChevronRight,
  Layers,
  Award,
} from "lucide-react";
import {
  type MallData,
  type MallFloor,
  type MallShopUnit,
  getMallShopsByFloor,
  getMallQuestsByFloor,
  getMallCollectiblesByFloor,
} from "@food-go/domain";
import styles from "./mall-modal.module.css";

export function MallModal({
  mall,
  onClose,
  onSelectShop,
}: {
  mall: MallData;
  onClose: () => void;
  onSelectShop?: (shop: MallShopUnit) => void;
}) {
  const [activeFloorId, setActiveFloorId] = useState<string>(
    mall.floors[0]?.id ?? ""
  );

  const activeFloor = mall.floors.find((f) => f.id === activeFloorId);
  const shops = getMallShopsByFloor(mall.id, activeFloorId);
  const quests = getMallQuestsByFloor(mall.id, activeFloorId);
  const collectibles = getMallCollectiblesByFloor(mall.id, activeFloorId);

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mall-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.badge}>Approved Shopping Mall</span>
            <h2 id="mall-modal-title" className={styles.mallName}>
              {mall.name}
            </h2>
            <div className={styles.entranceInfo}>
              <MapPin size={13} style={{ display: "inline", marginRight: 4 }} />
              {mall.entrance.streetName} · {mall.entrance.description}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close mall directory"
          >
            <X size={20} />
          </button>
        </div>

        <nav
          className={styles.floorTabs}
          aria-label="Mall floors"
          role="tablist"
        >
          {mall.floors.map((floor) => (
            <button
              key={floor.id}
              type="button"
              role="tab"
              aria-selected={floor.id === activeFloorId}
              className={styles.floorTab}
              data-active={floor.id === activeFloorId}
              onClick={() => setActiveFloorId(floor.id)}
            >
              <Layers size={14} />
              {floor.name}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {activeFloor?.description && (
            <p className={styles.floorDescription}>{activeFloor.description}</p>
          )}

          <div>
            <h3 className={styles.sectionTitle}>
              <Store size={16} />
              Restaurants & Food Outlets ({shops.length})
            </h3>
            {shops.length > 0 ? (
              <div className={styles.shopGrid}>
                {shops.map((shop) => (
                  <div key={shop.id} className={styles.shopCard}>
                    <div className={styles.shopInfo}>
                      <span className={styles.unitNumber}>{shop.unitNumber}</span>
                      <h4 className={styles.shopName}>{shop.name}</h4>
                      <div className={styles.shopMeta}>
                        {shop.category}
                        {shop.cuisine ? ` · ${shop.cuisine}` : ""}
                        {shop.openingHours ? ` · ${shop.openingHours}` : ""}
                      </div>
                    </div>
                    {onSelectShop && (
                      <button
                        type="button"
                        className={styles.closeButton}
                        onClick={() => onSelectShop(shop)}
                        aria-label={`Select ${shop.name}`}
                      >
                        <ChevronRight size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyNotice}>
                No registered food shops on this floor yet.
              </div>
            )}
          </div>

          {quests.length > 0 && (
            <div>
              <h3 className={styles.sectionTitle}>
                <Compass size={16} />
                Floor Quests
              </h3>
              <div className={styles.shopGrid}>
                {quests.map((quest) => (
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

          {collectibles.length > 0 && (
            <div>
              <h3 className={styles.sectionTitle}>
                <Sparkles size={16} />
                Floor Collectibles
              </h3>
              <div className={styles.shopGrid}>
                {collectibles.map((item) => (
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
