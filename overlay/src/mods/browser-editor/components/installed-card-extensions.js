import { createElement } from "react";

import { cardBackgroundStyle } from "mods/browser-editor/lib/card-background";
import ServiceUpdateBadge from "./service-update";

export const installedCardExtensions = Object.freeze([
  Object.freeze({
    id: "homepage-studio-card-backgrounds",
    cardTypes: Object.freeze(["bookmark", "service"]),
    getExtraStyle: ({ card }) => cardBackgroundStyle(card?.cardBackground, card?.cardBackgroundPosition),
  }),
  Object.freeze({
    id: "homepage-studio-service-updates",
    cardTypes: Object.freeze(["service"]),
    ServiceBadge: ServiceUpdateBadge,
  }),
]);

function supportsCardType(extension, cardType) {
  return !Array.isArray(extension?.cardTypes) || extension.cardTypes.includes(cardType);
}

export function getCardExtraStyle(cardType, card) {
  const extraStyle = {};
  for (const extension of installedCardExtensions) {
    if (!supportsCardType(extension, cardType) || typeof extension?.getExtraStyle !== "function") continue;
    try {
      const style = extension.getExtraStyle({ cardType, card });
      if (style && typeof style === "object" && !Array.isArray(style)) Object.assign(extraStyle, style);
    } catch {
      // One optional extension must not break the card.
    }
  }
  return extraStyle;
}

export function getServiceBadgeComponents() {
  return installedCardExtensions
    .filter((extension) => supportsCardType(extension, "service") && typeof extension?.ServiceBadge === "function")
    .map((extension) => extension.ServiceBadge);
}

export function renderServiceCardBadges(service, props = {}) {
  return getServiceBadgeComponents().map((Component, index) =>
    createElement(Component, { ...props, key: `card-extension-badge-${index}`, service }),
  );
}
