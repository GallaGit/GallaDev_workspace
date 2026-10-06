"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Search, Command, X, ChevronRight, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion/presets";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
  section?: string;
}

export interface CommandSection {
  id: string;
  title: string;
  items: CommandItem[];
}

interface CommandPaletteProps {
  sections: CommandSection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
}

export function CommandPalette({ sections, open, onOpenChange, placeholder }: CommandPaletteProps) {
  const t = useTranslations("commandPalette");
  const resolvedPlaceholder = placeholder ?? t("placeholder");
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [prevOpen, setPrevOpen] = React.useState(open);
  const reduced = useReducedMotion();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  const allItems = React.useMemo(
    () => sections.flatMap((section) => section.items.map((item) => ({ item, sectionId: section.id }))),
    [sections]
  );

  const filteredItems = React.useMemo(() => {
    if (!query) return allItems;
    const lowerQuery = query.toLowerCase();
    return allItems
      .map(({ item, sectionId }) => {
        const keywords = [item.label, item.description, ...(item.keywords || [])].join(" ").toLowerCase();
        const labelMatch = item.label.toLowerCase().includes(lowerQuery);
        const descMatch = item.description?.toLowerCase().includes(lowerQuery);
        const keywordMatch = keywords.includes(lowerQuery);
        let score = 0;
        if (labelMatch) score += 10;
        if (descMatch) score += 5;
        if (keywordMatch) score += 2;
        if (item.label.toLowerCase().startsWith(lowerQuery)) score += 20;
        return score > 0 ? { item, sectionId, score } : null;
      })
      .filter((v): v is { item: CommandItem; sectionId: string; score: number } => v !== null)
      .sort((a, b) => b.score - a.score)
      .map(({ item, sectionId }) => ({ item, sectionId }));
  }, [query, allItems]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    const selectedItem = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedItem?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, filteredItems]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].item.action();
          onOpenChange(false);
        }
        break;
      case "Escape":
        onOpenChange(false);
        break;
    }
  };

  const executeItem = (item: CommandItem) => {
    item.action();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
<motion.div
          initial={reduced ? undefined : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={reduced ? { duration: 0 } : motionPresets.fadeInUp.transition}
          className="fixed inset-0 z-(--z-modal) flex items-start justify-center pt-16"
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={reduced ? undefined : { opacity: 0, scale: 0.95, y: -8 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.95, y: 8 }}
            transition={reduced ? { duration: 0 } : motionPresets.modalEnter.transition}
            className="w-full max-w-2xl mx-4"
          >
          <div className="relative rounded-xl border border-gris-200 dark:border-gris-700 bg-blanco dark:bg-grafito shadow-xl overflow-hidden">
            <div className="relative flex items-center gap-3 px-4 py-3 border-b border-gris-200 dark:border-gris-700">
              <Search className="h-5 w-5 text-gris-400 dark:text-gris-500" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder={resolvedPlaceholder}
                className="flex-1 bg-transparent text-base text-grafito dark:text-gris-100 placeholder:text-gris-400 focus:outline-none"
                aria-label={t("searchAria")}
                autoComplete="off"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-gris-500 dark:text-gris-400 bg-gris-100 dark:bg-gris-800 rounded">
                <Command className="h-3 w-3" aria-hidden="true" />
                <span>K</span>
              </kbd>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1 text-gris-400 hover:text-gris-600 dark:hover:text-gris-300 transition-colors rounded-lg hover:bg-gris-100 dark:hover:bg-gris-800"
                aria-label={t("close")}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <AnimatePresence mode="popLayout">
              <motion.ul
                ref={listRef}
                className="max-h-[60vh] overflow-y-auto p-2"
                initial={reduced ? undefined : { opacity: 0, y: 8 }}
                animate={reduced ? undefined : { opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={reduced ? { duration: 0 } : { duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                role="listbox"
                aria-label={t("results")}
              >
                {filteredItems.length === 0 ? (
                  <li className="px-4 py-8 text-center text-gris-500 dark:text-gris-400">
                    {t("empty")}
                  </li>
                ) : (
                  sections.map((section) => {
                    const sectionItems = filteredItems.filter((f) => f.sectionId === section.id);
                    if (sectionItems.length === 0) return null;

                    return (
                      <React.Fragment key={section.id}>
                        <li className="px-4 py-2 text-xs font-semibold text-gris-500 dark:text-gris-400 uppercase tracking-wider">
                          {section.title}
                        </li>
                        {sectionItems.map(({ item }) => {
                          const globalIndex = filteredItems.findIndex((f) => f.item.id === item.id);
                          const isSelected = globalIndex === selectedIndex;

                          return (
                            <li
                              key={item.id}
                              data-index={globalIndex}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => executeItem(item)}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              className={cn(
                                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100",
                                isSelected
                                  ? "bg-rojo/10 text-rojo dark:bg-rojo/20"
                                  : "text-grafito dark:text-gris-100 hover:bg-gris-100 dark:hover:bg-gris-800",
                              )}
                            >
                              {item.icon && (
                                <span className="flex h-5 w-5 items-center justify-center shrink-0" aria-hidden="true">
                                  {item.icon}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium">{item.label}</p>
                                {item.description && (
                                  <p className="truncate text-xs text-gris-500 dark:text-gris-400">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              {item.shortcut && (
                                <kbd className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-gris-500 dark:text-gris-400 bg-gris-100 dark:bg-gris-800 rounded">
                                  {item.shortcut}
                                </kbd>
                              )}
                              {isSelected && (
                                <ChevronRight className="h-4 w-4 text-rojo shrink-0" aria-hidden="true" />
                              )}
                            </li>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </motion.ul>
            </AnimatePresence>

            <div className="border-t border-gris-200 dark:border-gris-700 px-4 py-2 text-xs text-gris-500 dark:text-gris-400 flex items-center justify-between">
              <span>{t("instructions")}</span>
              <kbd className="px-2 py-0.5 font-mono bg-gris-100 dark:bg-gris-800 rounded">
                <Keyboard className="h-3 w-3 inline" aria-hidden="true" />
                <span className="ml-1">K</span>
              </kbd>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function useCommandPalette(sections: CommandSection[]) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen, CommandPalette: <CommandPalette sections={sections} open={open} onOpenChange={setOpen} /> };
}