"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export interface SocraticMessage {
  id: string;
  sender: "student" | "tutor";
  content: string;
  bloomLevel?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  isPedagogicalHint?: boolean;
}

export function SocraticTutor({
  topicTitle = "First Normal Form (1NF) & Relational Integrity",
}: {
  topicTitle?: string;
  courseId?: string;
  revisionId?: string;
}) {
  const [messages, setMessages] = useState<SocraticMessage[]>([
    {
      id: "msg_init",
      sender: "tutor",
      content:
        "Welcome to your Socratic study session. I'm here to guide your reasoning step-by-step. To start, how would you describe what it means for a column to contain atomic values?",
      bloomLevel: "understand",
      isPedagogicalHint: false,
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const handleSendMessage = () => {
    if (!input.trim() || isThinking) return;

    const studentText = input.trim();
    const newStudentMsg: SocraticMessage = {
      id: `msg_${Date.now()}`,
      sender: "student",
      content: studentText,
    };

    setMessages((prev) => [...prev, newStudentMsg]);
    setInput("");
    setIsThinking(true);

    setTimeout(() => {
      let reply: SocraticMessage;
      const lower = studentText.toLowerCase();

      if (lower.includes("single") || lower.includes("indivisible") || lower.includes("one")) {
        reply = {
          id: `msg_${Date.now() + 1}`,
          sender: "tutor",
          content:
            "Spot on! An atomic value cannot be divided into smaller parts according to the domain. Now, suppose a column stores 'Tag1, Tag2, Tag3'. What issue arises when searching for records with 'Tag2'?",
          bloomLevel: "analyze",
          isPedagogicalHint: true,
        };
      } else {
        reply = {
          id: `msg_${Date.now() + 1}`,
          sender: "tutor",
          content:
            "Think about the word 'atom'. If a column contains multiple values grouped together (like a list or array), can relational database operators query individual items efficiently?",
          bloomLevel: "understand",
          isPedagogicalHint: true,
        };
      }

      setMessages((prev) => [...prev, reply]);
      setIsThinking(false);
    }, 700);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border-border/80 shadow-md">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <span>🧠 Socratic Tutor</span>
              <Badge variant="secondary" className="text-xs">
                Active Grounding
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Topic: {topicTitle}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            Course Revision Grounded
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === "student" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`p-3.5 rounded-xl max-w-[85%] text-sm ${
                msg.sender === "student"
                  ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                  : "bg-muted/60 text-foreground border border-border/60 rounded-tl-none"
              }`}
            >
              {msg.content}
            </div>
            {msg.bloomLevel && (
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                Bloom Level: {msg.bloomLevel.toUpperCase()}
              </span>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground italic pl-2">
            <span>Socratic Tutor is formulating a hint...</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t p-3 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your reasoning here..."
          className="min-h-[50px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!input.trim() || isThinking}
          className="self-end"
        >
          Send
        </Button>
      </CardFooter>
    </Card>
  );
}
