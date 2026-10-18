import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { questAPI } from "../services/api";
import {
  Target,
  Clock,
  CheckCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const QuestPanel = () => {
  const [quests, setQuests] = useState({
    daily: [],
    weekly: [],
    recentCompleted: [],
  });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    questAPI
      .getAll()
      .then((data) => setQuests(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const allActive = [...quests.daily, ...quests.weekly].filter(
    (q: any) => q.status === "active",
  );
  const completed = quests.recentCompleted || [];

  if (loading) {
    return (
      <div className="p-4 rounded-2xl border border-border bg-card animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-muted rounded-xl" />
          <div className="h-16 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e: any) => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Quests</h3>
          {allActive.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {allActive.length} active
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Daily Quests */}
              {quests.daily.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Daily
                  </p>
                  {quests.daily.map((quest: any) => (
                    <QuestItem key={quest._id} quest={quest} />
                  ))}
                </div>
              )}

              {/* Weekly Quests */}
              {quests.weekly.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Weekly
                  </p>
                  {quests.weekly.map((quest: any) => (
                    <QuestItem key={quest._id} quest={quest} />
                  ))}
                </div>
              )}

              {/* Recently Completed */}
              {completed.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" /> Completed
                  </p>
                  {completed.slice(0, 3).map((quest: any) => (
                    <QuestItem key={quest._id} quest={quest} isCompleted />
                  ))}
                </div>
              )}

              {allActive.length === 0 && completed.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No quests available yet
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const QuestItem = ({ quest, isCompleted = false }: any) => {
  const progress =
    quest.targetCount > 0 ? (quest.currentCount / quest.targetCount) * 100 : 0;

  return (
    <div
      className={`p-3 rounded-xl border mb-2 transition-colors ${
        isCompleted
          ? "border-[var(--accent-color-dynamic)]/30 bg-[var(--accent-color-dynamic)]/5"
          : "border-border bg-card hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{quest.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p
              className={`text-sm font-medium ${isCompleted ? "text-[var(--accent-color-dynamic)] line-through" : "text-foreground"}`}
            >
              {quest.title}
            </p>
            <span className="text-xs font-bold text-primary ml-2 whitespace-nowrap">
              +{quest.xpReward} XP
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {quest.description}
          </p>
          {!isCompleted && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {quest.currentCount}/{quest.targetCount}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestPanel;
