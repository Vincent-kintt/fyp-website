// Custom SuggestionMenu that uses index-based keys instead of title-based keys.
// BlockNote's default SuggestionMenu uses key={item.title} which breaks when
// multiple notes share the same title (e.g. "Untitled").

import { useMemo } from "react";
import { useComponentsContext, useDictionary } from "@blocknote/react";
import { mergeCSSClasses } from "@blocknote/core";

export default function MentionMenu({ items, loadingState, selectedIndex, onItemClick }) {
  const Components = useComponentsContext();
  const dict = useDictionary();

  const renderedItems = useMemo(() => {
    let currentGroup;
    const result = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.group !== currentGroup) {
        currentGroup = item.group;
        result.push(
          <Components.SuggestionMenu.Label
            className="bn-suggestion-menu-label"
            key={`group-${currentGroup}`}
          >
            {currentGroup}
          </Components.SuggestionMenu.Label>,
        );
      }
      result.push(
        <Components.SuggestionMenu.Item
          className={mergeCSSClasses(
            "bn-suggestion-menu-item",
            item.size === "small" ? "bn-suggestion-menu-item-small" : "",
          )}
          item={item}
          id={`bn-suggestion-menu-item-${i}`}
          isSelected={i === selectedIndex}
          key={`${item.title}-${i}`}
          onClick={() => onItemClick?.(item)}
        />,
      );
    }

    return result;
  }, [Components, items, onItemClick, selectedIndex]);

  return (
    <Components.SuggestionMenu.Root
      id="bn-suggestion-menu"
      className="bn-suggestion-menu"
    >
      {renderedItems}
      {renderedItems.length === 0 &&
        (loadingState === "loading" || loadingState === "loaded") && (
          <Components.SuggestionMenu.EmptyItem className="bn-suggestion-menu-item">
            {dict.suggestion_menu.no_items_title}
          </Components.SuggestionMenu.EmptyItem>
        )}
      {(loadingState === "loading-initial" || loadingState === "loading") && (
        <Components.SuggestionMenu.Loader className="bn-suggestion-menu-loader" />
      )}
    </Components.SuggestionMenu.Root>
  );
}
